-- YA YO · règles des commandes, côté serveur.
-- Reprend la machine à états de l'app (src/domain/orderMachine.ts) : chaque
-- étape est une fonction qui vérifie qui appelle et si la transition est permise.
-- Les erreurs portent un message en français (message) et un code (hint)
-- que l'app peut tester : WRONG_RECEIPT_CODE, PAYMENT_NOT_SECURED, etc.

-- ───────────────────────── Règles chiffrées ─────────────────────────

create or replace function public.rules() returns jsonb
language sql immutable as $$
  select jsonb_build_object(
    'delivery_fee_per_seller', 5000,     -- C1 : frais de livraison par colis vendeur
    'commission_rate', 0.10,             -- V6 : commission YA YO
    'seller_delivery_rate', 0.05,        -- V6 : participation du vendeur à la livraison
    'courier_base_pay', 3000,            -- L4 : rémunération de base d'une mission
    'courier_pay_per_km', 500,           -- L4 : par kilomètre
    'momo_request_seconds', 105,         -- C4 : durée de validité de la demande Mobile Money
    'failed_hold_minutes', 30,           -- C6 : commandes gardées après un échec de paiement
    'max_receipt_attempts', 5            -- L8 : essais du code de réception avant blocage
  )
$$;

create or replace function public.fail(p_code text, p_message text) returns void
language plpgsql as $$
begin
  raise exception '%', p_message using errcode = 'P0001', hint = p_code;
end $$;

create or replace function public.log_event(p_order uuid, p_checkout uuid, p_actor text, p_type text, p_detail text default null) returns void
language sql security definer set search_path = '' as $$
  insert into public.order_events (order_id, checkout_id, actor, actor_id, type, detail)
  values (p_order, p_checkout, p_actor, auth.uid(), p_type, p_detail)
$$;

/** "81 234 5678" / "+243 812345678" / "0812345678" → "+243812345678", ou null. */
create or replace function public.normalize_phone(p text) returns text
language plpgsql immutable as $$
declare d text := regexp_replace(coalesce(p, ''), '\D', '', 'g');
begin
  if d like '243%' then d := substr(d, 4); end if;
  if d like '0%' then d := substr(d, 2); end if;
  if length(d) <> 9 or substr(d, 1, 2) not in ('80','81','82','83','84','85','89','90','91','97','98','99') then return null; end if;
  return '+243' || d;
end $$;

/** Préfixes RDC → opérateur Mobile Money (Vodacom 81–83, Orange 84/85/89, Airtel 97–99). */
create or replace function public.operator_of(p_phone text) returns public.mobile_money_operator
language sql immutable as $$
  select case
    when substr(p_phone, 5, 2) in ('81','82','83') then 'M-Pesa'::public.mobile_money_operator
    when substr(p_phone, 5, 2) in ('84','85','89') then 'Orange Money'
    when substr(p_phone, 5, 2) in ('97','98','99') then 'Airtel Money'
  end
$$;

create or replace function public.promo_discount(p_code text, p_items_total int) returns int
language sql stable security definer set search_path = '' as $$
  select coalesce((
    select least(round(p_items_total * percent / 100.0)::int, cap)
    from public.promo_codes
    where code = upper(trim(p_code)) and active and (ends_at is null or ends_at > now())
  ), 0)
$$;

/** Ce que touche le vendeur sur une commande (V6). */
create or replace function public.order_net(p_items_total int) returns jsonb
language sql immutable as $$
  select jsonb_build_object(
    'items', p_items_total,
    'commission', round(p_items_total * 0.10)::int,
    'delivery', round(p_items_total * 0.05)::int,
    'net', p_items_total - round(p_items_total * 0.10)::int - round(p_items_total * 0.05)::int)
$$;

/** Rémunération du livreur (L4) : base + 500 FC/km arrondis à la centaine ; base seule si échec. */
create or replace function public.mission_pay(p_distance_km numeric, p_failed boolean) returns int
language sql immutable as $$
  select case when p_distance_km is null then 0
              when p_failed then 3000
              else 3000 + (round(p_distance_km * 500 / 100) * 100)::int end
$$;

create or replace function public.random_receipt_code() returns text
language sql volatile as $$ select lpad((floor(random() * 10000))::int::text, 4, '0') $$;

