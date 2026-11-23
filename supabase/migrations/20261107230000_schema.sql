-- YA YO · schéma de la base (Supabase / PostgreSQL 15+).
-- Les noms d'états reprennent ceux de l'app (src/domain/types.ts) pour que
-- l'app et la base parlent la même langue. Montants en francs congolais entiers.

create extension if not exists pgcrypto;

-- ───────────────────────── Types ─────────────────────────

create type public.department as enum ('electronique', 'mode', 'beaute', 'maison');
create type public.review_status as enum ('pending', 'approved', 'rejected', 'suspended');
create type public.product_status as enum ('draft', 'active', 'archived');
create type public.payment_method as enum ('mobile_money', 'cash', 'card');
create type public.mobile_money_operator as enum ('M-Pesa', 'Orange Money', 'Airtel Money');
create type public.checkout_status as enum ('awaiting_confirmation', 'pending', 'succeeded', 'failed', 'expired');
create type public.payment_failure as enum ('insufficient_funds', 'expired', 'declined');
create type public.payment_status as enum ('initiated', 'pending', 'held_in_escrow', 'in_delivery', 'delivered', 'released', 'failed', 'refunded', 'disputed');
create type public.seller_status as enum ('new', 'preparing', 'ready', 'handed_over');
create type public.delivery_status as enum ('unassigned', 'assigned', 'picking_up', 'delivering', 'delivered', 'failed');
create type public.cancel_reason as enum ('wrong_item', 'too_slow', 'cheaper', 'other');
create type public.refund_state as enum ('none', 'sent', 'received');
create type public.dispute_reason as enum ('not_received', 'not_as_described', 'missing_item', 'other');
create type public.dispute_outcome as enum ('refund', 'pay_seller');
create type public.incident_reason as enum ('absent', 'refused', 'address', 'damaged');
create type public.transport as enum ('Moto', 'Voiture', 'Vélo', 'À pied');
create type public.post_kind as enum ('video', 'photo');
create type public.post_status as enum ('draft', 'scheduled', 'published', 'masked', 'archived');
create type public.comment_status as enum ('visible', 'masked');

-- ───────────────────────── Comptes ─────────────────────────

-- Un profil par compte Supabase Auth (connexion par SMS ou e-mail, sans mot de passe).
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null default '' check (char_length(name) <= 80),
  phone text unique check (phone ~ '^\+243[0-9]{9}$'),
  email text unique,
  city text,
  commune text,
  is_admin boolean not null default false,
  suspended boolean not null default false,
  onboarded_at timestamptz,
  created_at timestamptz not null default now()
);

-- ───────────────────────── Boutiques ─────────────────────────

create table public.shops (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references public.profiles (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 60),
  handle text not null unique check (handle ~ '^[a-z0-9_.]{3,30}$'),
  category text not null,
  tagline text check (char_length(tagline) <= 120),
  city text not null default 'Kinshasa',
  commune text not null,
  pickup_address text,
  avatar_path text,
  prep_min_hours int not null default 24 check (prep_min_hours > 0),
  prep_max_hours int not null default 48 check (prep_max_hours >= prep_min_hours),
  accepts_cash boolean not null default true,
  -- V2 : la boutique vend après validation de YA YO.
  status public.review_status not null default 'pending',
  verified boolean generated always as (status = 'approved') stored,
  payout_phone text check (payout_phone ~ '^\+243[0-9]{9}$'),
  created_at timestamptz not null default now()
);

-- V2 · pièces d'identité : jamais lisibles par les acheteurs.
create table public.shop_kyc (
  shop_id uuid primary key references public.shops (id) on delete cascade,
  id_document_path text not null,
  selfie_path text not null,
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  review_note text
);

-- ───────────────────────── Catalogue ─────────────────────────

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  department public.department not null,
  position int not null default 0
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete cascade,
  category_id uuid references public.categories (id),
  name text not null check (char_length(name) between 2 and 80),
  short_name text,
  description text not null default '' check (char_length(description) <= 2000),
  price int not null check (price > 0),
  compare_at int check (compare_at is null or compare_at > price),
  status public.product_status not null default 'draft',
  low_stock int not null default 3 check (low_stock >= 0),
  rating numeric(2, 1) not null default 0,
  reviews int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index products_shop_idx on public.products (shop_id);
create index products_active_idx on public.products (status, created_at desc);

-- Une ligne par couleur : c'est elle que le panier et le stock suivent.
create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  color text not null,
  stock int not null default 0 check (stock >= 0),
  unique (product_id, color)
);

-- 6 photos au plus par produit (V12).
create table public.product_photos (
  product_id uuid not null references public.products (id) on delete cascade,
  position int not null check (position between 0 and 5),
  path text not null,
  primary key (product_id, position)
);

