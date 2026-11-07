import {
  authReduce,
  createAuthState,
  currentAccount,
  demoCourierAccount,
  demoSellerAccount,
  DEMO_COURIER_ID,
  DEMO_PHONE_COURIER,
  DEMO_SELLER_ID,
  type AuthAction,
  type AuthState,
} from './auth';
import { getProduct } from './catalog';
import {
  cashDue,
  courierCard,
  courierReduce,
  distanceKmFor,
  FLEET_COURIER,
  missionIdFor,
  missionTab,
  type CourierAction,
  type CourierSpace,
} from './courier';
import { seedCourierOrders, seedCourierSpace, withCourierHistory } from './courierSeed';
import { applyOrderEvent, receiptCodeFor, type OrderEvent } from './orderMachine';
import { detectOperator } from './paymentProvider';
import { rememberQuery } from './search';
import { pickupCodeFor, revenue, sellerReduce, type SellerAction, type SellerSpace } from './seller';
import { seedSellerOrders, seedSellerSpace, SELLER_CHECKOUT_ID } from './sellerSeed';
import { summarizeCart, splitDiscount } from './pricing';
import type {
  CartLine,
  Checkout,
  Courier,
  DomainEvent,
  Order,
  PaymentFailureReason,
  PaymentMethod,
} from './types';

export const STATE_VERSION = 6;

/** Mobile Money request lifetime shown on C4 ("La demande expire dans 01:45"). */
export const MOMO_REQUEST_TTL_MS = 105_000;
/** Unpaid orders are kept 30 minutes after a failed payment (C6). */
export const FAILED_HOLD_MS = 30 * 60_000;

export interface CheckoutDraft {
  addressId: string;
  slotId: string;
  note: string;
  method: PaymentMethod;
  msisdn: string;
}

export interface SocialState {
  liked: string[];
  saved: string[];
  reposted: string[];
  following: string[];
  /** Product favourites (heart on B2, B4, B5). */
  wishlist: string[];
}

export type SocialToggle = 'liked' | 'saved' | 'reposted' | 'following' | 'wishlist';

/** Recent searches seeded from Figma E4. */
export const SEED_RECENT_SEARCHES = ['Chaussures sport', 'JBL Go 3'];

export type AppMode = 'buyer' | 'seller' | 'courier';

export interface AppState {
  version: number;
  cart: CartLine[];
  promoCode?: string;
  draft: CheckoutDraft;
  checkouts: Record<string, Checkout>;
  orders: Record<string, Order>;
  orderSeq: number;
  checkoutSeq: number;
  activeCheckoutId?: string;
  events: DomainEvent[];
  /** Buyer's social state on the discovery feed (SC1–SC3). */
  social: SocialState;
  /** Explorer: recent searches, most recent first (E4). */
  search: { recent: string[] };
  /** US-01: accounts, OTP challenge and session (mock, see auth.ts). */
  auth: AuthState;
  /** US-10 à US-14: one seller space per account (shop, KYC, catalogue, payouts). */
  seller: Record<string, SellerSpace>;
  /** US-15 à US-19: one courier space per account (vehicle, KYC, availability, cash paid back). */
  courier: Record<string, CourierSpace>;
  /** Which app the signed-in account is using (V12 "Passer en mode acheteur"). */
  mode: AppMode;
  /** Last rejected action, for UI feedback. Never persisted as business state. */
  lastError?: { code: string; message: string; at: string };
}

export type Action =
  | { type: 'cart/add'; productId: string; color: string; qty: number; at: string }
  | { type: 'cart/setQty'; productId: string; color: string; qty: number; at: string }
  | { type: 'cart/remove'; productId: string; color: string; at: string }
  | { type: 'draft/update'; patch: Partial<CheckoutDraft> }
  | { type: 'social/toggle'; list: SocialToggle; id: string; at: string }
  | { type: 'search/remember'; query: string; at: string }
  | { type: 'search/clearRecent'; at: string }
  | (AuthAction & { at?: string })
  | SellerAction
  /** Seller app (V5–V7): same order machine, restricted to the seller's own orders. */
  | { type: 'seller/orderEvent'; orderId: string; event: Extract<OrderEvent, { type: 'seller.start_preparing' | 'seller.mark_ready' }>; at: string }
  /** Demo only (V7): plays the courier typing the pick-up code. */
  | { type: 'seller/demoCourierPickup'; orderId: string; at: string }
  | CourierAction
  /** Courier app (L4–L9): same order machine, restricted to the courier's own missions. */
  | {
      type: 'courier/orderEvent';
      orderId: string;
      event: Extract<OrderEvent, { type: 'courier.accept' | 'courier.collect' | 'courier.arrive' | 'courier.confirm_delivery' | 'courier.report_incident' }>;
      at: string;
    }
  /** L4 "Refuser": the mission goes to another courier. */
  | { type: 'courier/decline'; orderId: string; at: string }
  | { type: 'app/setMode'; mode: AppMode; at: string }
  | { type: 'checkout/pay'; at: string }
  | {
      type: 'checkout/providerResult';
      checkoutId: string;
      attempt: number;
      outcome: 'approved' | PaymentFailureReason;
      at: string;
    }
  | { type: 'checkout/cancelRequest'; checkoutId: string; at: string }
  | { type: 'checkout/close'; checkoutId: string }
  | { type: 'order/event'; orderId: string; event: OrderEvent; actor: DomainEvent['actor']; at: string }
  | { type: 'demo/reset'; at: string };

