import type { Address, ColorOption, Department, Product } from '@/domain/types';
import type { AddressInput } from './endpoints';

/**
 * Server JSON → app models. The OpenAPI description leaves Product, Category,
 * Address and the others empty, so each reader below accepts the usual NestJS
 * names (`id` or `_id`, `vendorId` or `vendor`). Once `npm run api:check` has
 * shown the real answers, remove the guesses that do not match.
 */

type Json = Record<string, unknown>;

const obj = (v: unknown): Json | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : null);
const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v : typeof v === 'number' ? String(v) : undefined);
const num = (v: unknown): number | undefined => {
  const n = typeof v === 'string' && v.trim() ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) ? n : undefined;
};

/** `id`, or MongoDB's `_id` (string or { $oid }). */
export function idOf(v: unknown): string | undefined {
  if (typeof v === 'string') return v || undefined;
  const o = obj(v);
  if (!o) return undefined;
  return str(o.id) ?? str(o._id) ?? str(obj(o._id)?.$oid);
}

/** A list answer: a bare array, or a page object `{ data | items | results | docs, total, page }`. */
export function listOf(v: unknown): { items: unknown[]; total?: number; page?: number } {
  if (Array.isArray(v)) return { items: v };
  const o = obj(v);
  if (!o) return { items: [] };
  for (const k of ['data', 'items', 'results', 'docs', 'products', 'content', 'rows']) {
    if (Array.isArray(o[k])) return { items: o[k] as unknown[], total: num(o.total ?? o.totalCount ?? o.count), page: num(o.page) };
  }
  return { items: [] };
}

export interface Category {
  id: string;
  name: string;
  parentId?: string;
}

export function toCategory(v: unknown): Category | null {
  const o = obj(v);
  const id = idOf(o);
  const name = str(o?.name);
  if (!o || !id || !name) return null;
  return { id, name, parentId: idOf(o.parentId) ?? idOf(o.parent) };
}

export interface Variant {
  sku: string;
  stock: number;
  size?: string;
  color?: string;
}

/** A product as the app shows it, plus what the server needs back for the cart (`variants[].sku`). */
export interface ServerProduct extends Product {
  variants: Variant[];
  currency?: string;
  categoryId?: string;
}

const DEPARTMENT_WORDS: [Department, RegExp][] = [
  ['electronique', /[ée]lectro|t[ée]l[ée]phone|audio|enceinte|ordinateur|informatique|tv|t[ée]l[ée]|casque|phone|tech/i],
  ['mode', /mode|v[êe]tement|chaussure|sac|robe|pagne|homme|femme|bijou|montre|fashion/i],
  ['beaute', /beaut[ée]|cosm[ée]tique|parfum|soin|maquillage|cheveux|beauty/i],
  ['maison', /maison|cuisine|d[ée]co|meuble|[ée]lectrom[ée]nager|home/i],
];

export function departmentOf(categoryName: string | undefined): Department {
  if (categoryName) for (const [d, re] of DEPARTMENT_WORDS) if (re.test(categoryName)) return d;
  // No match: shown under « Maison » in Explorer until the server's categories are mapped one by one.
  return 'maison';
}

const COLOR_HEX: Record<string, string> = {
  noir: '#111827', black: '#111827', blanc: '#F9FAFB', white: '#F9FAFB', rouge: '#DC2626', red: '#DC2626',
  bleu: '#2563EB', blue: '#2563EB', vert: '#16A34A', green: '#16A34A', jaune: '#EAB308', yellow: '#EAB308',
  gris: '#6B7280', gray: '#6B7280', grey: '#6B7280', rose: '#EC4899', pink: '#EC4899', orange: '#EA580C',
  violet: '#7C3AED', purple: '#7C3AED', marron: '#78350F', brown: '#78350F', beige: '#D6C7A1', or: '#CA8A04', gold: '#CA8A04',
};

const colorOption = (name: string): ColorOption => ({ name, hex: COLOR_HEX[name.trim().toLowerCase()] ?? '#9CA3AF' });

