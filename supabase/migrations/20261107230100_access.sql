-- YA YO · qui peut lire et écrire quoi (Row Level Security).
-- Principe : le téléphone ne change jamais un statut de commande lui-même.
-- Les tables de commandes sont en lecture seule pour les utilisateurs ; chaque
-- étape passe par une fonction de 20261107230200_orders.sql qui vérifie la règle.

-- ───────────────────────── Aides ─────────────────────────

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false)
$$;

create or replace function public.my_shop_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select id from public.shops where owner_id = auth.uid()
$$;

create or replace function public.shop_is_public(p_shop uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.shops s join public.profiles p on p.id = s.owner_id
                 where s.id = p_shop and s.status = 'approved' and not p.suspended)
$$;

create or replace function public.product_is_visible(p_product uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.products pr where pr.id = p_product
                 and ((pr.status = 'active' and public.shop_is_public(pr.shop_id)) or pr.shop_id = public.my_shop_id()))
$$;

create or replace function public.can_see_order(p_order uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.orders o where o.id = p_order
                 and (o.buyer_id = auth.uid() or o.shop_id = public.my_shop_id() or o.courier_id = auth.uid()))
         or public.is_admin()
$$;

create or replace function public.post_is_visible(p_post uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.posts po where po.id = p_post
                 and (((po.status = 'published' or (po.status = 'scheduled' and po.publish_at <= now()))
                       and public.shop_is_public(po.shop_id))
                      or po.shop_id = public.my_shop_id()))
$$;

-- Nouveau compte Supabase Auth → profil. Supabase garde le téléphone sans « + ».
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, phone, email)
  values (new.id,
          case when new.phone is not null and new.phone <> '' then '+' || ltrim(new.phone, '+') end,
          nullif(new.email, ''));
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ───────────────────────── Droits par colonne ─────────────────────────
-- Supabase donne par défaut tous les droits aux rôles anon et authenticated ;
-- on les reprend puis on ne rend que ce qui est permis.

revoke insert, update, delete on all tables in schema public from anon, authenticated;
revoke usage on all sequences in schema public from anon, authenticated;
-- Codes secrets et codes promo : jamais lus directement, même vides.
revoke all on public.order_codes, public.promo_codes from anon, authenticated;

grant update (name, city, commune, onboarded_at) on public.profiles to authenticated;

grant insert (owner_id, name, handle, category, tagline, city, commune, pickup_address, avatar_path, prep_min_hours, prep_max_hours, accepts_cash, payout_phone)
  on public.shops to authenticated;
grant update (name, tagline, city, commune, pickup_address, avatar_path, prep_min_hours, prep_max_hours, accepts_cash, payout_phone)
  on public.shops to authenticated;
grant insert (shop_id, id_document_path, selfie_path) on public.shop_kyc to authenticated;
grant update (id_document_path, selfie_path, submitted_at) on public.shop_kyc to authenticated;

grant insert (shop_id, category_id, name, short_name, description, price, compare_at, status, low_stock) on public.products to authenticated;
grant update (category_id, name, short_name, description, price, compare_at, status, low_stock, updated_at) on public.products to authenticated;
grant delete on public.products to authenticated;
grant insert, update (color, stock), delete on public.product_variants to authenticated;
grant insert, update (path), delete on public.product_photos to authenticated;

grant insert, update (label, street, commune, city, landmark, phone, is_default), delete on public.addresses to authenticated;
grant insert, delete on public.favorites to authenticated;

grant insert (user_id, transport, plate, zone, payout_phone, id_document_path, license_path) on public.couriers to authenticated;
grant update (transport, plate, zone, payout_phone, id_document_path, license_path, online) on public.couriers to authenticated;

grant insert, delete on public.follows to authenticated;
grant insert (shop_id, kind, caption, media_paths, video_path, poster_path, status, publish_at, buy_button, comments_enabled) on public.posts to authenticated;
grant update (caption, media_paths, video_path, poster_path, status, publish_at, buy_button, comments_enabled) on public.posts to authenticated;
grant delete on public.posts to authenticated;
grant insert, update (position), delete on public.post_products to authenticated;
grant insert, delete on public.post_likes to authenticated;
grant insert, update (folder), delete on public.post_saves to authenticated;
grant insert (post_id, author_id, reply_to, text) on public.comments to authenticated;
grant delete on public.comments to authenticated;
grant insert (reporter_id, post_id, comment_id, reason) on public.reports to authenticated;
grant insert (shop_id, name, cover_path, published), update (name, cover_path, published), delete on public.collections to authenticated;
grant insert, update (position), delete on public.collection_products to authenticated;
grant insert (user_id, text) on public.support_messages to authenticated;

-- ───────────────────────── Politiques ─────────────────────────