const addMs = (iso: string, ms: number) => new Date(new Date(iso).getTime() + ms).toISOString();

function log(state: AppState, e: Omit<DomainEvent, 'id'>): DomainEvent[] {
  return [...state.events, { ...e, id: `EV-${state.events.length + 1}` }];
}

function reject(state: AppState, code: string, message: string, at: string): AppState {
  return { ...state, lastError: { code, message, at } };
}

const sameLine = (l: CartLine, productId: string, color: string) => l.productId === productId && l.color === color;

export function createInitialState(now: string): AppState {
  const pastSeq = 24790;
  const past: Order = {
    id: `YY-${pastSeq}`,
    checkoutId: 'CK-0',
    shopId: 'tech-lingwala',
    lines: [{ productId: 'earbuds-pro', name: 'Earbuds Pro – Orange', color: 'Orange', qty: 1, unitPrice: 82_000 }],
    itemsTotal: 82_000,
    deliveryFee: 5_000,
    discount: 0,
    total: 87_000,
    method: 'mobile_money',
    payment: 'released',
    seller: 'handed_over',
    delivery: 'delivered',
    receiptCode: receiptCodeFor(pastSeq),
    buyerId: 'U-1',
    buyer: { name: 'Jean M.', commune: 'Kalamu' },
    addressId: 'home',
    slotId: 'asap',
    milestones: {
      createdAt: '2026-10-15T09:02:00.000Z',
      paidAt: '2026-10-15T09:03:00.000Z',
      preparedAt: '2026-10-15T11:40:00.000Z',
      pickedUpAt: '2026-10-15T13:55:00.000Z',
      deliveredAt: '2026-10-15T14:41:00.000Z',
      releasedAt: '2026-10-15T14:41:00.000Z',
    },
  };
  const sellerSeed = seedSellerOrders(now);
  const courierSeed = seedCourierOrders(now);
  return {
    version: STATE_VERSION,
    cart: [
      { productId: 'jbl-go-3', color: 'Jaune', qty: 1 },
      { productId: 'jbl-charge-5', color: 'Bleu', qty: 1 },
      { productId: 'jbl-tune-510', color: 'Noir', qty: 1 },
    ],
    promoCode: 'YAYO10',
    draft: {
      addressId: 'home',
      slotId: 'asap',
      note: '',
      method: 'mobile_money',
      msisdn: '81 234 5678',
    },
    checkouts: {
      [SELLER_CHECKOUT_ID]: sellerSeed.checkout,
      ...Object.fromEntries(courierSeed.checkouts.map((c) => [c.id, c])),
      'CK-0': {
        id: 'CK-0',
        orderIds: [past.id],
        amount: past.total,
        method: 'mobile_money',
        operator: 'M-Pesa',
        msisdn: '81 234 5678',
        status: 'succeeded',
        attempt: 1,
      },
    },
    orders: withCourierHistory({ [past.id]: past, ...sellerSeed.orders, ...courierSeed.orders }),
    // New purchases are numbered after the seeded orders (YY-24790 to YY-24875).
    orderSeq: 24880,
    checkoutSeq: 1,
    events: [{ id: 'EV-1', at: now, actor: 'system', type: 'demo.seeded' }],
    social: { liked: [], saved: [], reposted: [], following: ['mama-luka-mode'], wishlist: [] },
    search: { recent: [...SEED_RECENT_SEARCHES] },
    auth: createAuthState(),
    seller: { [DEMO_SELLER_ID]: seedSellerSpace(now) },
    courier: { [DEMO_COURIER_ID]: seedCourierSpace(now) },
    mode: 'buyer',
  };
}

/**
 * Restores a persisted session. Older versions are upgraded instead of wiped,
 * so an update never empties the buyer's cart or loses a pending order.
 */
