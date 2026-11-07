import { describe, expect, it } from '@jest/globals';
import { formatFC, formatUSD } from '../money';
import { detectOperator, formatLocalMsisdn } from '../paymentProvider';
import { applyOrderEvent, nextRoleEvents } from '../orderMachine';
import { splitDiscount, summarizeCart } from '../pricing';
import { pickupCodeFor } from '../seller';
import { confirmedOrders, createInitialState, reducer, type Action, type AppState } from '../state';

const T0 = '2026-11-02T10:00:00.000Z';
const at = (s: number) => new Date(new Date(T0).getTime() + s * 1000).toISOString();

function run(state: AppState, ...actions: Action[]): AppState {
  return actions.reduce(reducer, state);
}

describe('money', () => {
  it('formats francs and indicative dollars like the Figma screens', () => {
    expect(formatFC(520_000)).toBe('520 000 FC');
    expect(formatUSD(520_000)).toBe('≈ 186 $');
    expect(formatUSD(95_000)).toBe('≈ 34 $');
  });
});

describe('pricing', () => {
  it('reproduces the C1 cart: 3 items, 2 sellers, YAYO10', () => {
    const s = createInitialState(T0);
    const sum = summarizeCart(s.cart, s.promoCode);
    expect(sum.groups.map((g) => g.shop.name)).toEqual(['JBL Store Kin', 'Audio Plus Gombe']);
    expect(sum.itemsTotal).toBe(530_000);
    expect(sum.deliveryTotal).toBe(10_000);
    expect(sum.discount).toBe(20_000);
    expect(sum.total).toBe(520_000);
  });

  it('splits a discount without losing a franc', () => {
    const parts = splitDiscount([405_000, 125_000], 20_000);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(20_000);
  });
});

