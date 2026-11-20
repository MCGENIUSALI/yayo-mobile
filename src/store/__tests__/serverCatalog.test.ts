import { describe, expect, it, jest } from '@jest/globals';

jest.mock('@/lib/supabase', () => ({ supabase: null, isServerMode: () => false }));

import { familyOf, fetchCatalog, initials, toProduct, toShop, type ProductRow, type ShopRow } from '../serverCatalog';

const url = (p: string) => `https://cdn.test/media/${p}`;

const shopRow: ShopRow = {
  id: 's1',
  name: 'Mama Luka Mode',
  handle: 'mamalukamode',
  category: 'Mode',
  tagline: null,
  commune: 'Gombe',
  avatar_path: 's1/avatar.jpg',
  prep_min_hours: 24,
  prep_max_hours: 48,
  accepts_cash: false,
  verified: true,
};

const productRow: ProductRow = {
  id: 'p1',
  shop_id: 's1',
  name: 'Chaussures sport en toile',
  short_name: null,
  description: 'Toile respirante.',
  price: 45000,
  compare_at: 55000,
  rating: '4.4',
  reviews: 39,
  categories: { name: 'Mode › Chaussures', department: 'mode' },
  product_variants: [
    { color: 'Noir', stock: 3 },
    { color: 'Blanc', stock: 4 },
    { color: 'Bordeaux', stock: 0 },
  ],
  product_photos: [
    { position: 1, path: 's1/p1/b.jpg' },
    { position: 0, path: 's1/p1/a.jpg' },
  ],
};

describe('serverCatalog mapping', () => {
  it('maps a shop row', () => {
    const s = toShop(shopRow, url);
    expect(s).toMatchObject({ id: 's1', initials: 'ML', area: 'Gombe', deliveryLead: '24–48 h', acceptsCash: false, verified: true, avatar: 'https://cdn.test/media/s1/avatar.jpg' });
    expect(s.tagline).toBeUndefined();
    expect(toShop({ ...shopRow, prep_max_hours: 24, avatar_path: null }, url)).toMatchObject({ deliveryLead: '24 h', avatar: undefined });
  });

  it('maps a product row: stock summed over colors, first photo, family from the category', () => {
    const p = toProduct(productRow, url);
    expect(p).toMatchObject({ shortName: 'Chaussures sport en toile', price: 45000, compareAt: 55000, stock: 7, rating: 4.4, department: 'mode', family: 'Chaussures', image: 'https://cdn.test/media/s1/p1/a.jpg' });
    expect(p.colors.map((c) => c.name)).toEqual(['Blanc', 'Bordeaux', 'Noir']);
    expect(p.colors.find((c) => c.name === 'Noir')?.hex).toBe('#1c1c1e');
    expect(p.colors.find((c) => c.name === 'Bordeaux')?.hex).toBe('#c7c7cc');
  });

  it('handles a product without photo, category or colors', () => {
    const p = toProduct({ ...productRow, compare_at: null, categories: null, product_variants: [], product_photos: [] }, url);
    expect(p).toMatchObject({ stock: 0, image: undefined, compareAt: undefined, department: 'maison', family: 'Autres' });
  });

  it('helpers', () => {
    expect(initials('JBL')).toBe('JB');
    expect(initials('déco limete')).toBe('DL');
    expect(familyOf('Électronique › Audio')).toBe('Audio');
    expect(familyOf(undefined)).toBe('Autres');
  });
});

function fakeClient(result: { shops: unknown; products: unknown; error?: boolean }) {
  const query = (data: unknown) => {
    const q = {
      select: () => q,
      eq: () => q,
      order: () => q,
      then: (ok: (v: unknown) => unknown) => Promise.resolve({ data, error: result.error ? { message: 'x' } : null }).then(ok),
    };
    return q;
  };
  return {
    from: (t: string) => query(t === 'shops' ? result.shops : result.products),
    storage: { from: () => ({ getPublicUrl: (p: string) => ({ data: { publicUrl: url(p) } }) }) },
  } as never;
}

describe('fetchCatalog', () => {
  it('drops products whose shop is not visible', async () => {
    const res = await fetchCatalog(fakeClient({ shops: [shopRow], products: [productRow, { ...productRow, id: 'p2', shop_id: 'hidden' }] }));
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(Object.keys(res.shops)).toEqual(['s1']);
      expect(Object.keys(res.products)).toEqual(['p1']);
    }
  });

  it('reports a read failure', async () => {
    const res = await fetchCatalog(fakeClient({ shops: null, products: null, error: true }));
    expect(res).toEqual({ ok: false, message: expect.stringContaining('catalogue') });
  });
});
