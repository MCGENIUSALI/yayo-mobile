-- Parcours complet d'une commande et règles d'accès, joués avec les vrais rôles.
-- Comptes : acheteur B, vendeuse S (boutique validée), livreur C, admin A, intrus X.

\set B '''00000000-0000-0000-0000-0000000000b1'''
\set S '''00000000-0000-0000-0000-0000000000a5'''
\set C '''00000000-0000-0000-0000-0000000000c1'''
\set C2 '''00000000-0000-0000-0000-0000000000c2'''
\set A '''00000000-0000-0000-0000-0000000000ad'''
\set X '''00000000-0000-0000-0000-0000000000ee'''

-- Attend une erreur portant ce code (hint) ; échoue sinon.
create function pg_temp.expect(p_sql text, p_hint text) returns void language plpgsql as $$
declare h text;
begin
  begin
    execute p_sql;
  exception when others then
    get stacked diagnostics h = pg_exception_hint;
    if coalesce(nullif(h, ''), sqlstate) <> p_hint then raise exception 'attendu %, reçu % (%)', p_hint, coalesce(nullif(h, ''), sqlstate), sqlerrm; end if;
    return;
  end;
  raise exception 'attendu l''erreur %, mais l''appel a réussi : %', p_hint, p_sql;
end $$;
create function pg_temp.ok(p_cond boolean, p_msg text) returns void language plpgsql as $$
begin
  if not coalesce(p_cond, false) then raise exception 'échec : %', p_msg; end if;
end $$;
create function pg_temp.act(p_user text) returns void language sql as $$
  select set_config('request.jwt.claim.sub', p_user, false)
$$;

-- ── Comptes (le déclencheur crée les profils) ──
insert into auth.users (id, phone) values (:B, '243812345678'), (:S, '243897654321'), (:C, '243998765432'), (:C2, '243991111111'), (:A, '243810000001'), (:X, '243810000002');
do $$ begin assert (select phone from public.profiles where id = '00000000-0000-0000-0000-0000000000b1') = '+243812345678', 'téléphone du profil'; end $$;
update public.profiles set name = 'Jean Mukendi' where id = :B;
update public.profiles set is_admin = true where id = :A;

-- ── La vendeuse ouvre sa boutique : invisible tant que YA YO ne l'a pas validée ──
set role authenticated;
select pg_temp.act(:S);
insert into public.shops (owner_id, name, handle, category, commune) values (:S, 'JBL Store Kin', 'jblstorekin', 'Électronique et audio', 'Gombe');
select pg_temp.expect($$update public.shops set status = 'approved'$$, '42501');
insert into public.products (shop_id, name, price, status, category_id)
  select public.my_shop_id(), 'JBL Flip 6', 189000, 'active', (select id from public.categories where name = 'Électronique › Enceintes');
insert into public.product_variants (product_id, color, stock) select id, 'Noir', 3 from public.products;
insert into public.product_variants (product_id, color, stock) select id, 'Bleu', 1 from public.products;
select pg_temp.expect($$update public.products set rating = 5$$, '42501');
select pg_temp.act(:B);
do $$ begin assert (select count(*) from public.products) = 0, 'produit d’une boutique non validée visible'; end $$;
reset role;
update public.shops set status = 'approved';
set role authenticated;
do $$ begin assert (select count(*) from public.products) = 1, 'produit visible après validation'; end $$;
do $$ begin assert (select verified from public.shops) , 'badge vérifié'; end $$;

-- ── Le livreur s'inscrit ; YA YO le valide ; il se met en ligne ──
select pg_temp.act(:C);
insert into public.couriers (user_id, transport, plate, zone, payout_phone) values (:C, 'Moto', 'KN 1234 BB', 'Gombe', '+243998765432');
select pg_temp.expect($$update public.couriers set status = 'approved'$$, '42501');
select pg_temp.act(:C2);
insert into public.couriers (user_id, transport, zone, payout_phone) values (:C2, 'Vélo', 'Gombe', '+243991111111');
reset role;
update public.couriers set status = 'approved', online = true;

-- ── L'acheteur commande : prix et frais calculés par la base ──
set role authenticated;
select pg_temp.act(:B);
insert into public.addresses (user_id, label, street, commune, phone, is_default) values (:B, 'Maison', '12 av. Kasa-Vubu', 'Kalamu', '+243812345678', true);
select pg_temp.expect(format($$select public.place_checkout('[{"variant_id":"%s","qty":5}]', (select id from public.addresses), 'asap', 'cash')$$,
  (select id from public.product_variants where color = 'Noir')), 'OUT_OF_STOCK');