export function restoreState(saved: unknown, now: string): AppState {
  const s = saved as Partial<AppState> | null;
  if (!s || typeof s !== 'object' || typeof s.version !== 'number') return createInitialState(now);
  if (s.version === STATE_VERSION) return { ...(s as AppState), lastError: undefined };
  if (s.version === 5 && s.auth && s.seller) return toV6(s as AppState, now);
  if ((s.version === 2 || s.version === 3) && s.social) {
    return toV6(toV5(
      {
        ...(s as AppState),
        social: { ...s.social, wishlist: s.social.wishlist ?? [] },
        search: s.search ?? { recent: [...SEED_RECENT_SEARCHES] },
        // Sessions did not exist before v4: the buyer signs in once.
        auth: createAuthState(),
      },
      now,
    ), now);
  }
  if (s.version === 4 && s.auth) return toV6(toV5(s as AppState, now), now);
  return createInitialState(now);
}

/** v5 adds the seller app: seeded seller account, shop and orders; existing orders belong to Jean (the only buyer before v5). */
function toV5(s: AppState, now: string): AppState {
  const seed = seedSellerOrders(now);
  const orders: Record<string, Order> = {};
  for (const [id, o] of Object.entries(s.orders)) orders[id] = o.buyerId ? o : { ...o, buyerId: 'U-1', buyer: o.buyer ?? { name: 'Jean M.', commune: 'Kalamu' } };
  for (const [id, o] of Object.entries(seed.orders)) if (!orders[id]) orders[id] = o;
  return {
    ...s,
    version: 5,
    orders,
    checkouts: { ...s.checkouts, [SELLER_CHECKOUT_ID]: s.checkouts[SELLER_CHECKOUT_ID] ?? seed.checkout },
    auth: s.auth.accounts[DEMO_SELLER_ID]
      ? s.auth
      : { ...s.auth, accounts: { ...s.auth.accounts, [DEMO_SELLER_ID]: demoSellerAccount() }, accountSeq: Math.max(s.auth.accountSeq, 3) },
    seller: s.seller ?? { [DEMO_SELLER_ID]: seedSellerSpace(now) },
    mode: s.mode ?? 'buyer',
    lastError: undefined,
  };
}

/** v6 adds the courier app: seeded courier account, space and missions; past deliveries become Patrick's missions. */
function toV6(s: AppState, now: string): AppState {
  const seed = seedCourierOrders(now);
  const orders: Record<string, Order> = { ...s.orders };
  for (const [id, o] of Object.entries(seed.orders)) if (!orders[id]) orders[id] = o;
  const checkouts = { ...s.checkouts };
  for (const c of seed.checkouts) if (!checkouts[c.id]) checkouts[c.id] = c;
  // A v5 account may already use the demo courier's number: then the demo courier is not added.
  const phoneTaken = Object.values(s.auth.accounts).some((a) => a.phone === DEMO_PHONE_COURIER && a.id !== DEMO_COURIER_ID);
  const auth = s.auth.accounts[DEMO_COURIER_ID] || phoneTaken ? s.auth : { ...s.auth, accounts: { ...s.auth.accounts, [DEMO_COURIER_ID]: demoCourierAccount() } };
  return {
    ...s,
    version: STATE_VERSION,
    orders: withCourierHistory(orders),
    checkouts,
    orderSeq: Math.max(s.orderSeq, 24880),
    auth,
    courier: s.courier ?? (phoneTaken ? {} : { [DEMO_COURIER_ID]: seedCourierSpace(now) }),
    lastError: undefined,
  };
}

