import { afterAll, describe, expect, it } from '@jest/globals';
import { getShop, inCatalog, products, replaceCatalog, shops } from '../catalog';
import { feedPosts, seedContent } from '../content';
import { createInitialState, reducer } from '../state';

const NOW = '2026-11-20T10:00:00.000Z';

describe('server catalogue replaces the demo one', () => {
  const demoShops = { ...shops };
  const demoProducts = { ...products };
  afterAll(() => {
    replaceCatalog({ shops: demoShops, products: demoProducts });
  });

  it('empties demo data, hides demo posts, and prunes cart and favourites', () => {
    const before = createInitialState(NOW);
    const withWish = reducer(before, { type: 'social/toggle', list: 'wishlist', id: 'jbl-go-3', at: NOW } as never);
    expect(withWish.cart.length).toBeGreaterThan(0);
    expect(feedPosts(seedContent(NOW), NOW).length).toBeGreaterThan(0);

    const v = replaceCatalog({ shops: {}, products: {} });
    expect(v).toBeGreaterThan(0);
    expect(Object.keys(products)).toHaveLength(0);
    expect(() => getShop('jbl-store-kin')).toThrow();
    expect(feedPosts(seedContent(NOW), NOW)).toEqual([]);
    expect(inCatalog({ shopId: 'jbl-store-kin' })).toBe(false);

    const after = reducer(withWish, { type: 'catalog/loaded', at: NOW });
    expect(after.cart).toEqual([]);
    expect(after.social.wishlist).toEqual([]);
    // Nothing to drop: same state object.
    expect(reducer(after, { type: 'catalog/loaded', at: NOW })).toBe(after);
  });
});