select pg_temp.expect(format($$select public.place_checkout('[{"variant_id":"%s","qty":1}]', (select id from public.addresses), 'asap', 'mobile_money', '0901234567')$$,
  (select id from public.product_variants where color = 'Noir')), 'UNKNOWN_OPERATOR');
select public.place_checkout(
  jsonb_build_array(jsonb_build_object('variant_id', (select id from public.product_variants where color = 'Noir'), 'qty', 2)),
  (select id from public.addresses), 'asap', 'mobile_money', '81 234 5678', 'yayo10', 'Sonner deux fois') as ck \gset
do $$
declare o public.orders := (select o from public.orders o);
begin
  -- 2 × 189 000 = 378 000 ; remise 10 % plafonnée à 20 000 ; livraison 5 000.
  assert o.items_total = 378000 and o.discount = 20000 and o.delivery_fee = 5000 and o.total = 363000, 'montants : ' || row(o.items_total, o.discount, o.total)::text;
  assert (select amount from public.checkouts) = 363000, 'montant payé';
  assert (select operator from public.checkouts) = 'M-Pesa', 'opérateur détecté';
  assert o.buyer_label = 'Jean M.' and o.buyer_commune = 'Kalamu', 'ce que voit le vendeur';
  assert o.payment = 'initiated', 'pas encore payé';
end $$;
do $$ begin assert (select stock from public.product_variants where color = 'Noir') = 1, 'stock réservé'; end $$;
select pg_temp.expect($$select * from public.order_codes$$, '42501');
select pg_temp.expect($$update public.orders set payment = 'released'$$, '42501');
select pg_temp.expect($$select public.payment_result((select id from public.checkouts), 1, 'approved')$$, '42501');
select public.my_receipt_code((select id from public.orders)) is null as code_avant_paiement \gset
select pg_temp.ok(:'code_avant_paiement'::boolean, 'pas de code tant que ce n’est pas payé');

-- Un intrus ne voit rien.
select pg_temp.act(:X);
do $$ begin assert (select count(*) from public.orders) = 0 and (select count(*) from public.addresses) = 0, 'intrus'; end $$;
select pg_temp.expect($$select public.seller_start_preparing((select id from public.orders limit 1))$$, 'NOT_FOUND');

-- ── L'opérateur confirme (fonction Edge, rôle service) ──
reset role;
set role service_role;
select public.payment_result(:'ck', 1, 'approved', 'MPESA-TX-1');
select public.payment_result(:'ck', 1, 'declined');  -- réponse en double : ignorée
reset role;
do $$ begin assert (select payment from public.orders) = 'held_in_escrow', 'séquestre'; end $$;

-- ── Vendeuse : préparation puis colis prêt → mission proposée à un livreur ──
set role authenticated;
select pg_temp.act(:S);
do $$ begin assert (select count(*) from public.orders) = 1, 'la vendeuse voit sa commande'; end $$;
select pg_temp.expect($$select public.seller_mark_ready((select id from public.orders))$$, 'INVALID_TRANSITION');
select public.seller_start_preparing(id) from public.orders;
select public.seller_mark_ready(id) from public.orders;
select public.my_pickup_code(id) as pickup from public.orders \gset
reset role;
do $$ begin assert (select delivery from public.orders) = 'assigned' and (select courier_id from public.orders) is not null, 'mission proposée'; end $$;

-- Le livreur qui reçoit la mission la refuse : elle passe à l'autre, et ne lui revient jamais.
select courier_id as first_courier from public.orders \gset
set role authenticated;
select pg_temp.act(:'first_courier');
select public.courier_decline(id) from public.orders;
reset role;
do $$ begin
  assert (select courier_id from public.orders) is not null and (select courier_id::text from public.orders) <> current_setting('request.jwt.claim.sub'), 'mission passée au suivant';
end $$;
select courier_id as courier from public.orders \gset
set role authenticated;
select pg_temp.act(:'courier');
select public.courier_decline(id) from public.orders;
reset role;
do $$ begin assert (select delivery from public.orders) = 'unassigned' and (select courier_id from public.orders) is null, 'plus de livreur : en attente'; end $$;
-- Pour la suite, on remet la mission au livreur C (comme le ferait YA YO).
update public.orders set declined_by = '{}';
update public.couriers set online = false where user_id = :C2;
select public.dispatch_waiting();