export function toVariant(v: unknown): Variant | null {
  const o = obj(v);
  const sku = str(o?.sku);
  if (!o || !sku) return null;
  return { sku, stock: Math.max(0, Math.floor(num(o.stock) ?? 0)), size: str(o.size), color: str(o.color) };
}

/** Product JSON → app product, or null when it lacks an id, a name, a price or a shop. */
export function toProduct(v: unknown, categories: Record<string, Category> = {}): ServerProduct | null {
  const o = obj(v);
  if (!o) return null;
  const id = idOf(o);
  const name = str(o.name) ?? str(o.title);
  const price = num(o.price);
  const shopId = str(o.vendorId) ?? idOf(o.vendor) ?? str(o.sellerId) ?? idOf(o.seller) ?? str(o.ownerId);
  if (!id || !name || price === undefined || !shopId) return null;

  const variants = (Array.isArray(o.variants) ? o.variants : []).map(toVariant).filter((x): x is Variant => !!x);
  const categoryId = str(o.categoryId) ?? idOf(o.category);
  const categoryName = str(obj(o.category)?.name) ?? (categoryId ? categories[categoryId]?.name : undefined) ?? (typeof o.category === 'string' && !categoryId ? o.category : undefined);
  const images = [o.imageUrls, o.images].find(Array.isArray) as unknown[] | undefined;
  const image = images?.map((x) => str(x) ?? str(obj(x)?.url)).find(Boolean) ?? str(o.imageUrl) ?? str(o.image);
  const stock = variants.length ? variants.reduce((s, x) => s + x.stock, 0) : Math.max(0, Math.floor(num(o.stock) ?? num(o.quantity) ?? 0));
  const colors = [...new Set(variants.map((x) => x.color).filter((c): c is string => !!c))].map(colorOption);
  const compareAt = num(o.compareAtPrice);

  return {
    id,
    shopId,
    name,
    shortName: name,
    // Prices are whole Congolese francs in the app.
    price: Math.round(price),
    compareAt: compareAt !== undefined && compareAt > price ? Math.round(compareAt) : undefined,
    stock,
    rating: num(o.rating) ?? num(o.averageRating) ?? num(o.avgRating) ?? 0,
    reviews: Math.floor(num(o.reviewCount) ?? num(o.reviewsCount) ?? num(o.ratingCount) ?? 0),
    colors,
    tint: '#F3F4F6',
    image,
    description: str(o.description) ?? '',
    department: departmentOf(categoryName),
    family: categoryName ?? 'Autres',
    variants,
    currency: str(o.currency),
    categoryId,
  };
}

/** The variant the cart sends when the buyer picked a colour (or the first in stock). */
export function variantFor(p: ServerProduct, colorName?: string): Variant | undefined {
  const inStock = p.variants.filter((v) => v.stock > 0);
  return (colorName ? inStock.find((v) => v.color === colorName) : undefined) ?? inStock[0];
}

/** App address (D14) → API AddressDto. The API has no « commune » or « repère » field: they go in state / instructions. */
export function toAddressInput(a: Omit<Address, 'id' | 'line'>): AddressInput {
  return {
    label: a.label,
    street: a.street ?? a.label,
    city: a.city ?? 'Kinshasa',
    state: a.commune,
    country: 'CD',
    phoneE164: a.phone.replace(/[^\d+]/g, ''),
    instructions: a.landmark,
  };
}

export function toAddress(v: unknown): Address | null {
  const o = obj(v);
  const id = idOf(o);
  if (!o || !id) return null;
  const street = str(o.street);
  const commune = str(o.state);
  const city = str(o.city);
  return {
    id,
    label: str(o.label) ?? 'Adresse',
    line: [street, commune, city].filter(Boolean).join(', '),
    phone: str(o.phoneE164) ?? '',
    city,
    commune,
    street,
    landmark: str(o.instructions),
  };
}
