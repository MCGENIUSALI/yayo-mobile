import { describe, expect, it } from '@jest/globals';
import { addressError, addressLine } from '../account';
import { authGate, DEMO_PHONE_EXISTING, DEMO_PHONE_SELLER } from '../auth';
import { canCancel } from '../orderMachine';
import {
  buyerAddresses,
  confirmedOrders,
  createInitialState,
  defaultAddressId,
  deletionBlockers,
  orderTab,
  reducer,
  restoreState,
  STATE_VERSION,
  type Action,
  type AppState,
} from '../state';

const T0 = '2026-11-02T10:00:00.000Z';
const at = (s: number) => new Date(new Date(T0).getTime() + s * 1000).toISOString();
const run = (s: AppState, ...a: Action[]) => a.reduce(reducer, s);

function signIn(state: AppState, phone: string, t = 0): AppState {
  let s = run(state, { type: 'auth/onboarded' }, { type: 'auth/requestCode', kind: 'phone', target: phone, channel: 'sms', code: '123456', at: at(t) });
  return reducer(s, { type: 'auth/verifyCode', code: '123456', at: at(t + 5) });
}

/** Jean pays the seeded cart; returns the state and the new orders. */
function paid(method: 'mobile_money' | 'cash' = 'mobile_money') {
  let s = signIn(createInitialState(T0), DEMO_PHONE_EXISTING);
  s = run(s, { type: 'draft/update', patch: { method } }, { type: 'checkout/pay', at: at(10) });
  const ck = s.checkouts[s.activeCheckoutId!]!;
  if (method === 'mobile_money') s = reducer(s, { type: 'checkout/providerResult', checkoutId: ck.id, attempt: 1, outcome: 'approved', at: at(14) });
  return { s, ids: ck.orderIds };
}

const home = { label: 'Chez maman', city: 'Kinshasa', commune: 'Lingwala', street: 'Av. de la Victoire 45', landmark: 'Portail vert', phone: '82 111 2233' };

describe('guest browsing (A9–A10)', () => {
  it('opens the buyer app to guests after onboarding', () => {
    const s0 = createInitialState(T0);
    expect(authGate(s0.auth)).toBe('onboarding');
    const s1 = reducer(s0, { type: 'auth/onboarded' });
    expect(authGate(s1.auth)).toBe('guest');
    expect(authGate(signIn(s0, DEMO_PHONE_EXISTING).auth)).toBe('app');
  });

  it('asks for an account before adding to the cart or paying', () => {
    const guest = reducer(createInitialState(T0), { type: 'auth/onboarded' });
    const added = reducer(guest, { type: 'cart/add', productId: 'jbl-pulse-5', color: 'Noir', qty: 1, at: T0 });
    expect(added.lastError?.code).toBe('NOT_SIGNED_IN');
    expect(added.cart).toBe(guest.cart);
    expect(reducer(guest, { type: 'checkout/pay', at: T0 }).lastError?.code).toBe('NOT_SIGNED_IN');
  });
});

describe('addresses (D13–D15)', () => {
  it('lists the default address first and validates new ones', () => {
    const s = signIn(createInitialState(T0), DEMO_PHONE_EXISTING);
    expect(buyerAddresses(s)[0]?.id).toBe('home');
    expect(addressError({ ...home, street: 'Av' })?.field).toBe('street');
    expect(addressError({ ...home, commune: 'Kampemba' })?.field).toBe('commune');
    expect(addressError({ ...home, phone: '12 345' })?.field).toBe('phone');
    expect(addressLine({ street: 'Av. Lumumba 3', commune: 'Kenya', city: 'Lubumbashi' })).toBe('Av. Lumumba 3, Kenya, Lubumbashi');
  });

  it('adds, makes default, edits and deletes an address', () => {
    let s = signIn(createInitialState(T0), DEMO_PHONE_EXISTING);
    s = reducer(s, { type: 'address/save', input: home, makeDefault: true, at: at(20) });
    const added = buyerAddresses(s)[0]!;
    expect(added.label).toBe('Chez maman');
    expect(added.line).toBe('Av. de la Victoire 45, Lingwala');
    expect(added.phone).toBe('+243 82 111 2233');
    expect(defaultAddressId(s)).toBe(added.id);
    // The new address is selected for the order being placed (C2).
    expect(s.draft.addressId).toBe(added.id);

    s = reducer(s, { type: 'address/save', id: added.id, input: { ...home, label: 'Maman' }, makeDefault: true, at: at(21) });
    expect(buyerAddresses(s).find((a) => a.id === added.id)?.label).toBe('Maman');

    s = reducer(s, { type: 'address/delete', id: added.id, at: at(22) });
    expect(buyerAddresses(s).some((a) => a.id === added.id)).toBe(false);
    // Deleting the default promotes another address and fixes the draft.
    expect(defaultAddressId(s)).toBeDefined();
    expect(s.draft.addressId).toBe(defaultAddressId(s));
  });

  it('refuses an invalid address and an address from another account', () => {
    let s = signIn(createInitialState(T0), DEMO_PHONE_EXISTING);
    expect(reducer(s, { type: 'address/save', input: { ...home, label: '' }, makeDefault: false, at: at(20) }).lastError?.code).toBe('INVALID_ADDRESS');
    s = run(s, { type: 'auth/signOut' } as Action);
    s = signIn(s, DEMO_PHONE_SELLER, 100);
    expect(reducer(s, { type: 'address/setDefault', id: 'home', at: at(120) }).lastError?.code).toBe('NOT_FOUND');
  });

  it('pays only to one of the account’s addresses and keeps the line on the order', () => {
    let s = signIn(createInitialState(T0), DEMO_PHONE_EXISTING);
    expect(run(s, { type: 'draft/update', patch: { addressId: 'nowhere' } }, { type: 'checkout/pay', at: at(10) }).lastError?.code).toBe('NO_ADDRESS');
    s = run(s, { type: 'address/save', input: home, makeDefault: false, at: at(20) }, { type: 'draft/update', patch: { method: 'cash' } }, { type: 'checkout/pay', at: at(30) });
    const order = s.orders[s.checkouts[s.activeCheckoutId!]!.orderIds[0]!]!;
    expect(order.dropoff).toBe('Av. de la Victoire 45, Lingwala');
  });
});

