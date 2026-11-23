import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { Department, Product, Shop } from '@/domain/types';

/**
 * Catalogue en mode serveur : boutiques validées et produits en ligne, lus
 * dans Supabase. Les règles d'accès de la base ne renvoient que ce qu'un
 * acheteur a le droit de voir (boutique validée, produit actif).
 */

export interface ShopRow {
  id: string;
  name: string;
  handle: string;
  category: string;
  tagline: string | null;
  commune: string;
  avatar_path: string | null;
  prep_min_hours: number;
  prep_max_hours: number;
  accepts_cash: boolean;
  verified: boolean;
}

export interface ProductRow {
  id: string;
  shop_id: string;
  name: string;
  short_name: string | null;
  description: string;
  price: number;
  compare_at: number | null;
  /** One stock for the product, shared by its colors (V10). */
  stock: number;
  rating: number | string;
  reviews: number;
  categories: { name: string; department: Department } | null;
  product_variants: { color: string }[];
  product_photos: { position: number; path: string }[];
}

/** Couleurs proposées au vendeur (V10) ; une couleur inconnue s'affiche en gris neutre. */
const COLOR_HEX: Record<string, string> = {
  Noir: '#1c1c1e',
  Blanc: '#f2f2f2',
  Bleu: '#2f7be5',
  Jaune: '#f2c230',
  Rouge: '#d93b30',
  Vert: '#2e9b5b',
  Orange: '#fb7800',
  Rose: '#ef7fb0',
  Gris: '#8e8e93',
};
const NEUTRAL = '#c7c7cc';
const PHOTO_TINT = '#ececf0';

export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const letters = words.length > 1 ? words[0]![0]! + words[1]![0]! : (words[0] ?? '?').slice(0, 2);
  return letters.toUpperCase();
}

export function toShop(r: ShopRow, publicUrl: (path: string) => string): Shop {
  return {
    id: r.id,
    name: r.name,
    handle: r.handle,
    category: r.category,
    initials: initials(r.name),
    area: r.commune,
    verified: r.verified,
    deliveryLead: r.prep_min_hours === r.prep_max_hours ? `${r.prep_min_hours} h` : `${r.prep_min_hours}–${r.prep_max_hours} h`,
    tagline: r.tagline ?? undefined,
    acceptsCash: r.accepts_cash,
    avatar: r.avatar_path ? publicUrl(r.avatar_path) : undefined,
  };
}

/** « Mode › Chaussures » → famille « Chaussures » (onglets B5, recherche). */
export function familyOf(category: string | undefined): string {
  if (!category) return 'Autres';
  const parts = category.split('›').map((s) => s.trim());
  return parts[parts.length - 1] || 'Autres';
}

export function toProduct(r: ProductRow, publicUrl: (path: string) => string): Product {
  const variants = [...r.product_variants].sort((a, b) => a.color.localeCompare(b.color, 'fr'));
  const photo = [...r.product_photos].sort((a, b) => a.position - b.position)[0];
  return {
    id: r.id,
    shopId: r.shop_id,
    name: r.name,
    shortName: r.short_name?.trim() || r.name,
    price: r.price,
    compareAt: r.compare_at ?? undefined,
    stock: r.stock,
    rating: Number(r.rating) || 0,
    reviews: r.reviews,
    colors: variants.filter((v) => v.color).map((v) => ({ name: v.color, hex: COLOR_HEX[v.color] ?? NEUTRAL })),
    tint: PHOTO_TINT,
    image: photo ? publicUrl(photo.path) : undefined,
    description: r.description,
    department: r.categories?.department ?? 'maison',
    family: familyOf(r.categories?.name),
  };
}

export type CatalogResult =
  | { ok: true; shops: Record<string, Shop>; products: Record<string, Product> }
  | { ok: false; message: string };

export async function fetchCatalog(c?: SupabaseClient | null): Promise<CatalogResult> {
  const db = c ?? supabase;
  if (!db) return { ok: false, message: 'Supabase non configuré' };
  try {
    const publicUrl = (path: string) => db.storage.from('media').getPublicUrl(path).data.publicUrl;
    const [shopRes, productRes] = await Promise.all([
      db.from('shops').select('id, name, handle, category, tagline, commune, avatar_path, prep_min_hours, prep_max_hours, accepts_cash, verified').eq('status', 'approved'),
      db
        .from('products')
        .select('id, shop_id, name, short_name, description, price, compare_at, stock, rating, reviews, categories(name, department), product_variants(color), product_photos(position, path)')
        .eq('status', 'active')
        .order('created_at', { ascending: false }),
    ]);
    if (shopRes.error || productRes.error) return { ok: false, message: 'Le catalogue YA YO n’a pas pu être chargé. Réessaie dans un instant.' };
    const shops = Object.fromEntries((shopRes.data as ShopRow[]).map((r) => [r.id, toShop(r, publicUrl)]));
    // A product whose shop is not visible (suspended, under review) is never listed.
    const products = Object.fromEntries(
      (productRes.data as unknown as ProductRow[]).filter((r) => shops[r.shop_id]).map((r) => [r.id, toProduct(r, publicUrl)]),
    );
    return { ok: true, shops, products };
  } catch {
    return { ok: false, message: 'Pas de connexion au serveur YA YO. Vérifie ton réseau puis réessaie.' };
  }
}