/** Pure reducer: the only place where business state changes. */
export function reducer(state: AppState, action: Action): AppState {
  if (action.type.startsWith('auth/')) return reduceAuth(state, action as AuthAction & { at?: string });
  if (action.type.startsWith('seller/') && action.type !== 'seller/orderEvent' && action.type !== 'seller/demoCourierPickup')
    return reduceSeller(state, action as SellerAction);
  if (action.type.startsWith('courier/') && action.type !== 'courier/orderEvent' && action.type !== 'courier/decline')
    return reduceCourier(state, action as CourierAction);
  switch (action.type) {
    case 'cart/add': {
      const product = getProduct(action.productId);
      const existing = state.cart.find((l) => sameLine(l, action.productId, action.color));
      const wanted = (existing?.qty ?? 0) + action.qty;
      const error = addToCartError(state, action.productId, action.color, action.qty);
      if (error) return reject(state, product.stock <= 0 ? 'OUT_OF_STOCK' : 'STOCK_LIMIT', error, action.at);
      const cart = existing
        ? state.cart.map((l) => (sameLine(l, action.productId, action.color) ? { ...l, qty: wanted } : l))
        : [...state.cart, { productId: action.productId, color: action.color, qty: action.qty }];
      return {
        ...state,
        cart,
        lastError: undefined,
        events: log(state, { at: action.at, actor: 'buyer', type: 'cart.added', detail: `${action.productId}×${action.qty}` }),
      };
    }
    case 'cart/setQty': {
      const product = getProduct(action.productId);
      if (action.qty <= 0) return reducer(state, { type: 'cart/remove', productId: action.productId, color: action.color, at: action.at });
      if (action.qty > product.stock)
        return reject(state, 'STOCK_LIMIT', `Il ne reste que ${product.stock} en stock.`, action.at);
      return {
        ...state,
        lastError: undefined,
        cart: state.cart.map((l) => (sameLine(l, action.productId, action.color) ? { ...l, qty: action.qty } : l)),
      };
    }
    case 'cart/remove':
      return {
        ...state,
        cart: state.cart.filter((l) => !sameLine(l, action.productId, action.color)),
        events: log(state, { at: action.at, actor: 'buyer', type: 'cart.removed', detail: action.productId }),
      };
    case 'draft/update':
      return { ...state, draft: { ...state.draft, ...action.patch } };

    case 'social/toggle': {
      const list = state.social[action.list];
      const on = !list.includes(action.id);
      return {
        ...state,
        social: { ...state.social, [action.list]: on ? [...list, action.id] : list.filter((x) => x !== action.id) },
        events: log(state, { at: action.at, actor: 'buyer', type: `social.${action.list}.${on ? 'on' : 'off'}`, detail: action.id }),
      };
    }

    case 'search/remember': {
      const recent = rememberQuery(state.search.recent, action.query);
      if (recent.join('\n') === state.search.recent.join('\n')) return state;
      return { ...state, search: { recent } };
    }
    case 'search/clearRecent':
      return state.search.recent.length ? { ...state, search: { recent: [] } } : state;

    case 'checkout/pay':
      return pay(state, action.at);

    case 'checkout/providerResult': {
      const ck = state.checkouts[action.checkoutId];
      // Stale or duplicate callbacks (older attempt, already settled) are ignored.
      if (!ck || ck.status !== 'pending' || ck.attempt !== action.attempt) return state;
      if (action.outcome === 'approved') {
        const orders = { ...state.orders };
        for (const id of ck.orderIds) {
          const o = orders[id];
          if (o) orders[id] = { ...o, payment: 'held_in_escrow', milestones: { ...o.milestones, paidAt: action.at } };
        }
        const purchased = new Set(ck.orderIds.flatMap((id) => orders[id]?.lines.map((l) => `${l.productId}|${l.color}`) ?? []));
        return {
          ...state,
          orders,
          cart: state.cart.filter((l) => !purchased.has(`${l.productId}|${l.color}`)),
          promoCode: undefined,
          checkouts: { ...state.checkouts, [ck.id]: { ...ck, status: 'succeeded', failureReason: undefined } },
          events: log(state, { at: action.at, actor: 'payment_provider', type: 'payment.held_in_escrow', checkoutId: ck.id }),
        };
      }
      const orders = { ...state.orders };
      for (const id of ck.orderIds) {
        const o = orders[id];
        if (o) orders[id] = { ...o, payment: 'failed', milestones: { ...o.milestones, failedAt: action.at } };
      }
      return {
        ...state,
        orders,
        checkouts: {
          ...state.checkouts,
          [ck.id]: {
            ...ck,
            status: action.outcome === 'expired' ? 'expired' : 'failed',
            failureReason: action.outcome,
            holdUntil: addMs(action.at, FAILED_HOLD_MS),
          },
        },
        events: log(state, {
          at: action.at,
          actor: action.outcome === 'expired' ? 'system' : 'payment_provider',
          type: 'payment.failed',
          checkoutId: ck.id,
          detail: action.outcome,
        }),
      };
    }

    case 'checkout/cancelRequest': {
      const ck = state.checkouts[action.checkoutId];
      if (!ck || ck.status === 'succeeded') return state;
      const orders = { ...state.orders };
      for (const id of ck.orderIds) {
        const o = orders[id];
        if (o) orders[id] = { ...o, payment: 'initiated' };
      }
      return {
        ...state,
        orders,
        checkouts: { ...state.checkouts, [ck.id]: { ...ck, status: 'awaiting_confirmation' } },
        events: log(state, { at: action.at, actor: 'buyer', type: 'payment.request_cancelled', checkoutId: ck.id }),
      };
    }

    case 'checkout/close':
      return state.activeCheckoutId === action.checkoutId ? { ...state, activeCheckoutId: undefined } : state;

    case 'order/event': {
      const order = state.orders[action.orderId];
      if (!order) return reject(state, 'NOT_FOUND', 'Commande introuvable.', action.at);
      // Parcel ready: the dispatcher proposes the mission to the best available courier (L4).
      const event: OrderEvent =
        action.event.type === 'seller.mark_ready' && !action.event.courier
          ? {
              ...action.event,
              courier: dispatchCourier(state, []),
              mission: { id: missionIdFor(order.id), distanceKm: distanceKmFor(order.id), proposedAt: action.at, declinedBy: [] },
            }
          : action.event;
      const result = applyOrderEvent(order, event, action.at);
      if (!result.ok) return reject(state, result.error.code, result.error.message, action.at);
      let next: AppState = {
        ...state,
        lastError: undefined,
        orders: { ...state.orders, [order.id]: result.order },
        events: log(state, { at: action.at, actor: action.actor, type: action.event.type, orderId: order.id }),
      };
      // Buyer confirmation (receipt code) triggers the escrow release, and nothing else.
      if (action.event.type === 'courier.confirm_delivery') {
        next = reducer(next, { type: 'order/event', orderId: order.id, event: { type: 'escrow.release' }, actor: 'system', at: action.at });
      }
      return next;
    }

    case 'seller/orderEvent': {
      const space = activeSellerSpace(state);
      const order = state.orders[action.orderId];
      if (!space || space.status !== 'verified') return reject(state, 'NOT_SELLER', 'Ta boutique doit être vérifiée pour traiter des commandes.', action.at);
      if (!order || order.shopId !== space.shopId) return reject(state, 'NOT_FOUND', 'Commande introuvable.', action.at);
      return reducer(state, { type: 'order/event', orderId: order.id, event: action.event, actor: 'seller', at: action.at });
    }

    case 'seller/demoCourierPickup': {
      const space = activeSellerSpace(state);
      const order = state.orders[action.orderId];
      if (!space || !order || order.shopId !== space.shopId) return reject(state, 'NOT_FOUND', 'Commande introuvable.', action.at);
      let next = state;
      if (order.delivery === 'assigned') next = reducer(next, { type: 'order/event', orderId: order.id, event: { type: 'courier.accept' }, actor: 'courier', at: action.at });
      return reducer(next, { type: 'order/event', orderId: order.id, event: { type: 'courier.collect', code: pickupCodeFor(order.id) }, actor: 'courier', at: action.at });
    }

    case 'courier/orderEvent': {
      const me = activeCourierSpace(state);
      const order = state.orders[action.orderId];
      if (!me || me.status !== 'verified') return reject(state, 'NOT_COURIER', 'Ton compte livreur doit être validé pour livrer.', action.at);
      if (!order || order.courier?.id !== me.accountId) return reject(state, 'NOT_FOUND', 'Mission introuvable.', action.at);
      return reducer(state, { type: 'order/event', orderId: order.id, event: action.event, actor: 'courier', at: action.at });
    }

    case 'courier/decline': {
      const me = activeCourierSpace(state);
      const order = state.orders[action.orderId];
      if (!me || !order || order.courier?.id !== me.accountId) return reject(state, 'NOT_FOUND', 'Mission introuvable.', action.at);
      const next = dispatchCourier(state, [...(order.mission?.declinedBy ?? []), me.accountId]);
      return reducer(state, { type: 'order/event', orderId: order.id, event: { type: 'courier.decline', by: me.accountId, next }, actor: 'courier', at: action.at });
    }

    case 'app/setMode': {
      if (action.mode === state.mode) return state;
      if (action.mode === 'seller' && !canUseSellerMode(state)) return reject(state, 'NOT_SELLER', 'Ouvre d’abord ta boutique.', action.at);
      if (action.mode === 'courier' && !canUseCourierMode(state)) return reject(state, 'NOT_COURIER', 'Inscris-toi d’abord comme livreur.', action.at);
      return { ...state, mode: action.mode };
    }

    case 'demo/reset': {
      // Resets the shopping demo, not the accounts or the session; the seeded seller gets its shop back.
      const fresh = createInitialState(action.at);
      return { ...fresh, auth: state.auth, mode: state.mode, seller: { ...state.seller, ...fresh.seller }, courier: { ...state.courier, ...fresh.courier } };
    }
    default:
      return state;
  }
}