describe('cancel an order (D18–D19)', () => {
  it('refunds a prepaid order cancelled before the hand-over', () => {
    const { s, ids } = paid();
    const id = ids[0]!;
    expect(canCancel(s.orders[id]!)).toBe(true);
    let c = reducer(s, { type: 'order/cancel', orderId: id, reason: 'too_slow', at: at(30) });
    const o = c.orders[id]!;
    expect(o.payment).toBe('refunded');
    expect(o.cancellation).toMatchObject({ reason: 'too_slow', refund: 'sent' });
    expect(orderTab(o)).toBe('disputes');
    // Frozen: the seller can no longer prepare it.
    expect(reducer(c, { type: 'order/event', orderId: id, event: { type: 'seller.start_preparing' }, actor: 'seller', at: at(31) } as Action).lastError?.code).toBe(
      'INVALID_TRANSITION',
    );
    c = reducer(c, { type: 'order/refundReceived', orderId: id, at: at(40) });
    expect(c.orders[id]!.cancellation).toMatchObject({ refund: 'received', refundedAt: at(40) });
  });

  it('has nothing to refund on a cash order', () => {
    const { s, ids } = paid('cash');
    const c = reducer(s, { type: 'order/cancel', orderId: ids[0]!, reason: 'cheaper', at: at(30) });
    expect(c.orders[ids[0]!]!.cancellation?.refund).toBe('none');
    expect(c.orders[ids[0]!]!.payment).toBe('failed');
  });

  it('refuses once the parcel is with the courier, and for another buyer', () => {
    const { s, ids } = paid();
    const id = ids[0]!;
    const e = (type: 'seller.start_preparing' | 'seller.mark_ready' | 'courier.accept') =>
      ({ type: 'order/event', orderId: id, event: { type }, actor: 'seller', at: at(20) }) as Action;
    let t = run(s, e('seller.start_preparing'), e('seller.mark_ready'), e('courier.accept'));
    expect(canCancel(t.orders[id]!)).toBe(true);
    const order = t.orders[id]!;
    t = { ...t, orders: { ...t.orders, [id]: { ...order, seller: 'handed_over', delivery: 'delivering', payment: 'in_delivery' } } };
    expect(reducer(t, { type: 'order/cancel', orderId: id, reason: 'other', at: at(30) }).lastError?.code).toBe('INVALID_TRANSITION');

    const other = signIn(run(s, { type: 'auth/signOut' } as Action), DEMO_PHONE_SELLER, 100);
    expect(reducer(other, { type: 'order/cancel', orderId: id, reason: 'other', at: at(130) }).lastError?.code).toBe('NOT_FOUND');
  });
});

