import { describe, expect, it, jest } from '@jest/globals';
import { createInitialState, reducer } from '@/domain/state';
import { placeCheckout, rpcFailure, toAddressBook, toOrder, type AddressRow, type OrderRow } from '../serverOrders';

jest.mock('@/lib/supabase', () => ({ supabase: null, isServerMode: () => false }));

const AT = '2026-11-21T10:00:00.000Z';

const row: OrderRow = {
  id: '6f1c0000-0000-0000-0000-000000000001',
  number: 'YY-24880',
  checkout_id: 'ck1',
  buyer_id: 'u1',
  shop_id: 's1',
  items_total: 45000,
  delivery_fee: 3000,
  discount: 0,
  total: 48000,
  method: 'cash',
  payment: 'pending',
  seller: 'new',
  delivery: 'unassigned',
  address_id: 'a1',
  dropoff: '12, av. Kasa-Vubu, Kalamu, Kinshasa',
  buyer_label: 'Jean M.',
  buyer_commune: 'Kalamu',
  slot_id: 'asap',
  courier_note: null,
  cash_collected: null,
  cancel_reason: null,
  cancel_note: null,
  refund: null,
  created_at: AT,
  paid_at: null,
  prepared_at: null,
  accepted_at: null,
  picked_up_at: null,
  arrived_at: null,
  delivered_at: null,
  released_at: null,
  disputed_at: null,
  cancelled_at: null,
  order_lines: [{ product_id: 'p1', name: 'Robe wax', color: 'Rouge', qty: 1, unit_price: 45000 }],
};

describe('serverOrders mapping', () => {
  it('order row → app order, shown by its number', () => {
    const o = toOrder(row, { receipt: '4821' });
    expect(o).toMatchObject({ id: 'YY-24880', serverId: row.id, shopId: 's1', receiptCode: '4821', buyer: { name: 'Jean M.', commune: 'Kalamu' } });
    expect(o.lines).toEqual([{ productId: 'p1', name: 'Robe wax', color: 'Rouge', qty: 1, unitPrice: 45000 }]);
    expect(o.cancellation).toBeUndefined();
    expect(toOrder({ ...row, cancel_reason: 'too_slow', cancelled_at: AT, refund: 'none' }).cancellation).toMatchObject({ reason: 'too_slow', refund: 'none' });
  });

  it('address rows → book, default first choice', () => {
    const base: AddressRow = { id: 'a1', label: 'Maison', street: '12, av. Kasa-Vubu', commune: 'Kalamu', city: 'Kinshasa', landmark: null, phone: '+243812345678', is_default: false, created_at: AT };
    const book = toAddressBook([{ ...base, id: 'a2', is_default: true, created_at: '2026-11-21T11:00:00.000Z' }, base]);
    expect(book.items.map((a) => a.id)).toEqual(['a1', 'a2']);
    expect(book.defaultId).toBe('a2');
    expect(book.items[0]).toMatchObject({ phone: '+243 81 234 5678', line: '12, av. Kasa-Vubu, Kalamu' });
    expect(toAddressBook([base]).defaultId).toBe('a1');
  });

  it('rule errors from the base keep their code and French message', () => {
    expect(rpcFailure({ code: 'P0001', hint: 'OUT_OF_STOCK', message: 'Le stock d’un article a changé.' })).toEqual({ ok: false, code: 'OUT_OF_STOCK', message: 'Le stock d’un article a changé.' });
    expect(rpcFailure({ code: '42501', message: 'permission denied' })).toMatchObject({ code: 'SERVER' });
  });
});

describe('placeCheckout', () => {
  const req = { cart: [{ productId: 'p1', color: 'Rouge', qty: 2 }], addressId: 'a1', slotId: 'asap', method: 'cash' as const, note: '' };

  it('mobile money and card wait for the aggregator: nothing is written', async () => {
    const from = jest.fn();
    expect(await placeCheckout({ ...req, method: 'mobile_money' }, { from } as never)).toMatchObject({ ok: false, code: 'PAYMENT_CLOSED' });
    expect(from).not.toHaveBeenCalled();
  });

  it('sends variant ids and quantities, the base prices everything', async () => {
    const rpc = jest.fn(async (_fn: string, _args: unknown) => ({ data: 'ck1', error: null }));
    const db = {
      from: () => ({ select: () => ({ in: async () => ({ data: [{ id: 'v1', product_id: 'p1', color: 'Rouge' }], error: null }) }) }),
      rpc,
    } as never;
    expect(await placeCheckout(req, db)).toEqual({ ok: true, checkoutId: 'ck1' });
    expect(rpc).toHaveBeenCalledWith('place_checkout', {
      p_lines: [{ variant_id: 'v1', qty: 2 }],
      p_address: 'a1',
      p_slot: 'asap',
      p_method: 'cash',
      p_promo: null,
      p_note: null,
    });
  });

  it('a colour no longer sold makes the line unavailable', async () => {
    const db = { from: () => ({ select: () => ({ in: async () => ({ data: [{ id: 'v1', product_id: 'p1', color: 'Bleu' }], error: null }) }) }), rpc: jest.fn() } as never;
    expect(await placeCheckout(req, db)).toMatchObject({ ok: false, code: 'UNAVAILABLE' });
  });
});

describe('ordersServer/loaded', () => {
  it('replaces the orders and empties what the checkout bought from the cart', () => {
    let s = createInitialState(AT);
    s = { ...s, cart: [{ productId: 'p1', color: 'Rouge', qty: 1 }, { productId: 'p2', color: '', qty: 1 }], promoCode: 'YAYO10' };
    const order = toOrder(row);
    const next = reducer(s, {
      type: 'ordersServer/loaded',
      orders: { [order.id]: order },
      checkouts: { ck1: { id: 'ck1', orderIds: [order.id], amount: 48000, method: 'cash', status: 'succeeded', attempt: 0 } },
      activeCheckoutId: 'ck1',
      at: AT,
    });
    expect(Object.keys(next.orders)).toEqual(['YY-24880']);
    expect(next.cart).toEqual([{ productId: 'p2', color: '', qty: 1 }]);
    expect(next.promoCode).toBeUndefined();
    expect(next.activeCheckoutId).toBe('ck1');
  });
});
