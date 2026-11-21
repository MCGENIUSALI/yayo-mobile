import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizePhone } from '@/domain/auth';
import { detectOperator } from '@/domain/paymentProvider';
import {
  kycError,
  productFields,
  profileError,
  type Kyc,
  type Photo,
  type ProductDraft,
  type ProductStatus,
  type SellerProduct,
  type SellerSpace,
  type ShopProfile,
  type ShopStatus,
} from '@/domain/seller';
import { supabase } from '@/lib/supabase';

/**
 * Espace vendeur en mode serveur (V1, V2, V3, V8 à V10, V13 à V15).
 * Les règles de saisie restent celles de src/domain/seller.ts ; la base
 * vérifie en plus qui écrit quoi (RLS) et la validation reste à YA YO.
 */

export type SellerFailure = { ok: false; code: string; message: string };
const fail = (code: string, message: string): SellerFailure => ({ ok: false, code, message });
const NETWORK = fail('NETWORK', 'Pas de connexion au serveur YA YO. Vérifie ton réseau puis réessaie.');
const SERVER = fail('SERVER', 'Le serveur YA YO n’a pas pu enregistrer. Réessaie dans un instant.');
const DEMO_PHOTO = fail('DEMO_PHOTO', 'Choisis une photo depuis ton téléphone (appareil photo ou galerie).');

/** Opening hours are not stored on the server yet: the V1 default is shown. */
export const DEFAULT_HOURS = 'Lun–Sam, 8h–18h';

const DB_STATUS: Record<ProductStatus, 'active' | 'archived' | 'draft'> = { online: 'active', offline: 'archived', draft: 'draft' };
const APP_STATUS: Record<string, ProductStatus> = { active: 'online', archived: 'offline', draft: 'draft' };

function client(c?: SupabaseClient | null): SupabaseClient {
  const x = c ?? supabase;
  if (!x) throw new Error('Supabase non configuré');
  return x;
}

/* ---------- Mapping ---------- */

export interface SellerShopRow {
  id: string;
  name: string;
  category: string;
  commune: string;
  pickup_address: string | null;
  avatar_path: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'suspended';
  payout_phone: string | null;
}

export interface SellerKycRow {
  id_document_path: string;
  selfie_path: string;
  submitted_at: string;
}

export interface SellerProductRow {
  id: string;
  name: string;
  description: string;
  price: number;
  compare_at: number | null;
  stock: number;
  status: string;
  rating: number | string;
  reviews: number;
  updated_at: string;
  categories: { name: string } | null;
  product_variants: { color: string }[];
  product_photos: { position: number; path: string }[];
}

/**
 * Shop review → V3 state. A shop under review, refused or suspended stays
 * « dossier envoyé » in the app; YA YO tells the seller why (support).
 */
export function shopStatus(row: SellerShopRow, kyc: SellerKycRow | null): ShopStatus {
  if (row.status === 'approved') return 'verified';
  return kyc ? 'submitted' : 'draft';
}

export function toSellerProduct(r: SellerProductRow, publicUrl: (path: string) => string): SellerProduct {
  return {
    id: r.id,
    name: r.name,
    category: r.categories?.name ?? '',
    description: r.description,
    photos: [...r.product_photos].sort((a, b) => a.position - b.position).map((p) => publicUrl(p.path)),
    price: r.price,
    compareAt: r.compare_at ?? undefined,
    stock: r.stock,
    colors: r.product_variants.map((v) => v.color).filter(Boolean),
    status: APP_STATUS[r.status] ?? 'draft',
    rating: Number(r.rating) || undefined,
    reviews: r.reviews || undefined,
    updatedAt: r.updated_at,
  };
}

export function toSellerSpace(
  accountId: string,
  row: SellerShopRow,
  kyc: SellerKycRow | null,
  products: SellerProduct[],
  files: { publicUrl: (path: string) => string; signed: Record<string, string> },
): SellerSpace {
  const status = shopStatus(row, kyc);
  return {
    accountId,
    shopId: row.id,
    status,
    profile: {
      name: row.name,
      category: row.category,
      commune: row.commune,
      pickupAddress: row.pickup_address ?? '',
      logo: row.avatar_path ? files.publicUrl(row.avatar_path) : undefined,
      hours: DEFAULT_HOURS,
    },
    kyc: kyc
      ? {
          idDoc: files.signed[kyc.id_document_path],
          selfie: files.signed[kyc.selfie_path],
          payoutPhone: row.payout_phone ?? '',
        }
      : undefined,
    submittedAt: kyc?.submitted_at,
    products,
    withdrawals: [],
    readNotifications: [],
    productSeq: 0,
  };
}

