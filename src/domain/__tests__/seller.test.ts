import { describe, expect, it } from '@jest/globals';
import { currentAccount, DEMO_PHONE_EXISTING, DEMO_PHONE_SELLER } from '../auth';
import { orderNet, payoutPreview, pickupCodeFor, revenue, sellerNotices, type ProductDraft } from '../seller';
import { activeSellerSpace, confirmedOrders, createInitialState, effectiveMode, reducer, restoreState, shopOrders, STATE_VERSION, type Action, type AppState } from '../state';

const T0 = '2026-11-03T10:00:00.000Z';
const at = (s: number) => new Date(new Date(T0).getTime() + s * 1000).toISOString();

function run(state: AppState, ...actions: Action[]): AppState {
  return actions.reduce(reducer, state);
}

function signIn(state: AppState, phone: string, t = 0): AppState {
  let s = run(state, { type: 'auth/onboarded' }, { type: 'auth/requestCode', kind: 'phone', target: phone, channel: 'sms', code: '123456', at: at(t) });
  s = reducer(s, { type: 'auth/verifyCode', code: '123456', at: at(t + 5) });
  return s;
}

const shopProfile = { name: 'Mode Kintambo', category: 'Mode', commune: 'Kintambo', pickupAddress: 'Av. Kasa-Vubu n°4', hours: 'Lun–Sam, 8h–18h' };
const kyc = { idDoc: 1, selfie: 2, payoutPhone: '82 111 2233' };
const draft: ProductDraft = { name: 'Robe pagne wax', category: 'Mode › Vêtements', description: '', photos: [1], price: '45 000', compareAt: '', stock: '4', colors: ['Rouge'] };

describe('seller money rules (Figma V6, V10, V11)', () => {
  it('reproduces V6: 285 000 FC → 10 % commission, 5 % delivery, 242 250 FC net', () => {
    expect(orderNet({ itemsTotal: 285_000 })).toEqual({ items: 285_000, commission: 28_500, delivery: 14_250, net: 242_250 });
  });

  it('reproduces V10: 95 000 FC → you receive 85 500 FC before delivery', () => {
    expect(payoutPreview(95_000)).toEqual({ commission: 9_500, net: 85_500 });
  });

  it('reproduces V11: 3 450 000 FC of sales → 2 932 500 FC net', () => {
    expect(orderNet({ itemsTotal: 3_450_000 }).net).toBe(2_932_500);
  });
});

describe('opening a shop (US-10)', () => {
  it('goes from A8 to a verified shop, with the role granted only by the YA YO side', () => {
    let s = signIn(createInitialState(T0), '97 555 1234');
    s = run(
      s,
      { type: 'auth/createAccount', profile: { name: 'Nadège Lukusa', city: 'Kinshasa', commune: 'Kintambo', acceptTerms: true }, at: at(20) },
      { type: 'auth/chooseRole', role: 'seller', at: at(25) },
    );
    expect(effectiveMode(s)).toBe('seller');
    expect(currentAccount(s.auth)!.roles).toEqual(['buyer']);

    s = reducer(s, { type: 'seller/saveProfile', profile: { ...shopProfile, name: ' ' }, at: at(30) });
    expect(s.lastError?.code).toBe('INVALID_PROFILE');
    s = reducer(s, { type: 'seller/saveProfile', profile: shopProfile, at: at(31) });
    expect(activeSellerSpace(s)!.status).toBe('draft');

    s = reducer(s, { type: 'seller/submitKyc', kyc: { ...kyc, selfie: undefined }, at: at(40) });
    expect(s.lastError?.code).toBe('INVALID_KYC');
    s = reducer(s, { type: 'seller/submitKyc', kyc, at: at(41) });
    expect(activeSellerSpace(s)!.status).toBe('submitted');
    expect(activeSellerSpace(s)!.kyc!.payoutPhone).toBe('+243821112233');
    expect(currentAccount(s.auth)!.pendingRoles).toContain('seller');
    expect(currentAccount(s.auth)!.roles).not.toContain('seller');

    // Catalogue can be prepared while the check is pending (V3).
    s = reducer(s, { type: 'seller/saveProduct', draft, status: 'online', at: at(50) });
    expect(activeSellerSpace(s)!.products).toHaveLength(1);
    // No payout before verification.
    s = reducer(s, { type: 'seller/withdraw', amount: 1_000, at: at(55) });
    expect(s.lastError?.code).toBe('NOT_VERIFIED');

    s = reducer(s, { type: 'seller/demoApprove', at: at(60) });
    expect(activeSellerSpace(s)!.status).toBe('verified');
    expect(currentAccount(s.auth)!.roles).toContain('seller');
    expect(currentAccount(s.auth)!.pendingRoles).not.toContain('seller');
  });

  it('lets an existing buyer open a shop from the profile', () => {
    let s = signIn(createInitialState(T0), DEMO_PHONE_EXISTING);
    expect(effectiveMode(s)).toBe('buyer');
    s = reducer(s, { type: 'app/setMode', mode: 'seller', at: at(10) });
    expect(s.lastError?.code).toBe('NOT_SELLER');
    s = reducer(s, { type: 'seller/saveProfile', profile: shopProfile, at: at(11) });
    s = reducer(s, { type: 'app/setMode', mode: 'seller', at: at(12) });
    expect(effectiveMode(s)).toBe('seller');
  });
});

