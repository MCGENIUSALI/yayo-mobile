import { getShop, products as catalogue } from './catalog';
import type { Product, Shop } from './types';

/**
 * Explorer domain (Figma B2 · Résultats, B3 · Filtres, E3 · Catégories,
 * E4 · Recherche en cours, E5 · Aucun résultat). Pure functions, tested.
 */

export type CategoryId = 'electronique' | 'audio' | 'accessoires' | 'mode' | 'beaute' | 'maison' | 'promos';

export interface Category {
  id: CategoryId;
  label: string;
  /** Wording of the count on E3: "4 produits", "2 offres". */
  unit: [singular: string, plural: string];
}

/** Order of E3 (grid) and of the chips on B2/B3. */
export const categories: Category[] = [
  { id: 'electronique', label: 'Électronique', unit: ['produit', 'produits'] },
  { id: 'mode', label: 'Mode', unit: ['produit', 'produits'] },
  { id: 'beaute', label: 'Beauté', unit: ['produit', 'produits'] },
  { id: 'maison', label: 'Maison', unit: ['produit', 'produits'] },
  { id: 'audio', label: 'Audio', unit: ['produit', 'produits'] },
  { id: 'accessoires', label: 'Accessoires', unit: ['produit', 'produits'] },
  { id: 'promos', label: 'Promos', unit: ['offre', 'offres'] },
];

const AUDIO = ['Enceintes', 'Casques', 'Écouteurs'];
const ACCESSOIRES = ['Batteries'];

export function isCategoryId(v: unknown): v is CategoryId {
  return typeof v === 'string' && categories.some((c) => c.id === v);
}

export function getCategory(id: CategoryId): Category {
  return categories.find((c) => c.id === id)!;
}

export function inCategory(p: Product, id: CategoryId): boolean {
  switch (id) {
    case 'audio':
      return AUDIO.includes(p.family);
    case 'accessoires':
      return ACCESSOIRES.includes(p.family);
    case 'promos':
      return isOnSale(p);
    default:
      return p.department === id;
  }
}

export const isOnSale = (p: Product) => p.compareAt != null && p.compareAt > p.price;

/** "-20 %" badge on cards. */
export function discountPercent(p: Product): number {
  return isOnSale(p) ? Math.round((1 - p.price / p.compareAt!) * 100) : 0;
}

export function countLabel(c: Category, n: number): string {
  return `${n.toLocaleString('fr-FR').replace(/ | /g, ' ')} ${n > 1 ? c.unit[1] : c.unit[0]}`;
}

/* ---------- Filters (B3) ---------- */

export type MinRating = 0 | 4 | 4.5;

export interface SearchFilters {
  category?: CategoryId;
  minPrice?: number;
  maxPrice?: number;
  minRating: MinRating;
  verifiedOnly: boolean;
  fastDelivery: boolean;
}

export const noFilters: SearchFilters = { minRating: 0, verifiedOnly: false, fastDelivery: false };

/** Filters set in the sheet, the category chip excluded (it has its own row on B2). */
export function sheetFilterCount(f: SearchFilters): number {
  return (
    (f.minPrice != null || f.maxPrice != null ? 1 : 0) +
    (f.minRating > 0 ? 1 : 0) +
    (f.verifiedOnly ? 1 : 0) +
    (f.fastDelivery ? 1 : 0)
  );
}

export function hasAnyFilter(f: SearchFilters): boolean {
  return f.category != null || sheetFilterCount(f) > 0;
}

/** Error shown under the price fields, or null. */
export function priceRangeError(f: Pick<SearchFilters, 'minPrice' | 'maxPrice'>): string | null {
  if (f.minPrice != null && f.maxPrice != null && f.minPrice > f.maxPrice) return 'Le minimum dépasse le maximum.';
  return null;
}

/** "24 h" lead times only: same-day or next-day delivery in Kinshasa. */
export const deliversIn24h = (s: Shop) => s.deliveryLead === '24 h';

function passes(p: Product, f: SearchFilters): boolean {
  const shop = getShop(p.shopId);
  if (f.category && !inCategory(p, f.category)) return false;
  if (f.minPrice != null && p.price < f.minPrice) return false;
  if (f.maxPrice != null && p.price > f.maxPrice) return false;
  if (p.rating < f.minRating) return false;
  if (f.verifiedOnly && !shop.verified) return false;
  if (f.fastDelivery && !deliversIn24h(shop)) return false;
  return true;
}

/* ---------- Text search ---------- */

/** Lowercase, no accents, no punctuation: "Écouteurs" → "ecouteurs". */
export function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Very small French stemmer: plural "s"/"x" so that "casques" finds "casque". */
const stem = (w: string) => (w.length > 3 ? w.replace(/[sx]$/, '') : w);

const tokens = (s: string) => normalize(s).split(' ').filter(Boolean).map(stem);

interface Indexed {
  product: Product;
  strong: string[];
  medium: string[];
  weak: string[];
}

function index(p: Product): Indexed {
  const shop = getShop(p.shopId);
  const cats = categories.filter((c) => inCategory(p, c.id)).map((c) => c.label);
  return {
    product: p,
    strong: tokens(`${p.name} ${p.shortName}`),
    medium: tokens(`${p.family} ${cats.join(' ')} ${shop.name} ${p.colors.map((c) => c.name).join(' ')}`),
    weak: tokens(p.description),
  };
}

const hit = (words: string[], q: string) => words.some((w) => w.startsWith(q));