-- ── Livreur C : accepte, collecte avec le code de remise, livre avec le code de réception ──
set role authenticated;
select pg_temp.act(:C);
do $$ begin assert (select count(*) from public.orders) = 1, 'le livreur voit sa mission'; end $$;
select public.courier_accept(id) from public.orders;
select pg_temp.expect($$select public.courier_collect((select id from public.orders), 'Z999')$$, 'WRONG_PICKUP_CODE');
select public.courier_collect(id, lower(:'pickup')) from public.orders;
select pg_temp.ok(public.my_receipt_code((select id from public.orders)) is null, 'le livreur ne lit pas le code de réception');

-- Pendant la livraison, l'acheteur ne peut plus annuler.
select pg_temp.act(:B);
select pg_temp.expect($$select public.buyer_cancel((select id from public.orders), 'too_slow')$$, 'INVALID_TRANSITION');
select public.my_receipt_code(id) as receipt from public.orders \gset

select pg_temp.act(:C);
select public.courier_arrive(id) from public.orders;
select public.courier_confirm_delivery(id, case when :'receipt' = '0000' then '1111' else '0000' end) as wrong from public.orders \gset
select pg_temp.ok(not :'wrong'::boolean, 'code faux refusé');
select public.courier_confirm_delivery(id, :'receipt') as ok from public.orders \gset
select pg_temp.ok(:'ok'::boolean, 'code juste accepté');
reset role;
do $$ begin assert (select payment from public.orders) = 'delivered' and (select delivered_at from public.orders) is not null, 'livrée'; end $$;
do $$ begin assert (select failed_receipt_attempts from public.order_codes) = 1, 'essai raté compté'; end $$;

-- Le versement au vendeur (rôle service) libère les fonds.
set role service_role;
select public.release_escrow(id) from public.orders;
reset role;
do $$ begin assert (select payment from public.orders) = 'released', 'fonds libérés'; end $$;
do $$ begin assert public.order_net(378000) = '{"items":378000,"commission":37800,"delivery":18900,"net":321300}'::jsonb, 'net vendeur'; end $$;
do $$ begin assert public.mission_pay(4.3, false) = 5200 and public.mission_pay(4.3, true) = 3000, 'paie livreur'; end $$;

-- ── Annulation (D18) : paiement à la livraison, avant la remise ; le stock revient ──
set role authenticated;
select pg_temp.act(:B);
select public.place_checkout(jsonb_build_array(jsonb_build_object('variant_id', (select id from public.product_variants where color = 'Bleu'), 'qty', 1)),
  (select id from public.addresses), 'tomorrow-am', 'cash') as ck2 \gset
do $$ begin assert (select stock from public.product_variants where color = 'Bleu') = 0, 'stock réservé (cash)'; end $$;
select public.buyer_cancel(id, 'cheaper', 'Trouvé moins cher') from public.orders where checkout_id = :'ck2';
reset role;
select pg_temp.ok((select payment from public.orders where checkout_id = :'ck2') = 'failed' and (select refund from public.orders where checkout_id = :'ck2') = 'none', 'annulée sans remboursement');
select pg_temp.ok((select stock from public.product_variants where color = 'Bleu') = 1, 'stock rendu');

-- ── Paiement refusé (C6) puis nouvel essai sur la même commande ──
set role authenticated;
select pg_temp.act(:B);
select public.place_checkout(jsonb_build_array(jsonb_build_object('variant_id', (select id from public.product_variants where color = 'Bleu'), 'qty', 1)),
  (select id from public.addresses), 'asap', 'mobile_money', '+243 850 674 579') as ck3 \gset
reset role;
set role service_role;
select public.payment_result(:'ck3', 1, 'insufficient_funds');
reset role;
select pg_temp.ok((select hold_until from public.checkouts where id = :'ck3') > now(), 'commande gardée 30 min');
set role authenticated;
select pg_temp.act(:B);
select public.retry_payment(:'ck3', 'mobile_money', '0812345678') as attempt \gset
select pg_temp.ok(:'attempt' = 2, 'deuxième essai');
reset role;
set role service_role;
select public.payment_result(:'ck3', 1, 'approved');  -- réponse de l'ancien essai : ignorée
reset role;
select pg_temp.ok((select status from public.checkouts where id = :'ck3') = 'pending', 'ancien essai ignoré');