alter table public.profiles enable row level security;
create policy "profil : le sien" on public.profiles for select using (id = auth.uid() or public.is_admin());
create policy "profil : modifier le sien" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

alter table public.shops enable row level security;
create policy "boutique : publique si validée" on public.shops for select using (public.shop_is_public(id) or owner_id = auth.uid() or public.is_admin());
create policy "boutique : en ouvrir une" on public.shops for insert with check (owner_id = auth.uid());
create policy "boutique : modifier la sienne" on public.shops for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

alter table public.shop_kyc enable row level security;
create policy "kyc : la sienne" on public.shop_kyc for select using (shop_id = public.my_shop_id() or public.is_admin());
create policy "kyc : envoyer" on public.shop_kyc for insert with check (shop_id = public.my_shop_id());
create policy "kyc : renvoyer" on public.shop_kyc for update using (shop_id = public.my_shop_id());

alter table public.categories enable row level security;
create policy "catégories : tout le monde" on public.categories for select using (true);

alter table public.products enable row level security;
create policy "produit : visible" on public.products for select using (public.product_is_visible(id) or public.is_admin());
create policy "produit : créer dans sa boutique" on public.products for insert with check (shop_id = public.my_shop_id());
create policy "produit : modifier le sien" on public.products for update using (shop_id = public.my_shop_id()) with check (shop_id = public.my_shop_id());
create policy "produit : supprimer le sien" on public.products for delete using (shop_id = public.my_shop_id());

alter table public.product_variants enable row level security;
create policy "variante : visible" on public.product_variants for select using (public.product_is_visible(product_id));
create policy "variante : gérer les siennes" on public.product_variants for all
  using (exists (select 1 from public.products p where p.id = product_id and p.shop_id = public.my_shop_id()))
  with check (exists (select 1 from public.products p where p.id = product_id and p.shop_id = public.my_shop_id()));

alter table public.product_photos enable row level security;
create policy "photo : visible" on public.product_photos for select using (public.product_is_visible(product_id));
create policy "photo : gérer les siennes" on public.product_photos for all
  using (exists (select 1 from public.products p where p.id = product_id and p.shop_id = public.my_shop_id()))
  with check (exists (select 1 from public.products p where p.id = product_id and p.shop_id = public.my_shop_id()));

alter table public.addresses enable row level security;
create policy "adresse : les siennes" on public.addresses for all using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table public.favorites enable row level security;
create policy "favori : les siens" on public.favorites for all using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table public.promo_codes enable row level security; -- lus seulement par les fonctions.
alter table public.delivery_slots enable row level security;
create policy "créneaux : tout le monde" on public.delivery_slots for select using (active);

alter table public.checkouts enable row level security;
create policy "paiement : le sien" on public.checkouts for select using (buyer_id = auth.uid() or public.is_admin());

alter table public.orders enable row level security;
create policy "commande : acheteur, vendeur, livreur" on public.orders for select using (public.can_see_order(id));

alter table public.order_codes enable row level security; -- aucune lecture directe.

alter table public.order_lines enable row level security;
create policy "ligne : avec sa commande" on public.order_lines for select using (public.can_see_order(order_id));

alter table public.order_events enable row level security;
create policy "journal : avec sa commande" on public.order_events for select
  using ((order_id is not null and public.can_see_order(order_id)) or public.is_admin());

alter table public.disputes enable row level security;
create policy "litige : acheteur et vendeur" on public.disputes for select
  using (exists (select 1 from public.orders o where o.id = order_id and (o.buyer_id = auth.uid() or o.shop_id = public.my_shop_id())) or public.is_admin());

alter table public.dispute_notes enable row level security;
create policy "note de litige : avec le litige" on public.dispute_notes for select
  using (exists (select 1 from public.disputes d join public.orders o on o.id = d.order_id
                 where d.id = dispute_id and (o.buyer_id = auth.uid() or o.shop_id = public.my_shop_id())) or public.is_admin());

alter table public.order_ratings enable row level security;
create policy "note : acheteur et vendeur" on public.order_ratings for select
  using (exists (select 1 from public.orders o where o.id = order_id and (o.buyer_id = auth.uid() or o.shop_id = public.my_shop_id())) or public.is_admin());

alter table public.couriers enable row level security;
create policy "livreur : son profil" on public.couriers for select using (user_id = auth.uid() or public.is_admin());
create policy "livreur : s'inscrire" on public.couriers for insert with check (user_id = auth.uid());
create policy "livreur : modifier" on public.couriers for update using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table public.cash_remittances enable row level security;
create policy "dépôt : les siens" on public.cash_remittances for select using (courier_id = auth.uid() or public.is_admin());

alter table public.follows enable row level security;
create policy "abonnement : les siens" on public.follows for all using (user_id = auth.uid()) with check (user_id = auth.uid() and public.shop_is_public(shop_id));

