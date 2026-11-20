-- YA YO · un seul stock par produit, comme sur V10 (Figma) et dans l'app.
-- Les couleurs restent des variantes (choix de l'acheteur, ligne de commande),
-- mais le stock est partagé : 4 en stock et deux couleurs = 4 articles au total.

alter table public.products add column if not exists stock int not null default 0 check (stock >= 0);
update public.products p set stock = coalesce((select sum(v.stock) from public.product_variants v where v.product_id = p.id), 0);
alter table public.product_variants drop column if exists stock;

grant insert (stock), update (stock) on public.products to authenticated;

-- V10 « Brouillon » : un brouillon peut être enregistré avant que le prix soit connu.
alter table public.products drop constraint if exists products_price_check;
alter table public.products add constraint products_price_check check (price > 0 or (status = 'draft' and price = 0));

-- V1 modifiable après coup (« Informations et logo »), catégorie comprise.
grant update (category) on public.shops to authenticated;
grant insert (product_id, color) on public.product_variants to authenticated;

-- Réservation, libération et retour du stock sur le produit.

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
           (l ->> 'qty')::int as qty, p.stock
    from jsonb_array_elements(p_lines) l
    join public.product_variants v on v.id = (l ->> 'variant_id')::uuid
    join public.products p on p.id = v.product_id
    where p.status = 'active' and public.shop_is_public(p.shop_id)
    for update of p;

  if (select count(*) from _lines) <> jsonb_array_length(p_lines) then
    perform public.fail('UNAVAILABLE', 'Un article de ton panier n’est plus disponible.');
  end if;
  if exists (select 1 from _lines where qty < 1 or qty > 20) then perform public.fail('BAD_QTY', 'Quantité entre 1 et 20.'); end if;
  if exists (select 1 from (select sum(qty) as wanted, max(stock) as stock from _lines group by product_id) t where wanted > stock) then perform public.fail('OUT_OF_STOCK', 'Le stock d’un article a changé. Vérifie ton panier.'); end if;
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

  update public.products p set stock = p.stock - t.qty
    from (select product_id, sum(qty)::int as qty from _lines group by product_id) t where p.id = t.product_id;
  perform public.log_event(null, ck_id, 'buyer', 'checkout.created', p_method::text);
  return ck_id;
end $$;

create or replace function public.expire_payments() returns int
language plpgsql security definer set search_path = '' as $$
declare ck record; n int := 0;
begin
  for ck in select id, attempt from public.checkouts where status = 'pending' and expires_at < now() loop
    perform public.payment_result(ck.id, ck.attempt, 'expired');
    n := n + 1;
  end loop;
  for ck in select id from public.checkouts where status in ('failed', 'expired') and hold_until < now() for update loop
    update public.products p set stock = p.stock + t.qty
      from (select ol.product_id, sum(ol.qty)::int as qty from public.order_lines ol join public.orders o on o.id = ol.order_id
            where o.checkout_id = ck.id group by ol.product_id) t
      where p.id = t.product_id;
    update public.checkouts set hold_until = null where id = ck.id;
    perform public.log_event(null, ck.id, 'system', 'checkout.released_stock');
    n := n + 1;
  end loop;
  return n;
end $$;

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
  update public.products p set stock = p.stock + t.qty
    from (select product_id, sum(qty)::int as qty from public.order_lines where order_id = o.id group by product_id) t where p.id = t.product_id;
  perform public.log_event(o.id, null, 'buyer', 'buyer.cancel', p_reason::text);
end $$;
