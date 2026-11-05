import { describe, expect, it } from '@jest/globals';
import { currentAccount, DEMO_COURIER_ID, DEMO_PHONE_COURIER, DEMO_PHONE_EXISTING, DEMO_PHONE_SELLER } from '../auth';
import { cashDue, docsError, earnings, missionPay, missionStage, missionTab, profileError, type CourierProfile } from '../courier';
import { pickupCodeFor } from '../seller';
import {
  activeCourierSpace,
  courierMissions,
  createInitialState,
  effectiveMode,
  reducer,
  restoreState,
  STATE_VERSION,
  type Action,
  type AppState,
} from '../state';

const T0 = '2026-11-05T10:00:00.000Z';
const at = (s: number) => new Date(new Date(T0).getTime() + s * 1000).toISOString();

function run(state: AppState, ...actions: Action[]): AppState {
  return actions.reduce(reducer, state);
}

function signIn(state: AppState, phone: string, t = 0): AppState {
  const s = run(state, { type: 'auth/onboarded' }, { type: 'auth/requestCode', kind: 'phone', target: phone, channel: 'sms', code: '123456', at: at(t) });
  return reducer(s, { type: 'auth/verifyCode', code: '123456', at: at(t + 5) });
}

const mine = (s: AppState) => courierMissions(s, s.auth.session?.accountId);

const profile: CourierProfile = { transport: 'Moto', plate: 'kn 7788 ab', zones: ['Kalamu'], payoutPhone: '97 555 1234' };

describe('courier pay and cash rules', () => {
  it('pays 3 000 FC + 500 FC/km, and the base only for a failed mission', () => {
    expect(missionPay({ mission: { id: 'M-1', distanceKm: 11, proposedAt: T0, declinedBy: [] }, delivery: 'assigned' })).toBe(8_500);
    expect(missionPay({ mission: { id: 'M-1', distanceKm: 6, proposedAt: T0, declinedBy: [] }, delivery: 'delivered' })).toBe(6_000);
    expect(missionPay({ mission: { id: 'M-1', distanceKm: 7, proposedAt: T0, declinedBy: [] }, delivery: 'failed' })).toBe(3_000);
  });

  it('asks for a licence and a registration card only for a motorised vehicle', () => {
    expect(profileError({ ...profile, plate: '' })).toMatch(/plaque/);
    expect(profileError({ ...profile, transport: 'Vélo', plate: '' })).toBeNull();
    expect(profileError({ ...profile, zones: [] })).toMatch(/commune/);
    expect(docsError('Moto', { idDoc: 1, selfie: 2 })).toMatch(/permis/);
    expect(docsError('Vélo', { idDoc: 1, selfie: 2 })).toBeNull();
  });
});

describe('becoming a courier (US-15)', () => {
  it('goes from A8 to a validated courier, the role granted only by YA YO', () => {
    let s = signIn(createInitialState(T0), '97 555 1234');
    s = run(
      s,
      { type: 'auth/createAccount', profile: { name: 'Héritier Mbala', city: 'Kinshasa', commune: 'Kalamu', acceptTerms: true }, at: at(20) },
      { type: 'auth/chooseRole', role: 'courier', at: at(25) },
    );
    expect(effectiveMode(s)).toBe('courier');
    expect(currentAccount(s.auth)!.roles).toEqual(['buyer']);

    s = reducer(s, { type: 'courier/saveProfile', profile: { ...profile, plate: '' }, at: at(30) });
    expect(s.lastError?.code).toBe('INVALID_PROFILE');
    s = reducer(s, { type: 'courier/saveProfile', profile, at: at(31) });
    expect(activeCourierSpace(s)!.profile.plate).toBe('KN 7788 AB');
    expect(activeCourierSpace(s)!.profile.payoutPhone).toBe('+243975551234');

    s = reducer(s, { type: 'courier/submitDocs', docs: { idDoc: 1, selfie: 2 }, at: at(40) });
    expect(s.lastError?.code).toBe('INVALID_DOCS');
    s = reducer(s, { type: 'courier/submitDocs', docs: { idDoc: 1, license: 3, registration: 4, selfie: 2 }, at: at(41) });
    expect(activeCourierSpace(s)!.status).toBe('submitted');
    expect(currentAccount(s.auth)!.pendingRoles).toContain('courier');

    // No missions before the validation.
    s = reducer(s, { type: 'courier/setAvailable', available: true, at: at(45) });
    expect(s.lastError?.code).toBe('NOT_VERIFIED');

    s = reducer(s, { type: 'courier/demoApprove', at: at(50) });
    expect(activeCourierSpace(s)!.status).toBe('verified');
    expect(activeCourierSpace(s)!.available).toBe(false);
    expect(currentAccount(s.auth)!.roles).toContain('courier');
  });
});