describe('catalogue (US-12)', () => {
  it('validates photos, price and compare-at price, and keeps drafts without a price', () => {
    let s = signIn(createInitialState(T0), DEMO_PHONE_SELLER);
    const before = activeSellerSpace(s)!.products.length;
    s = reducer(s, { type: 'seller/saveProduct', draft: { ...draft, photos: [] }, status: 'online', at: at(10) });
    expect(s.lastError?.code).toBe('INVALID_PRODUCT');
    s = reducer(s, { type: 'seller/saveProduct', draft: { ...draft, compareAt: '40 000' }, status: 'online', at: at(11) });
    expect(s.lastError?.code).toBe('INVALID_PRICE');
    s = reducer(s, { type: 'seller/saveProduct', draft: { ...draft, price: '' }, status: 'draft', at: at(12) });
    const saved = activeSellerSpace(s)!.products[0]!;
    expect(saved.status).toBe('draft');
    expect(saved.price).toBe(0);
    s = reducer(s, { type: 'seller/setOnline', id: saved.id, online: true, at: at(13) });
    expect(s.lastError?.code).toBe('NO_PRICE');
    s = reducer(s, { type: 'seller/deleteProduct', id: saved.id, at: at(14) });
    expect(activeSellerSpace(s)!.products).toHaveLength(before);
  });

  it('warns on low stock and on stock-outs (V13)', () => {
    const s = signIn(createInitialState(T0), DEMO_PHONE_SELLER);
    const space = activeSellerSpace(s)!;
    const kinds = sellerNotices(shopOrders(s, space.shopId), space.products, at(60)).map((n) => n.title);
    expect(kinds).toEqual(expect.arrayContaining(['Stock faible', 'Rupture de stock', 'Nouvelle commande #YY-24875']));
  });
});