function reduceAuth(state: AppState, action: AuthAction & { at?: string }): AppState {
  const r = authReduce(state.auth, action);
  const at = action.at ?? '';
  if (!r.ok) return { ...state, auth: r.auth ?? state.auth, lastError: { code: r.code, message: r.message, at } };
  const before = state.auth.session?.id;
  const after = r.auth.session;
  // A new session opens on the app the account uses: sellers land on their dashboard (V4).
  const roles = after ? (r.auth.accounts[after.accountId]?.roles ?? []) : [];
  let mode: AppMode =
    after && after.id !== before ? (roles.includes('seller') ? 'seller' : roles.includes('courier') ? 'courier' : 'buyer') : after ? state.mode : 'buyer';
  // A8 "Vendeur" / "Livreur": the new account lands in that app, on V1 or L1.
  if (action.type === 'auth/chooseRole' && action.role !== 'buyer') mode = action.role;
  return {
    ...state,
    auth: r.auth,
    mode,
    lastError: undefined,
    // Security log: event type only, never the phone, e-mail or code (same rule as the dashboard).
    events: r.event ? log(state, { at, actor: 'buyer', type: r.event }) : state.events,
  };
}

function pay(state: AppState, at: string): AppState {
  const active = state.activeCheckoutId ? state.checkouts[state.activeCheckoutId] : undefined;
  // Duplicate submission guard: a request is already waiting for the buyer's PIN.
  if (active?.status === 'pending') return state;

  const { draft } = state;
  const isCash = draft.method === 'cash';
  const msisdnDigits = draft.msisdn.replace(/\D/g, '');
  if (draft.method === 'mobile_money' && msisdnDigits.length !== 9)
    return reject(state, 'INVALID_MSISDN', 'Saisis un numéro Mobile Money à 9 chiffres.', at);
  if (draft.method === 'mobile_money' && !detectOperator(msisdnDigits))
    return reject(state, 'UNKNOWN_OPERATOR', 'Ce numéro n’est ni M-Pesa, ni Orange Money, ni Airtel Money.', at);

  // Retry on the same checkout (C4 "Renvoyer", C6 "Réessayer", or method changed) while orders are on hold,
  // as long as the cart has not changed since the orders were created.
  if (active && active.status !== 'succeeded' && active.cartKey === cartKey(state)) {
    if (active.holdUntil && at > active.holdUntil)
      return reject(state, 'HOLD_EXPIRED', 'Ta commande a expiré. Reprends depuis le panier.', at);
    return request(state, active, at);
  }

  if (state.cart.length === 0) return reject(state, 'EMPTY_CART', 'Ton panier est vide.', at);
  const summary = summarizeCart(state.cart, state.promoCode);
  const discounts = splitDiscount(
    summary.groups.map((g) => g.itemsTotal),
    summary.discount,
  );
  const checkoutId = `CK-${state.checkoutSeq}`;
  const orders: Record<string, Order> = { ...state.orders };
  const orderIds: string[] = [];
  summary.groups.forEach((g, i) => {
    const seq = state.orderSeq + i;
    const id = `YY-${seq}`;
    const discount = discounts[i] ?? 0;
    const deliveryFee = summary.deliveryTotal / summary.groups.length;
    orderIds.push(id);
    orders[id] = {
      id,
      checkoutId,
      shopId: g.shop.id,
      lines: g.lines.map((l) => ({
        productId: l.productId,
        name: l.product.shortName,
        color: l.color,
        qty: l.qty,
        unitPrice: l.product.price,
      })),
      itemsTotal: g.itemsTotal,
      deliveryFee,
      discount,
      total: g.itemsTotal + deliveryFee - discount,
      method: draft.method,
      payment: 'initiated',
      seller: 'new',
      delivery: 'unassigned',
      receiptCode: receiptCodeFor(seq),
      buyerId: state.auth.session?.accountId,
      buyer: buyerLabel(state),
      addressId: draft.addressId,
      slotId: draft.slotId,
      courierNote: draft.note.trim() || undefined,
      milestones: { createdAt: at },
    };
  });
  const checkout: Checkout = {
    id: checkoutId,
    orderIds,
    amount: summary.total,
    method: draft.method,
    status: 'awaiting_confirmation',
    attempt: 0,
    cartKey: cartKey(state),
  };
  const created: AppState = {
    ...state,
    orders,
    checkouts: { ...state.checkouts, [checkoutId]: checkout },
    orderSeq: state.orderSeq + summary.groups.length,
    checkoutSeq: state.checkoutSeq + 1,
    activeCheckoutId: checkoutId,
    events: log(state, { at, actor: 'buyer', type: 'checkout.created', checkoutId, detail: orderIds.join(',') }),
  };
  return isCash ? confirmCash(created, checkout, at) : request(created, checkout, at);
}