describe('missions (US-16, US-17)', () => {
  it('signs Patrick into the courier app with one proposal and one mission in progress', () => {
    const s = signIn(createInitialState(T0), DEMO_PHONE_COURIER);
    expect(effectiveMode(s)).toBe('courier');
    const tabs = mine(s).map((o) => `${o.mission!.id}:${missionTab(o)}`);
    expect(tabs).toEqual(expect.arrayContaining(['M-5521:proposed', 'M-5530:active', 'M-5498:done']));
  });

  it('runs the whole journey: buyer pays cash, seller prepares, courier collects with the seller code and delivers with the buyer code', () => {
    // Jean buys a JBL speaker, cash on delivery.
    let s = signIn(createInitialState(T0), DEMO_PHONE_EXISTING);
    s = run(
      s,
      { type: 'cart/remove', productId: 'jbl-charge-5', color: 'Bleu', at: at(10) },
      { type: 'cart/remove', productId: 'jbl-tune-510', color: 'Noir', at: at(11) },
      { type: 'draft/update', patch: { method: 'cash' } },
      { type: 'checkout/pay', at: at(12) },
    );
    const id = s.checkouts[s.activeCheckoutId!]!.orderIds[0]!;
    const total = s.orders[id]!.total;
    const receipt = s.orders[id]!.receiptCode;

    // Grâce prepares it: the dispatcher proposes it to Patrick, who is available.
    s = signIn(reducer(s, { type: 'auth/signOut' }), DEMO_PHONE_SELLER, 20);
    s = run(
      s,
      { type: 'seller/orderEvent', orderId: id, event: { type: 'seller.start_preparing' }, at: at(30) },
      { type: 'seller/orderEvent', orderId: id, event: { type: 'seller.mark_ready' }, at: at(31) },
    );
    expect(s.orders[id]!.courier?.id).toBe(DEMO_COURIER_ID);
    expect(s.orders[id]!.mission?.id).toMatch(/^M-\d{4}$/);

    // Patrick accepts, collects with the seller's code, arrives, delivers with Jean's code.
    s = signIn(reducer(s, { type: 'auth/signOut' }), DEMO_PHONE_COURIER, 40);
    expect(missionStage(s.orders[id]!)).toBe('proposed');
    s = reducer(s, { type: 'courier/orderEvent', orderId: id, event: { type: 'courier.accept' }, at: at(50) });
    s = reducer(s, { type: 'courier/orderEvent', orderId: id, event: { type: 'courier.collect', code: 'Z999' }, at: at(60) });
    expect(s.lastError?.code).toBe('WRONG_PICKUP_CODE');
    s = run(
      s,
      { type: 'courier/orderEvent', orderId: id, event: { type: 'courier.collect', code: pickupCodeFor(id).toLowerCase() }, at: at(61) },
      { type: 'courier/orderEvent', orderId: id, event: { type: 'courier.arrive' }, at: at(70) },
    );
    expect(missionStage(s.orders[id]!)).toBe('handover');
    s = reducer(s, { type: 'courier/orderEvent', orderId: id, event: { type: 'courier.confirm_delivery', code: receipt }, at: at(80) });
    expect(s.lastError?.code).toBe('CASH_NOT_COLLECTED');
    s = reducer(s, { type: 'courier/orderEvent', orderId: id, event: { type: 'courier.confirm_delivery', code: receipt, cashCollected: true }, at: at(81) });
    expect(s.orders[id]!.delivery).toBe('delivered');
    expect(s.orders[id]!.payment).toBe('released');

    // The cash is due to YA YO, then paid back by Mobile Money.
    const space = activeCourierSpace(s)!;
    const due = cashDue(mine(s), space.remittances);
    expect(due.orders.map((o) => o.id)).toContain(id);
    expect(due.amount).toBe(185_000 + 115_000 + total);
    s = reducer(s, { type: 'courier/remitCash', channel: 'mobile_money', at: at(90) });
    expect(cashDue(mine(s), activeCourierSpace(s)!.remittances).amount).toBe(0);
    s = reducer(s, { type: 'courier/remitCash', channel: 'mobile_money', at: at(91) });
    expect(s.lastError?.code).toBe('NOTHING_DUE');
  });

  it('gives a refused mission to another courier, never back to the one who refused', () => {
    let s = signIn(createInitialState(T0), DEMO_PHONE_COURIER);
    s = reducer(s, { type: 'courier/decline', orderId: 'YY-24860', at: at(10) });
    expect(s.orders['YY-24860']!.courier?.id).toBeUndefined();
    expect(s.orders['YY-24860']!.mission!.declinedBy).toEqual([DEMO_COURIER_ID]);
    expect(mine(s).find((o) => o.id === 'YY-24860')).toBeUndefined();
  });

  it('hands pending proposals over when the courier goes offline (L12), and stops new ones', () => {
    let s = signIn(createInitialState(T0), DEMO_PHONE_COURIER);
    s = reducer(s, { type: 'courier/setAvailable', available: false, at: at(10) });
    expect(mine(s).filter((o) => missionTab(o) === 'proposed')).toHaveLength(0);
    // The mission in progress stays his.
    expect(mine(s).filter((o) => missionTab(o) === 'active')).toHaveLength(1);

    s = signIn(reducer(s, { type: 'auth/signOut' }), DEMO_PHONE_SELLER, 20);
    s = reducer(s, { type: 'seller/orderEvent', orderId: 'YY-24875', event: { type: 'seller.start_preparing' }, at: at(30) });
    s = reducer(s, { type: 'seller/orderEvent', orderId: 'YY-24875', event: { type: 'seller.mark_ready' }, at: at(31) });
    expect(s.orders['YY-24875']!.courier?.id).toBeUndefined();
  });

  it('never lets a courier act on another courier’s mission', () => {
    let s = signIn(createInitialState(T0), DEMO_PHONE_COURIER);
    s = reducer(s, { type: 'courier/orderEvent', orderId: 'YY-24871', event: { type: 'courier.accept' }, at: at(10) });
    expect(s.lastError?.code).toBe('NOT_FOUND');
  });

  it('declares a failed delivery only with a proof photo; the funds stay with YA YO', () => {
    let s = signIn(createInitialState(T0), DEMO_PHONE_COURIER);
    const id = 'YY-24862';
    s = run(
      s,
      { type: 'courier/orderEvent', orderId: id, event: { type: 'courier.collect', code: pickupCodeFor(id) }, at: at(10) },
      { type: 'courier/orderEvent', orderId: id, event: { type: 'courier.report_incident', reason: 'absent', photo: '' }, at: at(20) },
    );
    expect(s.lastError?.code).toBe('PROOF_REQUIRED');
    s = reducer(s, { type: 'courier/orderEvent', orderId: id, event: { type: 'courier.report_incident', reason: 'address', photo: 1 }, at: at(21) });
    expect(s.orders[id]!.delivery).toBe('failed');
    expect(s.orders[id]!.payment).toBe('in_delivery');
    expect(missionPay(s.orders[id]!)).toBe(3_000);
  });
});