describe('orders and hand-over (US-13)', () => {
  it('signs the seeded seller into the seller app with two new paid orders', () => {
    const s = signIn(createInitialState(T0), DEMO_PHONE_SELLER);
    expect(effectiveMode(s)).toBe('seller');
    const orders = shopOrders(s, activeSellerSpace(s)!.shopId);
    expect(orders.filter((o) => o.seller === 'new').map((o) => o.id).sort()).toEqual(['YY-24871', 'YY-24875']);
  });

  it('prepares, marks ready and hands over only with the pick-up code', () => {
    let s = signIn(createInitialState(T0), DEMO_PHONE_SELLER);
    const id = 'YY-24875';
    s = run(
      s,
      { type: 'seller/orderEvent', orderId: id, event: { type: 'seller.start_preparing' }, at: at(10) },
      { type: 'seller/orderEvent', orderId: id, event: { type: 'seller.mark_ready' }, at: at(20) },
    );
    expect(s.orders[id]!.seller).toBe('ready');
    expect(s.orders[id]!.courier?.name).toBe('Patrick K.');
    s = reducer(s, { type: 'order/event', orderId: id, event: { type: 'courier.accept' }, actor: 'courier', at: at(30) });
    s = reducer(s, { type: 'order/event', orderId: id, event: { type: 'courier.collect', code: 'A000' === pickupCodeFor(id) ? 'B000' : 'A000' }, actor: 'courier', at: at(31) });
    expect(s.lastError?.code).toBe('WRONG_PICKUP_CODE');
    s = reducer(s, { type: 'seller/demoCourierPickup', orderId: id, at: at(40) });
    expect(s.orders[id]!.seller).toBe('handed_over');
    expect(s.orders[id]!.payment).toBe('in_delivery');
  });

  it('never lets a seller act on another shop’s order', () => {
    let s = signIn(createInitialState(T0), DEMO_PHONE_SELLER);
    s = reducer(s, { type: 'seller/orderEvent', orderId: 'YY-24790', event: { type: 'seller.start_preparing' }, at: at(10) });
    expect(s.lastError?.code).toBe('NOT_FOUND');
  });

  it('routes a buyer’s purchase to the seller, and keeps each buyer’s orders private', () => {
    let s = signIn(createInitialState(T0), DEMO_PHONE_EXISTING);
    s = reducer(s, { type: 'checkout/pay', at: at(10) });
    const ck = s.checkouts[s.activeCheckoutId!]!;
    s = reducer(s, { type: 'checkout/providerResult', checkoutId: ck.id, attempt: 1, outcome: 'approved', at: at(15) });
    const jeanOrders = confirmedOrders(s).map((o) => o.id);
    expect(jeanOrders).toEqual(expect.arrayContaining(ck.orderIds));
    expect(jeanOrders).not.toContain('YY-24875'); // Junior K.'s order

    s = reducer(s, { type: 'auth/signOut' });
    s = signIn(s, DEMO_PHONE_SELLER, 100);
    const mine = shopOrders(s, activeSellerSpace(s)!.shopId);
    const fromJean = mine.find((o) => ck.orderIds.includes(o.id))!;
    expect(fromJean.buyer).toEqual({ name: 'Jean M.', commune: 'Kalamu' });
    expect(fromJean.seller).toBe('new');
    expect(confirmedOrders(s)).toHaveLength(0);
  });
});

describe('revenue (US-14)', () => {
  it('separates the withdrawable balance from escrow and refuses overdrafts', () => {
    let s = signIn(createInitialState(T0), DEMO_PHONE_SELLER);
    const space = activeSellerSpace(s)!;
    const r = revenue(shopOrders(s, space.shopId), [], at(20));
    expect(r.available).toBe(orderNet({ itemsTotal: 310_000 }).net + orderNet({ itemsTotal: 3 * 95_000 + 310_000 }).net);
    expect(r.blocked).toBeGreaterThan(0);
    s = reducer(s, { type: 'seller/withdraw', amount: r.available + 1, at: at(30) });
    expect(s.lastError?.code).toBe('INSUFFICIENT_BALANCE');
    s = reducer(s, { type: 'seller/withdraw', amount: 100_000, at: at(31) });
    const after = revenue(shopOrders(s, space.shopId), activeSellerSpace(s)!.withdrawals, at(40));
    expect(after.available).toBe(r.available - 100_000);
    expect(after.movements[0]!.amount).toBe(-100_000);
  });
});

describe('migration', () => {
  it('upgrades a v4 session without losing the cart, and gives old orders to Jean', () => {
    const v4 = { ...createInitialState(T0), version: 4 } as Partial<AppState>;
    delete v4.seller;
    delete v4.courier;
    delete v4.mode;
    const orders = { ...v4.orders! };
    orders['YY-24790'] = { ...orders['YY-24790']!, buyerId: undefined, buyer: undefined };
    const restored = restoreState({ ...v4, orders }, T0);
    expect(restored.version).toBe(STATE_VERSION);
    expect(restored.cart).toHaveLength(3);
    expect(restored.orders['YY-24790']!.buyerId).toBe('U-1');
    expect(restored.mode).toBe('buyer');
    expect(restored.auth.accounts['U-3']!.roles).toContain('seller');
  });
});