/** Identifies the cart content + promo a checkout was created from. */
export function cartKey(state: Pick<AppState, 'cart' | 'promoCode'>): string {
  const lines = state.cart.map((l) => `${l.productId}|${l.color}|${l.qty}`).sort();
  return `${lines.join(',')}#${state.promoCode ?? ''}`;
}

/** Sends (or re-sends) the payment request for the current draft method. */
function request(state: AppState, ck: Checkout, at: string): AppState {
  const { draft } = state;
  if (draft.method === 'cash') return confirmCash(state, ck, at);
  const attempt = ck.attempt + 1;
  const orders = { ...state.orders };
  for (const id of ck.orderIds) {
    const o = orders[id];
    if (o) orders[id] = { ...o, method: draft.method, payment: 'pending' };
  }
  const next: Checkout = {
    ...ck,
    method: draft.method,
    operator: draft.method === 'mobile_money' ? (detectOperator(draft.msisdn) ?? undefined) : undefined,
    msisdn: draft.method === 'mobile_money' ? draft.msisdn : undefined,
    status: 'pending',
    attempt,
    requestedAt: at,
    expiresAt: addMs(at, MOMO_REQUEST_TTL_MS),
    failureReason: undefined,
  };
  return {
    ...state,
    lastError: undefined,
    orders,
    checkouts: { ...state.checkouts, [ck.id]: next },
    events: log(state, { at, actor: 'buyer', type: 'payment.requested', checkoutId: ck.id, detail: `${draft.method}#${attempt}` }),
  };
}