describe('checkout → escrow', () => {
  it('creates one order per seller whose totals add up to the amount paid', () => {
    const s = run(createInitialState(T0), { type: 'checkout/pay', at: at(0) });
    const ck = s.checkouts[s.activeCheckoutId!]!;
    expect(ck.status).toBe('pending');
    expect(ck.orderIds).toHaveLength(2);
    const sum = ck.orderIds.reduce((t, id) => t + s.orders[id]!.total, 0);
    expect(sum).toBe(ck.amount);
    expect(ck.amount).toBe(520_000);
  });

  it('ignores a double tap on "Payer" while the request is pending', () => {
    const s1 = run(createInitialState(T0), { type: 'checkout/pay', at: at(0) });
    const s2 = reducer(s1, { type: 'checkout/pay', at: at(1) });
    expect(s2).toBe(s1);
  });

  it('holds funds in escrow and empties the cart when the provider approves', () => {
    let s = run(createInitialState(T0), { type: 'checkout/pay', at: at(0) });
    const ck = s.checkouts[s.activeCheckoutId!]!;
    s = reducer(s, { type: 'checkout/providerResult', checkoutId: ck.id, attempt: 1, outcome: 'approved', at: at(5) });
    expect(s.checkouts[ck.id]!.status).toBe('succeeded');
    ck.orderIds.forEach((id) => expect(s.orders[id]!.payment).toBe('held_in_escrow'));
    expect(s.cart).toHaveLength(0);
    expect(confirmedOrders(s).map((o) => o.id)).toEqual(expect.arrayContaining(ck.orderIds));
  });

  it('keeps unpaid orders out of "Mes commandes" and allows a retry after failure', () => {
    let s = run(createInitialState(T0), { type: 'checkout/pay', at: at(0) });
    const id = s.activeCheckoutId!;
    s = reducer(s, { type: 'checkout/providerResult', checkoutId: id, attempt: 1, outcome: 'insufficient_funds', at: at(3) });
    expect(s.checkouts[id]!.status).toBe('failed');
    expect(confirmedOrders(s).some((o) => o.checkoutId === id)).toBe(false);
    expect(s.cart).toHaveLength(3); // nothing lost

    s = reducer(s, { type: 'checkout/pay', at: at(10) });
    expect(s.checkouts[id]!.status).toBe('pending');
    expect(s.checkouts[id]!.attempt).toBe(2);
  });

  it('ignores a stale provider callback from a previous attempt', () => {
    let s = run(createInitialState(T0), { type: 'checkout/pay', at: at(0) });
    const id = s.activeCheckoutId!;
    s = reducer(s, { type: 'checkout/providerResult', checkoutId: id, attempt: 1, outcome: 'expired', at: at(105) });
    s = reducer(s, { type: 'checkout/pay', at: at(110) });
    const late = reducer(s, { type: 'checkout/providerResult', checkoutId: id, attempt: 1, outcome: 'approved', at: at(111) });
    expect(late).toBe(s);
  });

  it('refuses a retry after the 30 minute hold', () => {
    let s = run(createInitialState(T0), { type: 'checkout/pay', at: at(0) });
    const id = s.activeCheckoutId!;
    s = reducer(s, { type: 'checkout/providerResult', checkoutId: id, attempt: 1, outcome: 'declined', at: at(3) });
    s = reducer(s, { type: 'checkout/pay', at: at(31 * 60) });
    expect(s.lastError?.code).toBe('HOLD_EXPIRED');
  });

  it('creates a new checkout when the cart changed after a failure', () => {
    let s = run(createInitialState(T0), { type: 'checkout/pay', at: at(0) });
    const first = s.activeCheckoutId!;
    s = reducer(s, { type: 'checkout/providerResult', checkoutId: first, attempt: 1, outcome: 'declined', at: at(3) });
    s = reducer(s, { type: 'cart/remove', productId: 'jbl-tune-510', color: 'Noir', at: at(4) });
    s = reducer(s, { type: 'checkout/pay', at: at(5) });
    expect(s.activeCheckoutId).not.toBe(first);
    expect(s.checkouts[s.activeCheckoutId!]!.orderIds).toHaveLength(1);
  });

  it('confirms cash on delivery immediately without holding funds', () => {
    let s = createInitialState(T0);
    s = run(s, { type: 'draft/update', patch: { method: 'cash' } }, { type: 'checkout/pay', at: at(0) });
    const ck = s.checkouts[s.activeCheckoutId!]!;
    expect(ck.status).toBe('succeeded');
    ck.orderIds.forEach((id) => expect(s.orders[id]!.payment).toBe('pending'));
  });

  it('rejects an invalid Mobile Money number', () => {
    let s = createInitialState(T0);
    s = run(s, { type: 'draft/update', patch: { msisdn: '81 23' } }, { type: 'checkout/pay', at: at(0) });
    expect(s.lastError?.code).toBe('INVALID_MSISDN');
    expect(s.activeCheckoutId).toBeUndefined();
  });
});