describe('support (D16–D17)', () => {
  it('greets once, keeps the order context and validates messages', () => {
    let s = signIn(createInitialState(T0), DEMO_PHONE_EXISTING);
    s = run(s, { type: 'support/open', at: at(10) }, { type: 'support/open', at: at(11) });
    const me = s.auth.session!.accountId;
    expect(s.support[me]).toHaveLength(1);
    expect(s.support[me]![0]!.text).toContain('Bonjour Jean');
    const orderId = confirmedOrders(s)[0]!.id;
    s = reducer(s, { type: 'support/send', text: '  Où est mon colis ?  ', orderId, at: at(12) });
    expect(s.support[me]![1]).toMatchObject({ from: 'me', text: 'Où est mon colis ?', orderId });
    expect(reducer(s, { type: 'support/send', text: '   ', at: at(13) }).lastError?.code).toBe('EMPTY_MESSAGE');
    s = reducer(s, { type: 'support/agentReply', text: 'Bien reçu.', at: at(15) });
    expect(s.support[me]!.at(-1)?.from).toBe('agent');
  });

  it('needs an account', () => {
    const guest = reducer(createInitialState(T0), { type: 'auth/onboarded' });
    expect(reducer(guest, { type: 'support/open', at: T0 }).lastError?.code).toBe('NOT_SIGNED_IN');
  });
});

describe('delete my account (D9–D12)', () => {
  const askCode = (s: AppState, t: number) =>
    reducer(s, { type: 'auth/requestCode', kind: 'phone', target: DEMO_PHONE_EXISTING, channel: 'sms', code: '654321', at: at(t), purpose: 'delete' });

  it('is blocked while an order is still running (D10)', () => {
    const { s, ids } = paid();
    expect(deletionBlockers(s)).toContainEqual({ kind: 'order', orderId: ids[0] });
    const asked = askCode(s, 100);
    expect(reducer(asked, { type: 'auth/deleteAccount', code: '654321', at: at(110) }).lastError?.code).toBe('DELETION_BLOCKED');
    // A cancelled order still blocks until the refund has arrived.
    const c = reducer(s, { type: 'order/cancel', orderId: ids[0]!, reason: 'other', at: at(30) });
    expect(deletionBlockers(c)).toContainEqual({ kind: 'refund', orderId: ids[0] });
  });

  it('sends the code only to the account’s own number', () => {
    const s = signIn(createInitialState(T0), DEMO_PHONE_EXISTING);
    const r = reducer(s, { type: 'auth/requestCode', kind: 'phone', target: '97 555 1234', channel: 'sms', code: '654321', at: at(100), purpose: 'delete' });
    expect(r.lastError?.code).toBe('NOT_OWNER');
  });

  it('deletes personal data with the right code and keeps anonymised orders', () => {
    let s = signIn(createInitialState(T0), DEMO_PHONE_EXISTING);
    s = { ...s, orders: Object.fromEntries(Object.entries(s.orders).filter(([, o]) => o.buyerId !== s.auth.session!.accountId || o.payment === 'released')) };
    expect(deletionBlockers(s)).toEqual([]);
    const me = s.auth.session!.accountId;
    const pastIds = Object.values(s.orders).filter((o) => o.buyerId === me).map((o) => o.id);
    s = run(s, { type: 'support/open', at: at(50) });
    s = askCode(s, 100);
    // A delete code never signs in, and a wrong code counts as an attempt.
    expect(reducer(s, { type: 'auth/verifyCode', code: '654321', at: at(101) }).lastError?.code).toBe('NO_CHALLENGE');
    const wrong = reducer(s, { type: 'auth/deleteAccount', code: '000000', at: at(102) });
    expect(wrong.auth.challenge?.attemptsLeft).toBe(2);
    expect(wrong.auth.accounts[me]).toBeDefined();

    const done = reducer(wrong, { type: 'auth/deleteAccount', code: '654321', at: at(103) });
    expect(done.auth.session).toBeUndefined();
    expect(done.auth.accounts[me]).toBeUndefined();
    expect(done.auth.signedOutReason).toBe('deleted');
    expect(authGate(done.auth)).toBe('guest');
    expect(done.addressBook[me]).toBeUndefined();
    expect(done.support[me]).toBeUndefined();
    expect(done.cart).toEqual([]);
    for (const id of pastIds) {
      expect(done.orders[id]!.buyerId).toBeUndefined();
      expect(done.orders[id]!.buyer?.name ?? 'Client').toBe('Client');
    }
    expect(JSON.stringify(done.events)).not.toContain('Jean');
  });
});

describe('persistence', () => {
  it('migrates a v6 save: seeds the address book and an empty support inbox', () => {
    const s = createInitialState(T0);
    const { addressBook: _a, support: _s, ...v6 } = { ...s, version: 6 };
    const restored = restoreState(v6, T0);
    expect(restored.version).toBe(STATE_VERSION);
    expect(restored.addressBook['U-1']?.defaultId).toBe('home');
    expect(restored.support).toEqual({});
  });
});