/** Cash on delivery: order is confirmed now, the courier collects the money at hand-over. */
function confirmCash(state: AppState, ck: Checkout, at: string): AppState {
  const orders = { ...state.orders };
  for (const id of ck.orderIds) {
    const o = orders[id];
    if (o) orders[id] = { ...o, method: 'cash', payment: 'pending' };
  }
  const purchased = new Set(ck.orderIds.flatMap((id) => orders[id]?.lines.map((l) => `${l.productId}|${l.color}`) ?? []));
  return {
    ...state,
    lastError: undefined,
    orders,
    cart: state.cart.filter((l) => !purchased.has(`${l.productId}|${l.color}`)),
    promoCode: undefined,
    checkouts: {
      ...state.checkouts,
      [ck.id]: { ...ck, method: 'cash', status: 'succeeded', attempt: ck.attempt + 1, failureReason: undefined },
    },
    events: log(state, { at, actor: 'buyer', type: 'payment.cash_on_delivery', checkoutId: ck.id }),
  };
}

/* ---------- Selectors ---------- */

/** The signed-in buyer's paid orders ("Mes commandes"). */
export const confirmedOrders = (s: AppState): Order[] =>
  Object.values(s.orders)
    .filter((o) => s.checkouts[o.checkoutId]?.status === 'succeeded' && o.buyerId === s.auth.session?.accountId)
    .sort((a, b) => (a.milestones.createdAt < b.milestones.createdAt ? 1 : -1));

export type OrderTab = 'active' | 'delivered' | 'disputes';

export function orderTab(o: Order): OrderTab {
  if (o.payment === 'disputed' || o.payment === 'refunded') return 'disputes';
  if (o.delivery === 'delivered') return 'delivered';
  return 'active';
}

/** Same rule as `cart/add`, usable by the UI before dispatching (no duplicated logic). */
export function addToCartError(state: AppState, productId: string, color: string, qty: number): string | null {
  const product = getProduct(productId);
  if (product.stock <= 0) return 'Ce produit est en rupture de stock.';
  const inCart = state.cart.find((l) => sameLine(l, productId, color))?.qty ?? 0;
  if (inCart + qty > product.stock) return `Il ne reste que ${product.stock} en stock.`;
  return null;
}

/** Count shown on a post, including the buyer's own action. */
export function socialCount(base: number, active: boolean): number {
  return base + (active ? 1 : 0);
}

/* ---------- Seller ---------- */

function buyerLabel(state: AppState): Order['buyer'] {
  const acc = currentAccount(state.auth);
  if (!acc) return undefined;
  const [first = '', ...rest] = acc.name.split(' ');
  const last = rest.at(-1);
  return { name: last ? `${first} ${last[0]}.` : first, commune: acc.commune };
}

/** Seller space of the signed-in account, if V1 was saved. */
export function activeSellerSpace(state: AppState): SellerSpace | undefined {
  const id = state.auth.session?.accountId;
  return id ? state.seller[id] : undefined;
}

/** Seller app reachable: a shop exists, or the seller role is granted or requested. */
export function canUseSellerMode(state: AppState): boolean {
  const acc = currentAccount(state.auth);
  if (!acc) return false;
  return !!state.seller[acc.id] || acc.roles.includes('seller') || acc.pendingRoles.includes('seller');
}

export function effectiveMode(state: AppState): AppMode {
  if (state.mode === 'seller' && canUseSellerMode(state)) return 'seller';
  if (state.mode === 'courier' && canUseCourierMode(state)) return 'courier';
  return 'buyer';
}

/** Paid orders of the seller's shop, most recent first (V5). */
export function shopOrders(state: AppState, shopId: string | undefined): Order[] {
  if (!shopId) return [];
  return Object.values(state.orders)
    .filter((o) => o.shopId === shopId && state.checkouts[o.checkoutId]?.status === 'succeeded')
    .sort((a, b) => (a.milestones.createdAt < b.milestones.createdAt ? 1 : -1));
}

