import { describe, expect, it } from '@jest/globals';
import { getShop, products } from '../catalog';
import {
  categories,
  countLabel,
  discountPercent,
  filterShopTab,
  inCategory,
  nearbyProducts,
  noFilters,
  normalize,
  priceRangeError,
  rememberQuery,
  searchProducts,
  sheetFilterCount,
  shopProducts,
  shopRating,
  shopTabs,
  suggestions,
} from '../search';
import { createInitialState, reducer, restoreState, STATE_VERSION } from '../state';

const T0 = '2026-11-03T10:00:00.000Z';
const ids = (list: { id: string }[]) => list.map((p) => p.id);

describe('catalogue integrity', () => {
  it('every product belongs to a known shop and at least one category', () => {
    for (const p of Object.values(products)) {
      expect(getShop(p.shopId).id).toBe(p.shopId);
      expect(categories.some((c) => c.id !== 'promos' && inCategory(p, c.id))).toBe(true);
    }
  });
});

describe('text search (B2)', () => {
  it('ignores accents, case and plurals', () => {
    expect(normalize('Écouteurs  SANS-fil')).toBe('ecouteurs sans fil');
    expect(ids(searchProducts('ecouteur', noFilters))).toEqual(['earbuds-pro']);
    expect(ids(searchProducts('CASQUES', noFilters))).toEqual(['jbl-tune-510']);
  });

  it('needs every word to match, and ranks name matches first', () => {
    expect(ids(searchProducts('casque bluetooth', noFilters))).toEqual(['jbl-tune-510']);
    const speakers = ids(searchProducts('enceinte', noFilters));
    expect(speakers).toEqual(expect.arrayContaining(['jbl-go-3', 'jbl-charge-5', 'jbl-pulse-5']));
    expect(searchProducts('casque rose', noFilters)).toEqual([]);
  });

  it('finds products by shop name and category', () => {
    expect(ids(searchProducts('mama luka', noFilters)).sort()).toEqual(['chaussures-sport', 'veste-jean-brut']);
    expect(ids(searchProducts('beauté', noFilters))).toEqual(['beurre-karite']);
  });

  it('an empty query lists the whole category', () => {
    const audio = searchProducts('', { ...noFilters, category: 'audio' });
    expect(audio.length).toBe(5);
    expect(audio.every((p) => ['Enceintes', 'Casques', 'Écouteurs'].includes(p.family))).toBe(true);
  });

  it('sorts by price and rating', () => {
    const asc = searchProducts('', noFilters, 'price-asc').map((p) => p.price);
    expect(asc).toEqual([...asc].sort((a, b) => a - b));
    const desc = searchProducts('', noFilters, 'price-desc').map((p) => p.price);
    expect(desc).toEqual([...desc].sort((a, b) => b - a));
    expect(searchProducts('', noFilters, 'rating')[0]!.id).toBe('beurre-karite');
  });
});

describe('filters (B3)', () => {
  it('applies price, rating and shop filters', () => {
    const range = searchProducts('', { ...noFilters, minPrice: 50_000, maxPrice: 200_000 });
    expect(range.every((p) => p.price >= 50_000 && p.price <= 200_000)).toBe(true);
    expect(searchProducts('', { ...noFilters, minRating: 4.5 }).every((p) => p.rating >= 4.5)).toBe(true);
    expect(ids(searchProducts('karité', { ...noFilters, verifiedOnly: true }))).toEqual([]);
    expect(ids(searchProducts('', { ...noFilters, fastDelivery: true })).sort()).toEqual(['beurre-karite', 'jbl-pulse-5']);
  });

  it('counts sheet filters and validates the price range', () => {
    expect(sheetFilterCount(noFilters)).toBe(0);
    expect(sheetFilterCount({ ...noFilters, category: 'audio' })).toBe(0);
    expect(sheetFilterCount({ ...noFilters, minPrice: 1, maxPrice: 2, minRating: 4, verifiedOnly: true })).toBe(3);
    expect(priceRangeError({ minPrice: 200_000, maxPrice: 50_000 })).toBe('Le minimum dépasse le maximum.');
    expect(priceRangeError({ minPrice: 50_000 })).toBeNull();
  });

  it('never leaves "Aucun résultat" without products to show (E5)', () => {
    const near = nearbyProducts({ ...noFilters, category: 'audio' });
    expect(near.length).toBe(4);
    expect(near.every((p) => p.stock > 0)).toBe(true);
    expect(inCategory(near[0]!, 'audio')).toBe(true);
  });
});

