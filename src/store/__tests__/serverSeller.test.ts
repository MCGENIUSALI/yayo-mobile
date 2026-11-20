import { describe, expect, it, jest } from '@jest/globals';
import type { ProductDraft } from '@/domain/seller';
import { makeHandle, mediaPath, saveSellerProduct, shopStatus, toSellerProduct, toSellerSpace, type SellerProductRow, type SellerShopRow } from '../serverSeller';

jest.mock('@/lib/supabase', () => ({ supabase: null, isServerMode: () => false }));

const BASE = 'https://ref.supabase.co/storage/v1/object/public/media/';
const url = (p: string) => BASE + p;

const shop: SellerShopRow = { id: 's1', name: 'Mama Luka Mode', category: 'Mode', commune: 'Gombe', pickup_address: '12, av. du Commerce', avatar_path: null, status: 'pending', payout_phone: '+243812345678' };

const row: SellerProductRow = {
  id: 'p1',
  name: 'Robe pagne wax',
  description: '',
  price: 45000,
  compare_at: null,
  stock: 4,
  status: 'archived',
  rating: 0,
  reviews: 0,
  updated_at: '2026-11-20T10:00:00.000Z',
  categories: { name: 'Mode › Vêtements' },
  product_variants: [{ color: 'Rouge' }, { color: '' }],
  product_photos: [
    { position: 1, path: 'u1/products/p1/b.jpg' },
    { position: 0, path: 'u1/products/p1/a.jpg' },
  ],
};

describe('serverSeller mapping', () => {
  it('shop review → V3 state', () => {
    expect(shopStatus(shop, null)).toBe('draft');
    expect(shopStatus(shop, { id_document_path: 'a', selfie_path: 'b', submitted_at: 'x' })).toBe('submitted');
    expect(shopStatus({ ...shop, status: 'rejected' }, { id_document_path: 'a', selfie_path: 'b', submitted_at: 'x' })).toBe('submitted');
    expect(shopStatus({ ...shop, status: 'approved' }, null)).toBe('verified');
  });

  it('product row → seller product', () => {
    const p = toSellerProduct(row, url);
    expect(p).toMatchObject({ status: 'offline', stock: 4, category: 'Mode › Vêtements', colors: ['Rouge'], rating: undefined });
    expect(p.photos).toEqual([url('u1/products/p1/a.jpg'), url('u1/products/p1/b.jpg')]);
  });

  it('space keeps the documents behind signed links', () => {
    const s = toSellerSpace('u1', shop, { id_document_path: 'u1/kyc/a.jpg', selfie_path: 'u1/kyc/b.jpg', submitted_at: '2026-11-20T10:00:00.000Z' }, [], {
      publicUrl: url,
      signed: { 'u1/kyc/a.jpg': 'https://signed/a', 'u1/kyc/b.jpg': 'https://signed/b' },
    });
    expect(s).toMatchObject({ shopId: 's1', status: 'submitted', kyc: { idDoc: 'https://signed/a', selfie: 'https://signed/b', payoutPhone: '+243812345678' } });
    expect(s.profile.pickupAddress).toBe('12, av. du Commerce');
  });

  it('handle and media paths', () => {
    expect(makeHandle('Déco Limete', () => 0.0423)).toBe('decolimete0423');
    expect(makeHandle('!!!', () => 0)).toBe('boutique0000');
    expect(makeHandle('Déco Limete')).toMatch(/^[a-z0-9_.]{3,30}$/);
    expect(mediaPath(url('u1/products/p1/a.jpg'))).toBe('u1/products/p1/a.jpg');
    expect(mediaPath('file:///tmp/photo.jpg')).toBeNull();
    expect(mediaPath(12)).toBeNull();
  });
});

describe('saveSellerProduct', () => {
  const draft: ProductDraft = { name: 'Robe pagne wax', category: 'Mode › Vêtements', description: '', photos: [12], price: '45 000', compareAt: '', stock: '4', colors: ['Rouge'] };

  it('refuses demo pictures and invalid drafts before writing anything', async () => {
    const from = jest.fn();
    const db = { from } as never;
    expect(await saveSellerProduct('u1', 's1', undefined, draft, 'online', db)).toMatchObject({ ok: false, code: 'DEMO_PHOTO' });
    expect(await saveSellerProduct('u1', 's1', undefined, { ...draft, photos: [] }, 'online', db)).toMatchObject({ ok: false, code: 'INVALID_PRODUCT' });
    expect(from).not.toHaveBeenCalled();
  });
});