-- ── Litige (D4) pendant la livraison ──
set role service_role;
select public.payment_result(:'ck3', 2, 'approved');
reset role;
update public.orders set seller = 'handed_over', delivery = 'delivering', payment = 'in_delivery', courier_id = :C where checkout_id = :'ck3';
set role authenticated;
select pg_temp.act(:B);
select pg_temp.expect(format($$select public.buyer_open_dispute('%s', 'not_as_described', 'Couleur différente de la photo', '{}')$$, (select id from public.orders where checkout_id = :'ck3')), 'PROOF_REQUIRED');
select public.buyer_open_dispute(id, 'not_as_described', 'Couleur différente de la photo', array[:B || '/litige/1.jpg']) from public.orders where checkout_id = :'ck3';
select public.buyer_dispute_note(id, 'Le vendeur ne répond pas.') from public.orders where checkout_id = :'ck3';
select pg_temp.act(:C);
select pg_temp.expect(format($$select public.courier_confirm_delivery('%s', '0000')$$, (select id from public.orders where checkout_id = :'ck3')), 'DISPUTED');
select pg_temp.act(:S);
do $$ begin assert (select count(*) from public.disputes) = 1, 'la vendeuse voit le litige'; end $$;
select pg_temp.expect(format($$select public.decide_dispute('%s', 'refund')$$, (select id from public.orders where checkout_id = :'ck3')), 'NOT_FOUND');
select pg_temp.act(:A);
select public.decide_dispute(id, 'refund') from public.orders where checkout_id = :'ck3';
reset role;
select pg_temp.ok((select payment from public.orders where checkout_id = :'ck3') = 'refunded', 'acheteur remboursé');

-- ── Fil social : publication, commentaires, modération ──
set role authenticated;
select pg_temp.act(:S);
insert into public.posts (shop_id, kind, caption, media_paths, status) values (public.my_shop_id(), 'photo', 'Nouveau Flip 6', array[:S || '/posts/1.jpg'], 'published');
select pg_temp.expect($$update public.posts set status = 'masked'$$, 'P0001');
insert into public.post_products (post_id, product_id) select (select id from public.posts), id from public.products;
select pg_temp.act(:B);
insert into public.post_likes (post_id, user_id) select id, :B from public.posts;
insert into public.comments (post_id, author_id, text) select id, :B, 'Livraison à Kalamu ?' from public.posts;
insert into public.follows (user_id, shop_id) select :B, id from public.shops;
select pg_temp.act(:X);
do $$ begin assert (select likes from public.post_counts) = 1 and (select comments from public.post_counts) = 1, 'compteurs'; end $$;
do $$ begin assert (select count(*) from public.post_likes) = 0, 'on ne voit pas qui a aimé'; end $$;
do $$ begin assert (select followers from public.shop_counts) = 1, 'abonnés'; end $$;
select pg_temp.act(:S);
select public.moderate_comment(id, 'hide') from public.comments;
select pg_temp.act(:X);
do $$ begin assert (select count(*) from public.comments) = 0, 'commentaire masqué invisible'; end $$;
select pg_temp.act(:B);
do $$ begin assert (select count(*) from public.comments) = 1, 'l’auteur voit encore le sien'; end $$;
reset role;

-- ── Fichiers : chacun dans son dossier ──
set role authenticated;
select pg_temp.act(:B);
insert into storage.objects (bucket_id, name) values ('private', :B || '/litige/1.jpg');
select pg_temp.expect(format($$insert into storage.objects (bucket_id, name) values ('media', '%s/x.jpg')$$, :S), '42501');
select pg_temp.act(:S);
do $$ begin assert (select count(*) from storage.objects where bucket_id = 'private') = 0, 'pièces privées des autres invisibles'; end $$;
reset role;

-- ── E-mail ajouté en A7 : recopié dans le profil seulement une fois confirmé ──
update auth.users set email = 'jean@exemple.cd' where id = :B;
select pg_temp.ok((select email from public.profiles where id = :B) is null, 'e-mail non confirmé non recopié');
update auth.users set email_confirmed_at = now() where id = :B;
select pg_temp.ok((select email from public.profiles where id = :B) = 'jean@exemple.cd', 'e-mail confirmé recopié');

select 'tous les tests passent' as resultat;