describe('earnings (US-19)', () => {
  it('counts the day’s missions, failures at base pay', () => {
    const s = signIn(createInitialState(T0), DEMO_PHONE_COURIER);
    const day = earnings(mine(s), 'day', T0);
    // M-5512 (4,2 km) and M-5517 (8 km) delivered earlier today.
    expect(day.missions).toBe(2);
    expect(day.gains).toBe(3_000 + 2_100 + 3_000 + 4_000);
  });

  it('keeps the seeded deliveries on today’s figures just after midnight', () => {
    const early = new Date(T0);
    early.setHours(0, 20, 0, 0);
    const s = signIn(createInitialState(early.toISOString()), DEMO_PHONE_COURIER);
    expect(earnings(mine(s), 'day', early.toISOString()).missions).toBe(2);
  });
});

describe('migration', () => {
  it('upgrades a v5 session and adds the demo courier without touching the cart', () => {
    const v5 = { ...createInitialState(T0), version: 5 } as Partial<AppState>;
    delete v5.courier;
    const restored = restoreState(v5, T0);
    expect(restored.version).toBe(STATE_VERSION);
    expect(restored.cart).toHaveLength(3);
    expect(restored.courier[DEMO_COURIER_ID]!.status).toBe('verified');
    expect(restored.orderSeq).toBeGreaterThanOrEqual(24880);
  });
});