-- ───────────────────────── Acheteur ─────────────────────────

create table public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  label text not null check (char_length(label) between 1 and 40),
  street text not null,
  commune text not null,
  city text not null default 'Kinshasa',
  landmark text,
  phone text not null check (phone ~ '^\+243[0-9]{9}$'),
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index addresses_one_default on public.addresses (user_id) where is_default;

create table public.favorites (
  user_id uuid not null references public.profiles (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);

create table public.promo_codes (
  code text primary key check (code = upper(code)),
  percent int not null check (percent between 1 and 90),
  cap int not null check (cap > 0),
  active boolean not null default true,
  ends_at timestamptz
);

-- ───────────────────────── Commandes ─────────────────────────

-- Créneaux de livraison proposés en C2.
create table public.delivery_slots (
  id text primary key,
  label text not null,
  position int not null default 0,
  active boolean not null default true
);

-- Un paiement pour tout le panier ; une commande par vendeur (hypothèse H-01).
create table public.checkouts (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references public.profiles (id),
  amount int not null check (amount > 0),
  method public.payment_method not null,
  operator public.mobile_money_operator,
  msisdn text,
  status public.checkout_status not null default 'awaiting_confirmation',
  attempt int not null default 0,
  requested_at timestamptz,
  expires_at timestamptz,
  -- C6 : les commandes non payées sont gardées 30 min après un échec.
  hold_until timestamptz,
  failure_reason public.payment_failure,
  -- Référence de la transaction chez l'opérateur ou l'agrégateur.
  provider_ref text unique,
  created_at timestamptz not null default now(),
  check (method <> 'mobile_money' or (operator is not null and msisdn is not null))
);

create sequence public.order_number_seq start 24880;

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  -- « YY-24880 », montré partout dans l'app.
  number text not null unique default ('YY-' || nextval('public.order_number_seq')),
  checkout_id uuid not null references public.checkouts (id),
  buyer_id uuid not null references public.profiles (id),
  shop_id uuid not null references public.shops (id),
  items_total int not null check (items_total > 0),
  delivery_fee int not null check (delivery_fee >= 0),
  discount int not null default 0 check (discount >= 0),
  total int not null check (total = items_total + delivery_fee - discount),
  method public.payment_method not null,
  payment public.payment_status not null default 'initiated',
  seller public.seller_status not null default 'new',
  delivery public.delivery_status not null default 'unassigned',
  -- Adresse figée au moment de la commande (l'acheteur peut la modifier ensuite).
  address_id uuid references public.addresses (id) on delete set null,
  dropoff text not null,
  dropoff_phone text not null,
  -- Ce que voit le vendeur (V6) : prénom + initiale et commune, jamais le téléphone.
  buyer_label text not null,
  buyer_commune text not null,
  slot_id text references public.delivery_slots (id),
  courier_note text check (char_length(courier_note) <= 200),
  -- Mission du livreur (L4).
  courier_id uuid references public.profiles (id),
  mission_number text unique,
  distance_km numeric(5, 1),
  proposed_at timestamptz,
  declined_by uuid[] not null default '{}',
  cash_collected boolean,
  -- L9.
  incident_reason public.incident_reason,
  incident_photo_path text,
  incident_at timestamptz,
  -- D18 / D19.
  cancel_reason public.cancel_reason,
  cancel_note text,
  refund public.refund_state,
  refunded_at timestamptz,
  -- Jalons de la frise D2.
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  prepared_at timestamptz,
  accepted_at timestamptz,
  picked_up_at timestamptz,
  arrived_at timestamptz,
  delivered_at timestamptz,
  released_at timestamptz,
  disputed_at timestamptz,
  cancelled_at timestamptz
);
create index orders_buyer_idx on public.orders (buyer_id, created_at desc);
create index orders_shop_idx on public.orders (shop_id, created_at desc);
create index orders_courier_idx on public.orders (courier_id) where courier_id is not null;

-- Codes secrets : jamais lus directement. L'acheteur obtient son code de réception
-- et le vendeur son code de remise par des fonctions qui vérifient le rôle.
create table public.order_codes (
  order_id uuid primary key references public.orders (id) on delete cascade,
  receipt_code text not null check (receipt_code ~ '^[0-9]{4}$'),
  pickup_code text not null check (pickup_code ~ '^[A-Z][0-9]{3}$'),
  failed_receipt_attempts int not null default 0
);

create table public.order_lines (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  variant_id uuid references public.product_variants (id) on delete set null,
  name text not null,
  color text not null,
  qty int not null check (qty between 1 and 20),
  unit_price int not null check (unit_price > 0)
);
create index order_lines_order_idx on public.order_lines (order_id);

-- Journal : qui a fait quoi et quand. On n'y ajoute que des lignes.
create table public.order_events (
  id bigint generated always as identity primary key,
  order_id uuid references public.orders (id) on delete cascade,
  checkout_id uuid references public.checkouts (id) on delete cascade,
  actor text not null check (actor in ('buyer', 'seller', 'courier', 'system', 'payment_provider', 'admin')),
  actor_id uuid,
  type text not null,
  detail text,
  at timestamptz not null default now()
);

create table public.disputes (
  id uuid primary key default gen_random_uuid(),
  number text not null unique,
  order_id uuid not null unique references public.orders (id) on delete cascade,
  reason public.dispute_reason not null,
  description text not null check (char_length(description) between 10 and 1000),
  photo_paths text[] not null default '{}' check (cardinality(photo_paths) <= 4),
  opened_at timestamptz not null default now(),
  outcome public.dispute_outcome,
  decided_at timestamptz,
  decided_by uuid references public.profiles (id)
);

create table public.dispute_notes (
  id bigint generated always as identity primary key,
  dispute_id uuid not null references public.disputes (id) on delete cascade,
  text text not null check (char_length(text) between 1 and 500),
  at timestamptz not null default now()
);

-- Notes après livraison.
create table public.order_ratings (
  order_id uuid primary key references public.orders (id) on delete cascade,
  seller_rating int not null check (seller_rating between 1 and 5),
  courier_rating int check (courier_rating between 1 and 5),
  comment text check (char_length(comment) <= 500),
  at timestamptz not null default now()
);

-- ───────────────────────── Livreurs ─────────────────────────

create table public.couriers (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  transport public.transport not null,
  plate text,
  zone text not null,
  payout_phone text not null check (payout_phone ~ '^\+243[0-9]{9}$'),
  -- L2 · pièces vérifiées par YA YO avant la première mission.
  id_document_path text,
  license_path text,
  status public.review_status not null default 'pending',
  online boolean not null default false,
  rating numeric(2, 1) not null default 0,
  created_at timestamptz not null default now(),
  check (transport not in ('Moto', 'Voiture') or plate is not null)
);

-- L12 · espèces reversées au point de dépôt.
create table public.cash_remittances (
  id uuid primary key default gen_random_uuid(),
  courier_id uuid not null references public.couriers (user_id),
  amount int not null check (amount > 0),
  order_ids uuid[] not null,
  confirmed_by uuid references public.profiles (id),
  at timestamptz not null default now()
);

-- ───────────────────────── Fil social ─────────────────────────

create table public.follows (
  user_id uuid not null references public.profiles (id) on delete cascade,
  shop_id uuid not null references public.shops (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, shop_id)
);

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete cascade,
  kind public.post_kind not null,
  caption text not null default '' check (char_length(caption) <= 2200),
  media_paths text[] not null default '{}' check (cardinality(media_paths) <= 10),
  video_path text,
  poster_path text,
  status public.post_status not null default 'draft',
  publish_at timestamptz,
  -- SV9 : masquée par la modération, avec le motif montré au vendeur.
  masked_reason text,
  buy_button boolean not null default true,
  comments_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  check (kind <> 'video' or video_path is not null or status = 'draft'),
  check (status <> 'scheduled' or publish_at is not null)
);
create index posts_feed_idx on public.posts (status, publish_at desc nulls last, created_at desc);