describe('suggestions and recent searches (E4)', () => {
  it('suggests families, products and shops starting with the input', () => {
    expect(suggestions('chauss')).toEqual(['Chaussures', 'Chaussures sport toile']);
    expect(suggestions('jbl').length).toBeGreaterThan(1);
    expect(suggestions('  ')).toEqual([]);
  });

  it('keeps recent searches unique, newest first, capped', () => {
    expect(rememberQuery(['JBL Go 3'], '  jbl  go 3 ')).toEqual(['jbl go 3']);
    expect(rememberQuery(['a', 'b'], 'Écouteurs')).toEqual(['Écouteurs', 'a', 'b']);
    expect(rememberQuery(['1', '2', '3', '4', '5', '6'], '7')).toEqual(['7', '1', '2', '3', '4', '5']);
    expect(rememberQuery(['a'], '   ')).toEqual(['a']);
  });

  it('stores recent searches and favourites in the app state', () => {
    let s = createInitialState(T0);
    s = reducer(s, { type: 'search/remember', query: 'Lampe', at: T0 });
    expect(s.search.recent[0]).toBe('Lampe');
    s = reducer(s, { type: 'social/toggle', list: 'wishlist', id: 'jbl-go-3', at: T0 });
    expect(s.social.wishlist).toEqual(['jbl-go-3']);
    s = reducer(s, { type: 'search/clearRecent', at: T0 });
    expect(s.search.recent).toEqual([]);
  });

  it('upgrades a saved v2 session without losing the cart', () => {
    const v3 = createInitialState(T0);
    const { search: _s, ...rest } = v3;
    const v2 = { ...rest, version: 2, social: { liked: ['P-go3'], saved: [], reposted: [], following: [] } };
    const restored = restoreState(JSON.parse(JSON.stringify(v2)), T0);
    expect(restored.version).toBe(STATE_VERSION);
    expect(restored.cart).toEqual(v3.cart);
    expect(restored.social.liked).toEqual(['P-go3']);
    expect(restored.social.wishlist).toEqual([]);
    expect(restored.search.recent.length).toBeGreaterThan(0);
    expect(restoreState({ version: 1 }, T0).version).toBe(STATE_VERSION);
    expect(restoreState(null, T0).version).toBe(STATE_VERSION);
  });
});

describe('shop page (B5)', () => {
  it('builds tabs from the shop catalogue', () => {
    const items = shopProducts('jbl-store-kin');
    expect(ids(items)).toEqual(['jbl-go-3', 'jbl-charge-5']);
    expect(shopTabs(items)).toEqual([
      { id: 'all', label: 'Tous', count: 2 },
      { id: 'family:Enceintes', label: 'Enceintes', count: 2 },
      { id: 'promos', label: 'Promos', count: 1 },
    ]);
    expect(ids(filterShopTab(items, 'promos'))).toEqual(['jbl-go-3']);
  });

  it('uses the shop rating when known, else the weighted product rating', () => {
    expect(shopRating(getShop('jbl-store-kin'))).toEqual({ value: 4.6, reviews: 312 });
    const lingwala = shopRating(getShop('tech-lingwala'));
    expect(lingwala.reviews).toBe(41 + 58);
    expect(lingwala.value).toBeCloseTo(4.4, 1);
  });

  it('formats discounts and counts like Figma', () => {
    expect(discountPercent(products['jbl-go-3']!)).toBe(19);
    expect(discountPercent(products['jbl-charge-5']!)).toBe(0);
    expect(countLabel(categories[0]!, 1240)).toBe('1 240 produits');
    expect(countLabel(categories.at(-1)!, 1)).toBe('1 offre');
  });
});