alter table public.posts enable row level security;
create policy "publication : visible" on public.posts for select using (public.post_is_visible(id) or public.is_admin());
create policy "publication : créer" on public.posts for insert with check (shop_id = public.my_shop_id() and status <> 'masked');
create policy "publication : modifier" on public.posts for update using (shop_id = public.my_shop_id()) with check (shop_id = public.my_shop_id());
create policy "publication : supprimer" on public.posts for delete using (shop_id = public.my_shop_id());

-- Une publication masquée par la modération ne se réaffiche que par une décision de YA YO (SV9).
create or replace function public.guard_post_status() returns trigger
language plpgsql set search_path = '' as $$
begin
  if public.is_admin() or current_user in ('postgres', 'service_role') then return new; end if;
  if old.status = 'masked' and new.status <> old.status then
    raise exception 'Publication masquée : conteste la décision depuis l’app.' using errcode = 'P0001';
  end if;
  if new.status = 'masked' and old.status <> 'masked' then
    raise exception 'Seule la modération YA YO masque une publication.' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger posts_guard_status before update of status on public.posts for each row execute function public.guard_post_status();

alter table public.post_products enable row level security;
create policy "produits liés : visibles" on public.post_products for select using (public.post_is_visible(post_id));
create policy "produits liés : gérer" on public.post_products for all
  using (exists (select 1 from public.posts p where p.id = post_id and p.shop_id = public.my_shop_id()))
  with check (exists (select 1 from public.posts p where p.id = post_id and p.shop_id = public.my_shop_id())
              and exists (select 1 from public.products pr where pr.id = product_id and pr.shop_id = public.my_shop_id()));

alter table public.post_likes enable row level security;
create policy "j'aime : les siens" on public.post_likes for all using (user_id = auth.uid()) with check (user_id = auth.uid() and public.post_is_visible(post_id));

alter table public.post_saves enable row level security;
create policy "enregistrement : les siens" on public.post_saves for all using (user_id = auth.uid()) with check (user_id = auth.uid() and public.post_is_visible(post_id));

alter table public.comments enable row level security;
create policy "commentaire : visible" on public.comments for select
  using (public.post_is_visible(post_id) and (status = 'visible' or author_id = auth.uid()
         or exists (select 1 from public.posts p where p.id = post_id and p.shop_id = public.my_shop_id())));
create policy "commentaire : écrire" on public.comments for insert
  with check (author_id = auth.uid()
              and exists (select 1 from public.posts p where p.id = post_id and p.comments_enabled and public.post_is_visible(p.id)));
create policy "commentaire : supprimer le sien" on public.comments for delete using (author_id = auth.uid());

alter table public.reports enable row level security;
create policy "signalement : envoyer" on public.reports for insert with check (reporter_id = auth.uid());

alter table public.collections enable row level security;
create policy "collection : visible" on public.collections for select using ((published and public.shop_is_public(shop_id)) or shop_id = public.my_shop_id());
create policy "collection : gérer" on public.collections for all using (shop_id = public.my_shop_id()) with check (shop_id = public.my_shop_id());

alter table public.collection_products enable row level security;
create policy "collection : produits visibles" on public.collection_products for select
  using (exists (select 1 from public.collections c where c.id = collection_id
                 and ((c.published and public.shop_is_public(c.shop_id)) or c.shop_id = public.my_shop_id())));
create policy "collection : gérer les produits" on public.collection_products for all
  using (exists (select 1 from public.collections c where c.id = collection_id and c.shop_id = public.my_shop_id()))
  with check (exists (select 1 from public.collections c where c.id = collection_id and c.shop_id = public.my_shop_id()));

alter table public.support_messages enable row level security;
create policy "support : ses messages" on public.support_messages for select using (user_id = auth.uid() or public.is_admin());
create policy "support : écrire" on public.support_messages for insert with check (user_id = auth.uid() and not from_agent);

-- ───────────────────────── Compteurs publics ─────────────────────────
-- Les vues tournent avec les droits de leur propriétaire : elles donnent les
-- totaux sans révéler qui a aimé ou qui suit.

create view public.post_counts as
  select p.id as post_id,
         (select count(*) from public.post_likes l where l.post_id = p.id)::int as likes,
         (select count(*) from public.comments c where c.post_id = p.id and c.status = 'visible')::int as comments,
         (select count(*) from public.post_saves s where s.post_id = p.id)::int as saves
  from public.posts p
  where public.post_is_visible(p.id);

create view public.shop_counts as
  select s.id as shop_id,
         (select count(*) from public.follows f where f.shop_id = s.id)::int as followers,
         (select count(*) from public.products pr where pr.shop_id = s.id and pr.status = 'active')::int as products
  from public.shops s
  where public.shop_is_public(s.id) or s.owner_id = auth.uid();

grant select on public.post_counts, public.shop_counts to anon, authenticated;
