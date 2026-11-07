import { describe, expect, it } from '@jest/globals';
import { departmentOf, idOf, listOf, toAddress, toAddressInput, toCategory, toProduct, variantFor } from '../mappers';

describe('mappers', () => {
  it('reads ids and list pages in the usual NestJS shapes', () => {
    expect(idOf({ _id: { $oid: 'abc' } })).toBe('abc');
    expect(idOf({ id: 12 })).toBe('12');
    expect(listOf([1, 2]).items).toHaveLength(2);
    expect(listOf({ data: [1], total: '9', page: 1 })).toEqual({ items: [1], total: 9, page: 1 });
    expect(listOf({ nope: true }).items).toEqual([]);
  });

  it('converts a product with variants', () => {
    const p = toProduct(
      {
        _id: 'p1',
        name: 'JBL Flip 6',
        price: 189000.4,
        compareAtPrice: 220000,
        vendor: { _id: 'v1', shopName: 'JBL Store Kin' },
        category: { _id: 'c1', name: 'Électronique' },
        imageUrls: ['https://cdn/x.jpg'],
        variants: [
          { sku: 'FLIP6-NOIR', color: 'Noir', stock: 3 },
          { sku: 'FLIP6-BLEU', color: 'Bleu', stock: 0 },
        ],
      },
      {},
    );
    expect(p).toMatchObject({ id: 'p1', shopId: 'v1', price: 189000, compareAt: 220000, stock: 3, image: 'https://cdn/x.jpg', department: 'electronique', family: 'Électronique', categoryId: 'c1' });
    expect(p!.colors).toEqual([
      { name: 'Noir', hex: '#111827' },
      { name: 'Bleu', hex: '#2563EB' },
    ]);
    expect(variantFor(p!, 'Bleu')?.sku).toBe('FLIP6-NOIR');
    expect(variantFor(p!, 'Noir')?.sku).toBe('FLIP6-NOIR');
  });

  it('uses the category list when the product only has a categoryId', () => {
    const p = toProduct({ id: 'p2', name: 'Robe pagne', price: '45000', vendorId: 'v2', categoryId: 'c9', stock: 4 }, { c9: { id: 'c9', name: 'Mode femme' } });
    expect(p).toMatchObject({ department: 'mode', family: 'Mode femme', stock: 4, price: 45000, compareAt: undefined });
  });

  it('refuses a product without price or shop rather than inventing one', () => {
    expect(toProduct({ id: 'p3', name: 'Sans prix', vendorId: 'v' })).toBeNull();
    expect(toProduct({ id: 'p4', name: 'Sans boutique', price: 1000 })).toBeNull();
  });

  it('falls back to Maison for unknown categories', () => {
    expect(departmentOf('Parfums')).toBe('beaute');
    expect(departmentOf('Jouets')).toBe('maison');
    expect(toCategory({ _id: 'c1', name: 'Audio', parentId: 'c0' })).toEqual({ id: 'c1', name: 'Audio', parentId: 'c0' });
  });

  it('maps addresses both ways', () => {
    expect(toAddressInput({ label: 'Maison', phone: '+243 81 234 5678', city: 'Kinshasa', commune: 'Kalamu', street: '12 av. Kasa-Vubu', landmark: 'Face pharmacie' })).toEqual({
      label: 'Maison',
      street: '12 av. Kasa-Vubu',
      city: 'Kinshasa',
      state: 'Kalamu',
      country: 'CD',
      phoneE164: '+243812345678',
      instructions: 'Face pharmacie',
    });
    expect(toAddress({ _id: 'a1', label: 'Maison', street: '12 av. Kasa-Vubu', state: 'Kalamu', city: 'Kinshasa', phoneE164: '+243812345678' })).toMatchObject({
      id: 'a1',
      line: '12 av. Kasa-Vubu, Kalamu, Kinshasa',
    });
  });
});