/** Relevance of a product for a query; 0 means "does not match". Every query word must match somewhere. */
function score(ix: Indexed, query: string[]): number {
  let total = 0;
  for (const q of query) {
    const s = hit(ix.strong, q) ? 3 : hit(ix.medium, q) ? 2 : hit(ix.weak, q) ? 1 : 0;
    if (s === 0) return 0;
    total += s;
  }
  return total;
}

export type SortKey = 'relevance' | 'price-asc' | 'price-desc' | 'rating';

export const sortLabels: Record<SortKey, string> = {
  relevance: 'Pertinence',
  'price-asc': 'Prix croissant',
  'price-desc': 'Prix décroissant',
  rating: 'Mieux notés',
};

export function searchProducts(
  query: string,
  filters: SearchFilters,
  sort: SortKey = 'relevance',
  all: Product[] = Object.values(catalogue),
): Product[] {
  const q = tokens(query);
  const scored = all
    .filter((p) => passes(p, filters))
    .map((p) => ({ p, s: q.length ? score(index(p), q) : 1 }))
    .filter((x) => x.s > 0);
  const byRating = (a: Product, b: Product) => b.rating - a.rating || b.reviews - a.reviews;
  scored.sort((a, b) => {
    switch (sort) {
      case 'price-asc':
        return a.p.price - b.p.price;
      case 'price-desc':
        return b.p.price - a.p.price;
      case 'rating':
        return byRating(a.p, b.p);
      default:
        return b.s - a.s || byRating(a.p, b.p);
    }
  });
  return scored.map((x) => x.p);
}

/** Products shown under E5 so that "Aucun résultat" is never a dead end: same category first, then best rated. */
export function nearbyProducts(filters: SearchFilters, limit = 4, all: Product[] = Object.values(catalogue)): Product[] {
  const inStock = all.filter((p) => p.stock > 0);
  const same = filters.category ? inStock.filter((p) => inCategory(p, filters.category!)) : [];
  const rest = inStock.filter((p) => !same.includes(p)).sort((a, b) => b.rating - a.rating || b.reviews - a.reviews);
  return [...same, ...rest].slice(0, limit);
}

/**
 * E4 suggestions while typing: product names, families, categories and
 * shops that start with (or contain a word starting with) what was typed.
 */
export function suggestions(query: string, limit = 5, all: Product[] = Object.values(catalogue)): string[] {
  const q = normalize(query);
  if (!q) return [];
  const pool = new Set<string>();
  for (const p of all) {
    pool.add(p.family);
    pool.add(p.shortName);
    pool.add(getShop(p.shopId).name);
  }
  for (const c of categories) pool.add(c.label);
  const starts: string[] = [];
  const contains: string[] = [];
  for (const label of pool) {
    const n = normalize(label);
    if (n === q) continue;
    if (n.startsWith(q)) starts.push(label);
    else if (n.split(' ').some((w) => w.startsWith(q))) contains.push(label);
  }
  const byLength = (a: string, b: string) => a.length - b.length || a.localeCompare(b, 'fr');
  return [...starts.sort(byLength), ...contains.sort(byLength)].slice(0, limit);
}

/** Recent searches: most recent first, unique (case and accents ignored), at most 6. */
export function rememberQuery(recent: readonly string[], query: string, max = 6): string[] {
  const clean = query.trim().replace(/\s+/g, ' ');
  if (!clean) return [...recent];
  const key = normalize(clean);
  return [clean, ...recent.filter((r) => normalize(r) !== key)].slice(0, max);
}

/* ---------- Shop (B5) ---------- */

export function shopProducts(shopId: string, all: Product[] = Object.values(catalogue)): Product[] {
  return all.filter((p) => p.shopId === shopId);
}

/** Shop rating: the shop's own figure when known, else the review-weighted mean of its products. */
export function shopRating(shop: Shop, all: Product[] = Object.values(catalogue)): { value: number; reviews: number } {
  if (shop.rating != null && shop.reviews != null) return { value: shop.rating, reviews: shop.reviews };
  const items = shopProducts(shop.id, all);
  const reviews = items.reduce((n, p) => n + p.reviews, 0);
  if (!reviews) return { value: 0, reviews: 0 };
  const value = items.reduce((n, p) => n + p.rating * p.reviews, 0) / reviews;
  return { value: Math.round(value * 10) / 10, reviews };
}

/** Tabs of the shop page: "Tous (N)", then each product family, then "Promos" when there are any. */
export function shopTabs(items: Product[]): { id: string; label: string; count: number }[] {
  const families = [...new Set(items.map((p) => p.family))];
  const tabs = [{ id: 'all', label: 'Tous', count: items.length }];
  for (const f of families) tabs.push({ id: `family:${f}`, label: f, count: items.filter((p) => p.family === f).length });
  const promos = items.filter(isOnSale).length;
  if (promos) tabs.push({ id: 'promos', label: 'Promos', count: promos });
  return tabs;
}

export function filterShopTab(items: Product[], tab: string): Product[] {
  if (tab === 'all') return items;
  if (tab === 'promos') return items.filter(isOnSale);
  if (tab.startsWith('family:')) return items.filter((p) => p.family === tab.slice('family:'.length));
  return items;
}

/** Shops whose name or handle matches the query (shown above B2 results). */
export function shopsMatching(query: string, all: Shop[]): Shop[] {
  const q = tokens(query);
  if (!q.length) return [];
  return all.filter((s) => {
    const words = tokens(`${s.name} ${s.handle ?? ''}`);
    return q.every((t) => hit(words, t));
  });
}