/** "Mama Luka Mode" → "mamalukamode" + 4 digits, within the handle rule of the base (a–z, 0–9, 3 à 30). */
export function makeHandle(name: string, random = Math.random): string {
  const base =
    name
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .slice(0, 20) || 'boutique';
  return `${base}${String(Math.floor(random() * 10_000)).padStart(4, '0')}`;
}

/* ---------- Files ---------- */

const MEDIA_MARK = '/storage/v1/object/public/media/';

/** A photo already on the server (public URL) → its path in the bucket. */
export function mediaPath(photo: Photo): string | null {
  if (typeof photo !== 'string') return null;
  const i = photo.indexOf(MEDIA_MARK);
  return i >= 0 ? decodeURIComponent(photo.slice(i + MEDIA_MARK.length).split('?')[0]!) : null;
}

function contentType(uri: string): string {
  const ext = uri.split('?')[0]!.split('.').pop()?.toLowerCase();
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  return 'image/jpeg';
}

/** Uploads a photo picked on the phone; demo pictures (bundled images) are refused. */
async function upload(db: SupabaseClient, bucket: 'media' | 'private', path: string, photo: Photo): Promise<string | SellerFailure> {
  if (typeof photo !== 'string') return DEMO_PHOTO;
  try {
    const body = await (await fetch(photo)).arrayBuffer();
    const type = contentType(photo);
    const full = `${path}.${type.split('/')[1] === 'jpeg' ? 'jpg' : type.split('/')[1]}`;
    const { error } = await db.storage.from(bucket).upload(full, body, { contentType: type, upsert: true });
    return error ? fail('UPLOAD', 'La photo n’a pas pu être envoyée. Vérifie ton réseau puis réessaie.') : full;
  } catch {
    return fail('UPLOAD', 'La photo n’a pas pu être envoyée. Vérifie ton réseau puis réessaie.');
  }
}

const isFailure = (x: unknown): x is SellerFailure => typeof x === 'object' && x !== null && (x as { ok?: boolean }).ok === false;
const stamp = () => Date.now().toString(36);

/* ---------- Read ---------- */

const PRODUCT_COLUMNS = 'id, name, description, price, compare_at, stock, status, rating, reviews, updated_at, categories(name), product_variants(color), product_photos(position, path)';

/** The seller space of the account, or null if V1 was never saved. */
export async function loadSellerSpace(accountId: string, c?: SupabaseClient | null): Promise<SellerSpace | null> {
  const db = client(c);
  const shop = await db.from('shops').select('id, name, category, commune, pickup_address, avatar_path, status, payout_phone').eq('owner_id', accountId).maybeSingle();
  if (shop.error) throw shop.error;
  if (!shop.data) return null;
  const row = shop.data as SellerShopRow;
  const [kycRes, productRes] = await Promise.all([
    db.from('shop_kyc').select('id_document_path, selfie_path, submitted_at').eq('shop_id', row.id).maybeSingle(),
    db.from('products').select(PRODUCT_COLUMNS).eq('shop_id', row.id).order('updated_at', { ascending: false }),
  ]);
  if (kycRes.error) throw kycRes.error;
  if (productRes.error) throw productRes.error;
  const kyc = (kycRes.data as SellerKycRow | null) ?? null;
  const publicUrl = (path: string) => db.storage.from('media').getPublicUrl(path).data.publicUrl;
  const signed: Record<string, string> = {};
  if (kyc) {
    const { data } = await db.storage.from('private').createSignedUrls([kyc.id_document_path, kyc.selfie_path], 3600);
    for (const s of data ?? []) if (s.path && s.signedUrl) signed[s.path] = s.signedUrl;
  }
  const products = (productRes.data as unknown as SellerProductRow[]).map((r) => toSellerProduct(r, publicUrl));
  return toSellerSpace(accountId, row, kyc, products, { publicUrl, signed });
}

export type SellerWrite = { ok: true; space: SellerSpace } | SellerFailure;

async function reload(accountId: string, db: SupabaseClient): Promise<SellerWrite> {
  try {
    const space = await loadSellerSpace(accountId, db);
    return space ? { ok: true, space } : SERVER;
  } catch {
    return NETWORK;
  }
}