create table public.post_products (
  post_id uuid not null references public.posts (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  position int not null default 0,
  primary key (post_id, product_id)
);

create table public.post_likes (
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  primary key (post_id, user_id)
);

create table public.post_saves (
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  folder text not null default 'Tous',
  primary key (post_id, user_id)
);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  reply_to uuid references public.comments (id) on delete cascade,
  text text not null check (char_length(text) between 1 and 300),
  status public.comment_status not null default 'visible',
  auto_masked boolean not null default false,
  pinned boolean not null default false,
  created_at timestamptz not null default now()
);
create index comments_post_idx on public.comments (post_id, created_at);

create table public.reports (
  id bigint generated always as identity primary key,
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  post_id uuid references public.posts (id) on delete cascade,
  comment_id uuid references public.comments (id) on delete cascade,
  reason text not null,
  at timestamptz not null default now(),
  check ((post_id is null) <> (comment_id is null))
);

create table public.collections (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  cover_path text,
  published boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.collection_products (
  collection_id uuid not null references public.collections (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  position int not null default 0,
  primary key (collection_id, product_id)
);

-- ───────────────────────── Support ─────────────────────────

create table public.support_messages (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  from_agent boolean not null default false,
  text text not null check (char_length(text) between 1 and 1000),
  at timestamptz not null default now()
);