function reduceSeller(state: AppState, action: SellerAction): AppState {
  const acc = currentAccount(state.auth);
  if (!acc) return reject(state, 'NO_SESSION', 'Connecte-toi d’abord.', action.at);
  const space = state.seller[acc.id];
  const available = space ? revenue(shopOrders(state, space.shopId), space.withdrawals, action.at).available : 0;
  const r = sellerReduce(space, action, { accountId: acc.id, available, shopId: space?.shopId ?? `shop-${acc.id}` });
  if (!r.ok) return reject(state, r.code, r.message, action.at);
  let next: AppState = {
    ...state,
    seller: { ...state.seller, [acc.id]: r.space },
    lastError: undefined,
    events: r.event ? log(state, { at: action.at, actor: 'seller', type: r.event }) : state.events,
  };
  // V2 files the seller request; the demo approval plays the YA YO team.
  if (action.type === 'seller/submitKyc') next = reduceAuth(next, { type: 'auth/requestRole', role: 'seller', at: action.at });
  if (action.type === 'seller/demoApprove' && acc.pendingRoles.includes('seller'))
    next = reduceAuth(next, { type: 'auth/demoGrantRole', role: 'seller', at: action.at });
  return next;
}

/* ---------- Courier ---------- */

/** Courier space of the signed-in account, if L1 was saved. */
export function activeCourierSpace(state: AppState): CourierSpace | undefined {
  const id = state.auth.session?.accountId;
  return id ? state.courier[id] : undefined;
}

/** Courier app reachable: L1 saved, or the courier role granted or requested (A8 "Livreur"). */
export function canUseCourierMode(state: AppState): boolean {
  const acc = currentAccount(state.auth);
  if (!acc) return false;
  return !!state.courier[acc.id] || acc.roles.includes('courier') || acc.pendingRoles.includes('courier');
}

/** Every mission ever proposed to this courier (and still theirs). */
export function courierMissions(state: AppState, accountId: string | undefined): Order[] {
  if (!accountId) return [];
  return Object.values(state.orders).filter((o) => o.mission && o.courier?.id === accountId);
}

/**
 * Dispatcher (mock): the verified, available courier with the fewest missions
 * in progress, the most recently available first; otherwise the simulated
 * YA YO fleet, so a parcel is never left without a courier.
 */
export function dispatchCourier(state: AppState, exclude: string[]): Courier {
  const candidates = Object.values(state.courier)
    .filter((c) => c.status === 'verified' && c.available && !exclude.includes(c.accountId))
    .map((c) => ({ c, account: state.auth.accounts[c.accountId] }))
    .filter((x) => x.account && x.account.status === 'active')
    .map((x) => ({ ...x, load: courierMissions(state, x.c.accountId).filter((o) => missionTab(o) === 'active').length }))
    .sort((a, b) => a.load - b.load || ((a.c.availableSince ?? '') < (b.c.availableSince ?? '') ? 1 : -1));
  const best = candidates[0];
  return best ? courierCard(best.account!, best.c) : FLEET_COURIER;
}

function reduceCourier(state: AppState, action: CourierAction): AppState {
  const acc = currentAccount(state.auth);
  if (!acc) return reject(state, 'NO_SESSION', 'Connecte-toi d’abord.', action.at);
  const space = state.courier[acc.id];
  const due = cashDue(courierMissions(state, acc.id), space?.remittances ?? []);
  const r = courierReduce(space, action, { accountId: acc.id, due });
  if (!r.ok) return reject(state, r.code, r.message, action.at);
  let next: AppState = {
    ...state,
    courier: { ...state.courier, [acc.id]: r.space },
    lastError: undefined,
    events: r.event ? log(state, { at: action.at, actor: 'courier', type: r.event }) : state.events,
  };
  // L2 files the courier request; the demo approval plays the YA YO admin.
  if (action.type === 'courier/submitDocs') next = reduceAuth(next, { type: 'auth/requestRole', role: 'courier', at: action.at });
  if (action.type === 'courier/demoApprove' && acc.pendingRoles.includes('courier'))
    next = reduceAuth(next, { type: 'auth/demoGrantRole', role: 'courier', at: action.at });
  // Going offline (L12) hands the proposals still waiting to other couriers.
  if (action.type === 'courier/setAvailable' && !action.available) {
    for (const o of courierMissions(next, acc.id).filter((m) => missionTab(m) === 'proposed')) {
      next = reducer(next, { type: 'courier/decline', orderId: o.id, at: action.at });
    }
    next = { ...next, lastError: undefined };
  }
  return next;
}