/* ---------- V1 · Boutique ---------- */

export async function saveShopProfile(accountId: string, profile: ShopProfile, c?: SupabaseClient | null): Promise<SellerWrite> {
  const err = profileError(profile);
  if (err) return fail('INVALID_PROFILE', err);
  try {
    const db = client(c);
    const existing = await db.from('shops').select('id, avatar_path').eq('owner_id', accountId).maybeSingle();
    if (existing.error) return SERVER;
    let avatar_path: string | null | undefined = existing.data?.avatar_path ?? null;
    if (!profile.logo) avatar_path = null;
    else if (!mediaPath(profile.logo)) {
      const up = await upload(db, 'media', `${accountId}/shop/logo-${stamp()}`, profile.logo);
      if (isFailure(up)) return up;
      avatar_path = up;
    }
    const fields = {
      name: profile.name.trim().replace(/\s+/g, ' '),
      category: profile.category,
      commune: profile.commune,
      pickup_address: profile.pickupAddress.trim(),
      avatar_path,
    };
    if (existing.data) {
      const { error } = await db.from('shops').update(fields).eq('id', existing.data.id);
      if (error) return SERVER;
    } else {
      // The handle must be unique: a new random suffix on a collision.
      let done = false;
      for (let i = 0; i < 3 && !done; i++) {
        const { error } = await db.from('shops').insert({ ...fields, owner_id: accountId, handle: makeHandle(fields.name) });
        if (!error) done = true;
        else if (error.code !== '23505') return SERVER;
      }
      if (!done) return SERVER;
    }
    return reload(accountId, db);
  } catch {
    return NETWORK;
  }
}

/* ---------- V2 · Vérification ---------- */

/** Sends the identity documents and the payout number. YA YO reviews them; the app never approves a shop. */
export async function submitShopKyc(accountId: string, kyc: Kyc, c?: SupabaseClient | null): Promise<SellerWrite> {
  const err = kycError(kyc);
  if (err) return fail('INVALID_KYC', err);
  try {
    const db = client(c);
    const shop = await db.from('shops').select('id, status').eq('owner_id', accountId).maybeSingle();
    if (shop.error) return SERVER;
    if (!shop.data) return fail('NO_SHOP', 'Crée d’abord ta boutique.');
    if (shop.data.status === 'approved') return fail('ALREADY_VERIFIED', 'Ta boutique est déjà vérifiée.');
    const id = await upload(db, 'private', `${accountId}/kyc/piece-${stamp()}`, kyc.idDoc!);
    if (isFailure(id)) return id;
    const selfie = await upload(db, 'private', `${accountId}/kyc/selfie-${stamp()}`, kyc.selfie!);
    if (isFailure(selfie)) return selfie;
    const phone = normalizePhone(kyc.payoutPhone)!;
    const { error: shopErr } = await db.from('shops').update({ payout_phone: phone }).eq('id', shop.data.id);
    if (shopErr) return SERVER;
    // No upsert: the seller may insert (shop_id, files) and later update (files, submitted_at), nothing more (grants).
    const sent = await db.from('shop_kyc').select('shop_id').eq('shop_id', shop.data.id).maybeSingle();
    if (sent.error) return SERVER;
    const { error } = sent.data
      ? await db.from('shop_kyc').update({ id_document_path: id, selfie_path: selfie, submitted_at: new Date().toISOString() }).eq('shop_id', shop.data.id)
      : await db.from('shop_kyc').insert({ shop_id: shop.data.id, id_document_path: id, selfie_path: selfie });
    if (error) return SERVER;
    return reload(accountId, db);
  } catch {
    return NETWORK;
  }
}

/** V12 · Compte de virement. */
export async function saveShopPayout(accountId: string, phoneInput: string, c?: SupabaseClient | null): Promise<SellerWrite> {
  const phone = normalizePhone(phoneInput);
  if (!phone || !detectOperator(phone.slice(4))) return fail('INVALID_PHONE', 'Saisis un numéro M-Pesa, Orange Money ou Airtel Money.');
  try {
    const db = client(c);
    const { error } = await db.from('shops').update({ payout_phone: phone }).eq('owner_id', accountId);
    if (error) return SERVER;
    return reload(accountId, db);
  } catch {
    return NETWORK;
  }
}

/* ---------- V8 à V10, V13 à V15 · Produits ---------- */