describe('order state machine (cross-role)', () => {
  function paidOrder() {
    let s = run(createInitialState(T0), { type: 'checkout/pay', at: at(0) });
    const ck = s.checkouts[s.activeCheckoutId!]!;
    s = reducer(s, { type: 'checkout/providerResult', checkoutId: ck.id, attempt: 1, outcome: 'approved', at: at(5) });
    return { s, id: ck.orderIds[0]! };
  }

  it('walks the full happy path and releases funds only after the receipt code', () => {
    let { s, id } = paidOrder();
    const step = (event: Extract<Action, { type: 'order/event' }>['event'], actor: 'seller' | 'courier', t: number) =>
      (s = reducer(s, { type: 'order/event', orderId: id, event, actor, at: at(t) }));
    step({ type: 'seller.start_preparing' }, 'seller', 10);
    step({ type: 'seller.mark_ready' }, 'seller', 20);
    step({ type: 'courier.accept' }, 'courier', 30);
    step({ type: 'courier.collect', code: 'Z999' }, 'courier', 39);
    expect(s.lastError?.code).toBe('WRONG_PICKUP_CODE');
    step({ type: 'courier.collect', code: pickupCodeFor(id) }, 'courier', 40);
    expect(s.orders[id]!.payment).toBe('in_delivery');

    step({ type: 'courier.confirm_delivery', code: '0000' }, 'courier', 50);
    expect(s.lastError?.code).toBe('WRONG_RECEIPT_CODE');
    expect(s.orders[id]!.payment).toBe('in_delivery');

    step({ type: 'courier.confirm_delivery', code: s.orders[id]!.receiptCode }, 'courier', 60);
    expect(s.orders[id]!.delivery).toBe('delivered');
    expect(s.orders[id]!.payment).toBe('released');
    expect(s.events.map((e) => e.type)).toEqual(expect.arrayContaining(['courier.confirm_delivery', 'escrow.release']));
  });

  it('never lets a seller prepare an unpaid order', () => {
    let s = run(createInitialState(T0), { type: 'checkout/pay', at: at(0) });
    const id = s.checkouts[s.activeCheckoutId!]!.orderIds[0]!;
    const r = applyOrderEvent(s.orders[id]!, { type: 'seller.start_preparing' }, at(1));
    expect(r.ok).toBe(false);
  });

  it('cannot release funds before delivery', () => {
    const { s, id } = paidOrder();
    expect(applyOrderEvent(s.orders[id]!, { type: 'escrow.release' }, at(9)).ok).toBe(false);
    expect(nextRoleEvents(s.orders[id]!)).toEqual(['seller.start_preparing']);
  });

  it('requires the cash to be collected for cash-on-delivery orders', () => {
    let s = run(createInitialState(T0), { type: 'draft/update', patch: { method: 'cash' } }, { type: 'checkout/pay', at: at(0) });
    const id = s.checkouts[s.activeCheckoutId!]!.orderIds[0]!;
    for (const event of [
      { type: 'seller.start_preparing' },
      { type: 'seller.mark_ready' },
      { type: 'courier.accept' },
      { type: 'courier.collect', code: pickupCodeFor(id) },
    ] as const) {
      s = reducer(s, { type: 'order/event', orderId: id, event, actor: 'seller', at: at(5) });
    }
    const code = s.orders[id]!.receiptCode;
    s = reducer(s, { type: 'order/event', orderId: id, event: { type: 'courier.confirm_delivery', code }, actor: 'courier', at: at(6) });
    expect(s.lastError?.code).toBe('CASH_NOT_COLLECTED');
    s = reducer(s, {
      type: 'order/event',
      orderId: id,
      event: { type: 'courier.confirm_delivery', code, cashCollected: true },
      actor: 'courier',
      at: at(7),
    });
    expect(s.orders[id]!.payment).toBe('released');
  });
});

describe('cart', () => {
  it('limits quantities to the stock', () => {
    const s = reducer(createInitialState(T0), { type: 'cart/setQty', productId: 'jbl-charge-5', color: 'Bleu', qty: 7, at: T0 });
    expect(s.lastError?.code).toBe('STOCK_LIMIT');
    expect(s.cart.find((l) => l.productId === 'jbl-charge-5')!.qty).toBe(1);
  });

  it('refuses an out-of-stock product', () => {
    const s = reducer(createInitialState(T0), { type: 'cart/add', productId: 'earbuds-pro', color: 'Orange', qty: 1, at: T0 });
    expect(s.lastError?.code).toBe('OUT_OF_STOCK');
  });
});

describe('mobile money number', () => {
  it('detects the operator from the RDC prefix and rejects unknown prefixes', () => {
    expect(detectOperator('81 234 5678')).toBe('M-Pesa');
    expect(detectOperator('85 000 0000')).toBe('Orange Money');
    expect(detectOperator('99 876 5432')).toBe('Airtel Money');
    expect(formatLocalMsisdn('812345678')).toBe('81 234 5678');
    const s = run(createInitialState(T0), { type: 'draft/update', patch: { msisdn: '71 234 5678' } }, { type: 'checkout/pay', at: at(0) });
    expect(s.lastError?.code).toBe('UNKNOWN_OPERATOR');
  });
});