create or replace function public.random_pickup_code() returns text
language sql volatile as $$
  select substr('ABCDEFGHJKLMNPRSTUVWXYZ', 1 + floor(random() * 23)::int, 1) || lpad((floor(random() * 1000))::int::text, 3, '0')
$$;

-- ───────────────────────── Passer commande (C1–C3) ─────────────────────────

/**
 * p_lines : [{ "variant_id": uuid, "qty": int }]. Les prix viennent de la base,
 * jamais du téléphone. Le stock est réservé tout de suite et rendu si le paiement
 * échoue définitivement ou si la commande est annulée.
 */
create or replace function public.place_checkout(
  p_lines jsonb, p_address uuid, p_slot text, p_method public.payment_method,
  p_msisdn text default null, p_promo text default null, p_note text default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  me_profile public.profiles;
  addr public.addresses;
  ck_id uuid;
  v_msisdn text;
  op public.mobile_money_operator;
  items_sum int := 0;
  discount_total int;
  given int := 0;
  shop record;
  n_shops int;
  i int := 0;
  part int;
  o_id uuid;
  fee int := (public.rules() ->> 'delivery_fee_per_seller')::int;
begin
  if me is null then perform public.fail('NOT_SIGNED_IN', 'Connecte-toi pour commander.'); end if;
  select * into me_profile from public.profiles where id = me;
  if me_profile.suspended then perform public.fail('SUSPENDED', 'Ton compte est en cours d’examen. Contacte le support YA YO.'); end if;
  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then perform public.fail('EMPTY_CART', 'Ton panier est vide.'); end if;

  select * into addr from public.addresses where id = p_address and user_id = me;
  if addr.id is null then perform public.fail('NO_ADDRESS', 'Choisis une adresse de livraison.'); end if;
  if not exists (select 1 from public.delivery_slots where id = p_slot and active) then perform public.fail('NO_SLOT', 'Choisis un créneau de livraison.'); end if;

  if p_method = 'mobile_money' then
    v_msisdn := public.normalize_phone(p_msisdn);
    op := public.operator_of(v_msisdn);
    if op is null then perform public.fail('UNKNOWN_OPERATOR', 'Ce numéro n’est ni M-Pesa, ni Orange Money, ni Airtel Money.'); end if;
  end if;

  -- Lignes du panier, verrouillées pour réserver le stock sans course.
  if to_regclass('pg_temp._lines') is not null then drop table _lines; end if;
  create temp table _lines on commit drop as
    select v.id as variant_id, v.product_id, v.color, p.shop_id, coalesce(p.short_name, p.name) as name, p.price,
           (l ->> 'qty')::int as qty, v.stock
    from jsonb_array_elements(p_lines) l
    join public.product_variants v on v.id = (l ->> 'variant_id')::uuid
    join public.products p on p.id = v.product_id
    where p.status = 'active' and public.shop_is_public(p.shop_id)
    for update of v;

  if (select count(*) from _lines) <> jsonb_array_length(p_lines) then
    perform public.fail('UNAVAILABLE', 'Un article de ton panier n’est plus disponible.');
  end if;
  if exists (select 1 from _lines where qty < 1 or qty > 20) then perform public.fail('BAD_QTY', 'Quantité entre 1 et 20.'); end if;
  if exists (select 1 from _lines where qty > stock) then perform public.fail('OUT_OF_STOCK', 'Le stock d’un article a changé. Vérifie ton panier.'); end if;
  if exists (select 1 from _lines where shop_id = public.my_shop_id()) then perform public.fail('OWN_PRODUCT', 'Tu ne peux pas acheter dans ta propre boutique.'); end if;
  if p_method = 'cash' and exists (select 1 from _lines l join public.shops s on s.id = l.shop_id where not s.accepts_cash) then
    perform public.fail('CASH_REFUSED', 'Un vendeur de ton panier n’accepte pas le paiement à la livraison.');
  end if;

  select sum(price * qty) into items_sum from _lines;
  select count(distinct shop_id) into n_shops from _lines;
  discount_total := case when p_promo is null then 0 else public.promo_discount(p_promo, items_sum) end;
  if p_promo is not null and discount_total = 0 then perform public.fail('BAD_PROMO', 'Ce code promo n’est pas valide.'); end if;

  insert into public.checkouts (buyer_id, amount, method, operator, msisdn, status, attempt, requested_at, expires_at)
  values (me, items_sum + fee * n_shops - discount_total, p_method, op, v_msisdn,
          case when p_method = 'cash' then 'succeeded' else 'pending' end::public.checkout_status,
          case when p_method = 'cash' then 0 else 1 end,
          case when p_method = 'cash' then null else now() end,
          case when p_method = 'cash' then null else now() + make_interval(secs => (public.rules() ->> 'momo_request_seconds')::int) end)
  returning id into ck_id;

  -- Une commande par vendeur ; la remise est répartie au prorata, le reste sur la dernière.
  for shop in select shop_id, sum(price * qty)::int as items from _lines group by shop_id order by shop_id loop
    i := i + 1;
    part := case when i = n_shops then discount_total - given else floor(discount_total::numeric * shop.items / items_sum)::int end;
    given := given + part;
    insert into public.orders (checkout_id, buyer_id, shop_id, items_total, delivery_fee, discount, total, method, payment,
                               address_id, dropoff, dropoff_phone, buyer_label, buyer_commune, slot_id, courier_note)
    values (ck_id, me, shop.shop_id, shop.items, fee, part, shop.items + fee - part, p_method,
            case when p_method = 'cash' then 'pending' else 'initiated' end::public.payment_status,
            addr.id, concat_ws(', ', addr.street, addr.commune, addr.city) || coalesce(' · ' || addr.landmark, ''), addr.phone,
            coalesce(nullif(split_part(me_profile.name, ' ', 1), ''), 'Client')
              || coalesce(' ' || nullif(left(split_part(me_profile.name, ' ', 2), 1), '') || '.', ''),
            addr.commune, p_slot, nullif(trim(p_note), ''))
    returning id into o_id;
    insert into public.order_lines (order_id, product_id, variant_id, name, color, qty, unit_price)
      select o_id, product_id, variant_id, name, color, qty, price from _lines where shop_id = shop.shop_id;
    insert into public.order_codes (order_id, receipt_code, pickup_code) values (o_id, public.random_receipt_code(), public.random_pickup_code());
    perform public.log_event(o_id, ck_id, 'buyer', 'order.created');
  end loop;

  update public.product_variants v set stock = v.stock - l.qty from _lines l where v.id = l.variant_id;
  perform public.log_event(null, ck_id, 'buyer', 'checkout.created', p_method::text);
  return ck_id;
end $$;

-- ───────────────────────── Paiement (C4–C6) ─────────────────────────

/**
 * Réponse de l'opérateur, appelée par la fonction Edge qui reçoit son webhook
 * (jamais par le téléphone). p_outcome : approved | insufficient_funds | declined | expired.
 */
create or replace function public.payment_result(p_checkout uuid, p_attempt int, p_outcome text, p_provider_ref text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare ck public.checkouts;
begin
  select * into ck from public.checkouts where id = p_checkout for update;
  -- Réponse en retard ou en double : ignorée, comme dans l'app.
  if ck.id is null or ck.status <> 'pending' or ck.attempt <> p_attempt then return; end if;
  if p_outcome = 'approved' then
    update public.checkouts set status = 'succeeded', failure_reason = null, provider_ref = coalesce(p_provider_ref, provider_ref) where id = ck.id;
    update public.orders set payment = 'held_in_escrow', paid_at = now() where checkout_id = ck.id;
    perform public.log_event(null, ck.id, 'payment_provider', 'payment.held_in_escrow', p_provider_ref);
  elsif p_outcome in ('insufficient_funds', 'declined', 'expired') then
    update public.checkouts
      set status = case when p_outcome = 'expired' then 'expired' else 'failed' end::public.checkout_status,
          failure_reason = p_outcome::public.payment_failure,
          hold_until = now() + make_interval(mins => (public.rules() ->> 'failed_hold_minutes')::int)
      where id = ck.id;
    update public.orders set payment = 'failed' where checkout_id = ck.id;
    perform public.log_event(null, ck.id, case when p_outcome = 'expired' then 'system' else 'payment_provider' end, 'payment.failed', p_outcome);
  else
    perform public.fail('BAD_OUTCOME', 'Réponse de paiement inconnue.');
  end if;
end $$;

/** C4 « Renvoyer » / C6 « Réessayer » : nouvelle demande sur les mêmes commandes, tant qu'elles sont gardées. */
create or replace function public.retry_payment(p_checkout uuid, p_method public.payment_method, p_msisdn text default null) returns int
language plpgsql security definer set search_path = '' as $$
declare ck public.checkouts; v_msisdn text; op public.mobile_money_operator;
begin
  select * into ck from public.checkouts where id = p_checkout and buyer_id = auth.uid() for update;
  if ck.id is null then perform public.fail('NOT_FOUND', 'Paiement introuvable.'); end if;
  if ck.status = 'succeeded' then perform public.fail('ALREADY_PAID', 'Cette commande est déjà payée.'); end if;
  if ck.status = 'pending' and ck.expires_at > now() then perform public.fail('PENDING', 'Valide d’abord la demande sur ton téléphone.'); end if;
  if ck.hold_until is not null and ck.hold_until < now() then perform public.fail('HOLD_EXPIRED', 'Ta commande a expiré. Reprends depuis le panier.'); end if;

  if p_method = 'cash' then
    if exists (select 1 from public.orders o join public.shops s on s.id = o.shop_id where o.checkout_id = ck.id and not s.accepts_cash) then
      perform public.fail('CASH_REFUSED', 'Un vendeur de ton panier n’accepte pas le paiement à la livraison.');
    end if;
    update public.checkouts set method = 'cash', operator = null, msisdn = null, status = 'succeeded', failure_reason = null, hold_until = null where id = ck.id;
    update public.orders set method = 'cash', payment = 'pending' where checkout_id = ck.id;
    perform public.log_event(null, ck.id, 'buyer', 'payment.cash_confirmed');
    return ck.attempt;
  end if;

  if p_method = 'mobile_money' then
    v_msisdn := public.normalize_phone(p_msisdn);
    op := public.operator_of(v_msisdn);
    if op is null then perform public.fail('UNKNOWN_OPERATOR', 'Ce numéro n’est ni M-Pesa, ni Orange Money, ni Airtel Money.'); end if;
  end if;
  update public.checkouts
    set method = p_method, operator = op, msisdn = v_msisdn, status = 'pending', attempt = ck.attempt + 1, failure_reason = null,
        requested_at = now(), expires_at = now() + make_interval(secs => (public.rules() ->> 'momo_request_seconds')::int)
    where id = ck.id;
  update public.orders set method = p_method, payment = 'initiated' where checkout_id = ck.id;
  perform public.log_event(null, ck.id, 'buyer', 'payment.requested', p_method::text);
  return ck.attempt + 1;
end $$;

/** Tâche planifiée : demandes Mobile Money sans réponse, puis commandes non payées après 30 min (stock rendu). */
create or replace function public.expire_payments() returns int
language plpgsql security definer set search_path = '' as $$
declare ck record; n int := 0;
begin
  for ck in select id, attempt from public.checkouts where status = 'pending' and expires_at < now() loop
    perform public.payment_result(ck.id, ck.attempt, 'expired');
    n := n + 1;
  end loop;
  for ck in select id from public.checkouts where status in ('failed', 'expired') and hold_until < now() for update loop
    update public.product_variants v set stock = v.stock + ol.qty
      from public.order_lines ol join public.orders o on o.id = ol.order_id
      where o.checkout_id = ck.id and v.id = ol.variant_id;
    update public.checkouts set hold_until = null where id = ck.id;
    perform public.log_event(null, ck.id, 'system', 'checkout.released_stock');
    n := n + 1;
  end loop;
  return n;
end $$;

-- ───────────────────────── Codes secrets ─────────────────────────

/** D2 : le code que l'acheteur donne au livreur. Il libère le paiement du vendeur. */
create or replace function public.my_receipt_code(p_order uuid) returns text
language sql stable security definer set search_path = '' as $$
  select c.receipt_code from public.order_codes c join public.orders o on o.id = c.order_id
  where o.id = p_order and o.buyer_id = auth.uid() and o.payment in ('pending', 'held_in_escrow', 'in_delivery')
$$;

/** V7 : le code que le vendeur donne au livreur à la remise du colis. */
create or replace function public.my_pickup_code(p_order uuid) returns text
language sql stable security definer set search_path = '' as $$
  select c.pickup_code from public.order_codes c join public.orders o on o.id = c.order_id
  where o.id = p_order and o.shop_id = public.my_shop_id() and o.seller in ('preparing', 'ready')
$$;

-- ───────────────────────── Vendeur (V5–V7) ─────────────────────────

create or replace function public.lock_order_as(p_order uuid, p_role text) returns public.orders
language plpgsql security definer set search_path = '' as $$
declare o public.orders;
begin
  select * into o from public.orders where id = p_order for update;
  if o.id is null
     or (p_role = 'buyer' and o.buyer_id is distinct from auth.uid())
     or (p_role = 'seller' and o.shop_id is distinct from public.my_shop_id())
     or (p_role = 'courier' and o.courier_id is distinct from auth.uid())
     or (p_role = 'admin' and not public.is_admin()) then
    perform public.fail('NOT_FOUND', 'Commande introuvable.');
  end if;
  if o.cancelled_at is not null and p_role <> 'admin' then perform public.fail('INVALID_TRANSITION', 'Cette commande a été annulée par l’acheteur.'); end if;
  return o;
end $$;

create or replace function public.seller_start_preparing(p_order uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare o public.orders := public.lock_order_as(p_order, 'seller');
begin
  if o.seller <> 'new' then perform public.fail('INVALID_TRANSITION', 'La commande est déjà en préparation.'); end if;
  if not ((o.method = 'cash' and o.payment = 'pending') or (o.method <> 'cash' and o.payment = 'held_in_escrow')) then
    perform public.fail('PAYMENT_NOT_SECURED', 'Le vendeur ne prépare qu’une commande dont le paiement est sécurisé.');
  end if;
  update public.orders set seller = 'preparing' where id = o.id;
  perform public.log_event(o.id, null, 'seller', 'seller.start_preparing');
end $$;

/**
 * Propose la mission au livreur YA YO disponible le moins chargé, qui ne l'a pas
 * déjà refusée. Sans livreur disponible, la commande attend (dispatch_waiting()).
 */
create or replace function public.dispatch_order(p_order uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare o public.orders; chosen uuid;
begin
  select * into o from public.orders where id = p_order for update;
  if o.seller <> 'ready' or o.delivery not in ('unassigned', 'assigned') or o.cancelled_at is not null then return null; end if;
  select c.user_id into chosen
  from public.couriers c join public.profiles p on p.id = c.user_id
  where c.status = 'approved' and c.online and not p.suspended and not (c.user_id = any (o.declined_by))
  order by (select count(*) from public.orders x where x.courier_id = c.user_id and x.delivery in ('assigned', 'picking_up', 'delivering')), random()
  limit 1;
  update public.orders
    set courier_id = chosen,
        delivery = case when chosen is null then 'unassigned' else 'assigned' end::public.delivery_status,
        proposed_at = case when chosen is null then null else now() end,
        mission_number = coalesce(mission_number, 'M-' || (5000 + floor(random() * 1000))::int || '-' || substr(o.number, 4))
    where id = o.id;
  perform public.log_event(o.id, null, 'system', case when chosen is null then 'dispatch.waiting' else 'dispatch.proposed' end);
  return chosen;
end $$;

create or replace function public.dispatch_waiting() returns int
language plpgsql security definer set search_path = '' as $$
declare r record; n int := 0;
begin
  for r in select id from public.orders where seller = 'ready' and delivery = 'unassigned' and cancelled_at is null loop
    if public.dispatch_order(r.id) is not null then n := n + 1; end if;
  end loop;
  return n;
end $$;

create or replace function public.seller_mark_ready(p_order uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare o public.orders := public.lock_order_as(p_order, 'seller');
begin
  if o.seller <> 'preparing' then perform public.fail('INVALID_TRANSITION', 'La commande doit être en préparation.'); end if;
  update public.orders set seller = 'ready', prepared_at = now() where id = o.id;
  perform public.log_event(o.id, null, 'seller', 'seller.mark_ready');
  perform public.dispatch_order(o.id);
end $$;

-- ───────────────────────── Livreur (L4–L9) ─────────────────────────

create or replace function public.courier_accept(p_order uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare o public.orders := public.lock_order_as(p_order, 'courier');
begin
  if o.delivery <> 'assigned' then perform public.fail('INVALID_TRANSITION', 'Aucune mission assignée.'); end if;
  update public.orders set delivery = 'picking_up', accepted_at = now() where id = o.id;
  perform public.log_event(o.id, null, 'courier', 'courier.accept');
end $$;

/** L4 « Refuser » : la mission part au livreur suivant et ne revient jamais à celui-ci. */
create or replace function public.courier_decline(p_order uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare o public.orders := public.lock_order_as(p_order, 'courier');
begin
  if o.delivery <> 'assigned' then perform public.fail('INVALID_TRANSITION', 'Cette mission n’est plus proposée.'); end if;
  update public.orders set declined_by = array_append(declined_by, auth.uid()), courier_id = null, delivery = 'unassigned' where id = o.id;
  perform public.log_event(o.id, null, 'courier', 'courier.decline');
  perform public.dispatch_order(o.id);
end $$;

/** Le livreur saisit le code de remise du vendeur (V7). */
create or replace function public.courier_collect(p_order uuid, p_code text) returns void
language plpgsql security definer set search_path = '' as $$
declare o public.orders := public.lock_order_as(p_order, 'courier');
begin
  if o.delivery <> 'picking_up' or o.seller <> 'ready' then perform public.fail('INVALID_TRANSITION', 'Le colis n’est pas prêt pour la collecte.'); end if;
  if upper(trim(p_code)) <> (select pickup_code from public.order_codes where order_id = o.id) then
    perform public.fail('WRONG_PICKUP_CODE', 'Code de remise incorrect.');
  end if;
  update public.orders set seller = 'handed_over', delivery = 'delivering', payment = 'in_delivery', picked_up_at = now() where id = o.id;
  perform public.log_event(o.id, null, 'courier', 'courier.collect');
end $$;

create or replace function public.courier_arrive(p_order uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare o public.orders := public.lock_order_as(p_order, 'courier');
begin
  if o.delivery <> 'delivering' then perform public.fail('INVALID_TRANSITION', 'Le colis n’est pas en cours de livraison.'); end if;
  if o.arrived_at is null then
    update public.orders set arrived_at = now() where id = o.id;
    perform public.log_event(o.id, null, 'courier', 'courier.arrive');
  end if;
end $$;

/**
 * L8 · le livreur saisit le code de réception donné par l'acheteur.
 * Après 5 codes faux, la mission est bloquée et YA YO reprend la main.
 * Les essais ratés sont gardés : la fonction rend false au lieu d'échouer.
 */
create or replace function public.courier_confirm_delivery(p_order uuid, p_code text, p_cash_collected boolean default false) returns boolean
language plpgsql security definer set search_path = '' as $$
declare o public.orders := public.lock_order_as(p_order, 'courier'); codes public.order_codes;
begin
  if o.payment = 'disputed' then perform public.fail('DISPUTED', 'Le client a signalé un problème : garde le colis, YA YO te contacte pour la suite.'); end if;
  if o.delivery <> 'delivering' or o.payment <> 'in_delivery' then perform public.fail('INVALID_TRANSITION', 'Le colis n’est pas en cours de livraison.'); end if;
  select * into codes from public.order_codes where order_id = o.id for update;
  if codes.failed_receipt_attempts >= (public.rules() ->> 'max_receipt_attempts')::int then
    perform public.fail('TOO_MANY_ATTEMPTS', 'Trop de codes incorrects. Contacte le support YA YO.');
  end if;
  if trim(p_code) <> codes.receipt_code then
    update public.order_codes set failed_receipt_attempts = failed_receipt_attempts + 1 where order_id = o.id;
    perform public.log_event(o.id, null, 'courier', 'courier.wrong_receipt_code');
    return false;
  end if;
  if o.method = 'cash' and not coalesce(p_cash_collected, false) then
    perform public.fail('CASH_NOT_COLLECTED', 'Le livreur doit encaisser le montant avant de confirmer.');
  end if;
  update public.orders
    set delivery = 'delivered', payment = 'delivered', delivered_at = now(),
        cash_collected = case when o.method = 'cash' then true end
    where id = o.id;
  perform public.log_event(o.id, null, 'courier', 'courier.confirm_delivery');
  return true;
end $$;

/** L9 · Impossible de livrer : photo du lieu obligatoire ; YA YO décide de la suite. */
create or replace function public.courier_report_incident(p_order uuid, p_reason public.incident_reason, p_photo_path text) returns void
language plpgsql security definer set search_path = '' as $$
declare o public.orders := public.lock_order_as(p_order, 'courier');
begin
  if o.delivery <> 'delivering' then perform public.fail('INVALID_TRANSITION', 'Un incident se déclare pendant la livraison.'); end if;
  if coalesce(trim(p_photo_path), '') = '' then perform public.fail('PROOF_REQUIRED', 'Ajoute une photo du lieu comme preuve de passage.'); end if;
  update public.orders set delivery = 'failed', incident_reason = p_reason, incident_photo_path = p_photo_path, incident_at = now() where id = o.id;
  perform public.log_event(o.id, null, 'courier', 'courier.report_incident', p_reason::text);
end $$;

-- ───────────────────────── Acheteur (D4, D5, D18) ─────────────────────────

/** D18 : annulable tant que le colis n'est pas remis au livreur. Le stock est rendu. */
create or replace function public.buyer_cancel(p_order uuid, p_reason public.cancel_reason, p_note text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare o public.orders := public.lock_order_as(p_order, 'buyer'); prepaid boolean;
begin
  if o.incident_at is not null
     or not ((o.method = 'cash' and o.payment = 'pending') or (o.method <> 'cash' and o.payment = 'held_in_escrow'))
     or o.seller = 'handed_over' or o.delivery not in ('unassigned', 'assigned', 'picking_up') then
    perform public.fail('INVALID_TRANSITION', 'Le colis est déjà parti chez le livreur : signale plutôt un problème à la réception.');
  end if;
  prepaid := o.method <> 'cash';
  update public.orders
    set payment = case when prepaid then 'refunded' else 'failed' end::public.payment_status,
        delivery = 'unassigned', courier_id = null,
        cancel_reason = p_reason, cancel_note = nullif(trim(p_note), ''), cancelled_at = now(),
        refund = case when prepaid then 'sent' else 'none' end::public.refund_state
    where id = o.id;
  update public.product_variants v set stock = v.stock + ol.qty from public.order_lines ol where ol.order_id = o.id and v.id = ol.variant_id;
  perform public.log_event(o.id, null, 'buyer', 'buyer.cancel', p_reason::text);
end $$;

/** D4 : pendant la livraison (avant de donner le code) ou après un échec de livraison. */
create or replace function public.buyer_open_dispute(p_order uuid, p_reason public.dispute_reason, p_description text, p_photo_paths text[] default '{}') returns uuid
language plpgsql security definer set search_path = '' as $$
declare o public.orders := public.lock_order_as(p_order, 'buyer'); d_id uuid; descr text := trim(coalesce(p_description, ''));
begin
  if exists (select 1 from public.disputes where order_id = o.id) or not (o.payment = 'in_delivery' or o.delivery = 'failed') then
    perform public.fail('INVALID_TRANSITION', 'Un problème se signale pendant la livraison, avant de donner ton code de réception.');
  end if;
  if char_length(descr) < 10 then perform public.fail('PROOF_REQUIRED', 'Décris le problème en quelques mots (10 caractères au moins).'); end if;
  if p_reason <> 'not_received' and cardinality(coalesce(p_photo_paths, '{}')) = 0 then perform public.fail('PROOF_REQUIRED', 'Ajoute au moins une photo du produit reçu.'); end if;
  if cardinality(coalesce(p_photo_paths, '{}')) > 4 then perform public.fail('PROOF_REQUIRED', '4 photos au maximum.'); end if;
  insert into public.disputes (number, order_id, reason, description, photo_paths)
  values ('LT-' || lpad(right(regexp_replace(o.number, '\D', '', 'g'), 4), 4, '0'), o.id, p_reason, descr, coalesce(p_photo_paths, '{}'))
  returning id into d_id;
  update public.orders set payment = 'disputed', disputed_at = now() where id = o.id;
  perform public.log_event(o.id, null, 'buyer', 'buyer.dispute', p_reason::text);
  return d_id;
end $$;

create or replace function public.buyer_dispute_note(p_order uuid, p_text text) returns void
language plpgsql security definer set search_path = '' as $$
declare o public.orders := public.lock_order_as(p_order, 'buyer'); d public.disputes;
begin
  select * into d from public.disputes where order_id = o.id;
  if d.id is null or d.outcome is not null then perform public.fail('INVALID_TRANSITION', 'Aucun litige en cours.'); end if;
  if coalesce(trim(p_text), '') = '' then perform public.fail('PROOF_REQUIRED', 'Écris ton information.'); end if;
  insert into public.dispute_notes (dispute_id, text) values (d.id, left(trim(p_text), 500));
end $$;

create or replace function public.buyer_rate(p_order uuid, p_seller_rating int, p_courier_rating int default null, p_comment text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare o public.orders := public.lock_order_as(p_order, 'buyer');
begin
  if o.delivered_at is null then perform public.fail('INVALID_TRANSITION', 'Tu pourras noter après la livraison.'); end if;
  insert into public.order_ratings (order_id, seller_rating, courier_rating, comment)
  values (o.id, p_seller_rating, p_courier_rating, nullif(trim(p_comment), ''))
  on conflict (order_id) do update set seller_rating = excluded.seller_rating, courier_rating = excluded.courier_rating, comment = excluded.comment, at = now();
end $$;

-- ───────────────────────── YA YO (service et back-office) ─────────────────────────

/** Le virement au vendeur est parti (fonction Edge de versement) : fonds libérés. */
create or replace function public.release_escrow(p_order uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare o public.orders;
begin
  select * into o from public.orders where id = p_order for update;
  if o.payment <> 'delivered' then perform public.fail('INVALID_TRANSITION', 'Les fonds ne sont libérés qu’après la livraison.'); end if;
  update public.orders set payment = 'released', released_at = now() where id = o.id;
  perform public.log_event(o.id, null, 'system', 'escrow.release');
end $$;

/** D19 : l'opérateur confirme que le remboursement est arrivé. */
create or replace function public.refund_received(p_order uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.orders set refund = 'received', refunded_at = now() where id = p_order and refund = 'sent';
  if not found then perform public.fail('INVALID_TRANSITION', 'Aucun remboursement en cours.'); end if;
  perform public.log_event(p_order, null, 'payment_provider', 'refund.received');
end $$;

/** YA YO tranche un litige : remboursement de l'acheteur, ou paiement du vendeur. */
create or replace function public.decide_dispute(p_order uuid, p_outcome public.dispute_outcome) returns void
language plpgsql security definer set search_path = '' as $$
declare o public.orders := public.lock_order_as(p_order, 'admin'); d public.disputes;
begin
  select * into d from public.disputes where order_id = o.id for update;
  if d.id is null or d.outcome is not null then perform public.fail('INVALID_TRANSITION', 'Aucun litige en cours.'); end if;
  update public.disputes set outcome = p_outcome, decided_at = now(), decided_by = auth.uid() where id = d.id;
  if p_outcome = 'refund' then
    update public.orders set payment = 'refunded' where id = o.id;
  else
    update public.orders set payment = 'delivered', delivery = 'delivered', delivered_at = coalesce(delivered_at, now()) where id = o.id;
  end if;
  perform public.log_event(o.id, null, 'admin', 'dispute.decide', p_outcome::text);
end $$;

-- ───────────────────────── Droits d'exécution ─────────────────────────

-- Supabase donne par défaut l'exécution à anon et authenticated : on la reprend
-- à tous, puis on ne rend que les fonctions prévues pour l'app.
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function
  public.is_admin(), public.my_shop_id(), public.shop_is_public(uuid), public.product_is_visible(uuid),
  public.post_is_visible(uuid), public.can_see_order(uuid), public.rules(), public.order_net(int), public.mission_pay(numeric, boolean)
  to anon, authenticated;
grant execute on function
  public.place_checkout(jsonb, uuid, text, public.payment_method, text, text, text),
  public.retry_payment(uuid, public.payment_method, text),
  public.promo_discount(text, int),
  public.my_receipt_code(uuid), public.my_pickup_code(uuid),
  public.seller_start_preparing(uuid), public.seller_mark_ready(uuid),
  public.courier_accept(uuid), public.courier_decline(uuid), public.courier_collect(uuid, text), public.courier_arrive(uuid),
  public.courier_confirm_delivery(uuid, text, boolean), public.courier_report_incident(uuid, public.incident_reason, text),
  public.buyer_cancel(uuid, public.cancel_reason, text), public.buyer_open_dispute(uuid, public.dispute_reason, text, text[]),
  public.buyer_dispute_note(uuid, text), public.buyer_rate(uuid, int, int, text),
  public.decide_dispute(uuid, public.dispute_outcome)
  to authenticated;
-- payment_result, expire_payments, dispatch_order, dispatch_waiting, release_escrow, refund_received :
-- réservés au rôle service (fonctions Edge et tâches planifiées).
grant execute on all functions in schema public to service_role;