export async function saveSellerProduct(
  accountId: string,
  shopId: string,
  id: string | undefined,
  draft: ProductDraft,
  status: ProductStatus,
  c?: SupabaseClient | null,
): Promise<SellerWrite & { id?: string }> {
  const r = productFields(draft, status, new Date().toISOString());
  if (!r.ok) return fail(r.code, r.message);
  const f = r.fields;
  if (f.photos.some((p) => typeof p !== 'string')) return DEMO_PHOTO;
  try {
    const db = client(c);
    const cat = await db.from('categories').select('id').eq('name', f.category).maybeSingle();
    if (cat.error) return SERVER;
    const row = {
      name: f.name,
      description: f.description,
      price: f.price,
      compare_at: f.compareAt ?? null,
      stock: f.stock,
      status: DB_STATUS[f.status],
      category_id: cat.data?.id ?? null,
    };
    let productId = id;
    if (productId) {
      const { error } = await db.from('products').update({ ...row, updated_at: f.updatedAt }).eq('id', productId);
      if (error) return SERVER;
    } else {
      const { data, error } = await db.from('products').insert({ ...row, shop_id: shopId }).select('id').single();
      if (error || !data) return SERVER;
      productId = data.id as string;
    }

    // Photos: the ones already online keep their file, new ones are uploaded. The first is the cover (V9).
    const paths: string[] = [];
    for (const [i, photo] of f.photos.entries()) {
      const known = mediaPath(photo);
      if (known) paths.push(known);
      else {
        const up = await upload(db, 'media', `${accountId}/products/${productId}/${stamp()}-${i}`, photo);
        if (isFailure(up)) return up;
        paths.push(up);
      }
    }
    const { error: delPhotos } = await db.from('product_photos').delete().eq('product_id', productId);
    if (delPhotos) return SERVER;
    const { error: insPhotos } = await db.from('product_photos').insert(paths.map((path, position) => ({ product_id: productId, position, path })));
    if (insPhotos) return SERVER;

    // Colors are the buyer's choice (variants); the stock is shared. No color: one plain variant.
    const wanted = f.colors.length ? f.colors : [''];
    const current = await db.from('product_variants').select('id, color').eq('product_id', productId);
    if (current.error) return SERVER;
    const have = (current.data as { id: string; color: string }[]) ?? [];
    const drop = have.filter((v) => !wanted.includes(v.color)).map((v) => v.id);
    if (drop.length) {
      const { error } = await db.from('product_variants').delete().in('id', drop);
      if (error) return SERVER;
    }
    const add = wanted.filter((color) => !have.some((v) => v.color === color));
    if (add.length) {
      const { error } = await db.from('product_variants').insert(add.map((color) => ({ product_id: productId, color })));
      if (error) return SERVER;
    }
    const out = await reload(accountId, db);
    return out.ok ? { ...out, id: productId } : out;
  } catch {
    return NETWORK;
  }
}

export async function setSellerProductOnline(accountId: string, product: SellerProduct, online: boolean, c?: SupabaseClient | null): Promise<SellerWrite> {
  if (online && product.photos.length === 0) return fail('NO_PHOTO', 'Ajoute une photo avant de mettre le produit en ligne.');
  if (online && product.price <= 0) return fail('NO_PRICE', 'Indique un prix avant de mettre le produit en ligne.');
  try {
    const db = client(c);
    const { error } = await db
      .from('products')
      .update({ status: online ? 'active' : 'archived', updated_at: new Date().toISOString() })
      .eq('id', product.id);
    if (error) return SERVER;
    return reload(accountId, db);
  } catch {
    return NETWORK;
  }
}

/** V15: the orders keep their own copy of the lines, nothing in progress is cancelled. */
export async function deleteSellerProduct(accountId: string, productId: string, c?: SupabaseClient | null): Promise<SellerWrite> {
  try {
    const db = client(c);
    const { error } = await db.from('products').delete().eq('id', productId);
    if (error) return SERVER;
    return reload(accountId, db);
  } catch {
    return NETWORK;
  }
}

/** V7 « Signaler une rupture » : the products go to 0 in stock. */
export async function markSellerOutOfStock(accountId: string, productIds: string[], c?: SupabaseClient | null): Promise<SellerWrite> {
  try {
    const db = client(c);
    const { error } = await db.from('products').update({ stock: 0, updated_at: new Date().toISOString() }).in('id', productIds);
    if (error) return SERVER;
    return reload(accountId, db);
  } catch {
    return NETWORK;
  }
}
