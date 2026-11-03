import { getProduct } from './catalog';
import { applyOrderEvent, receiptCodeFor, type OrderEvent } from './orderMachine';
import { detectOperator } from './paymentProvider';
import { rememberQuery } from './search';
import { summarizeCart, splitDiscount } from './pricing';
import type {
  CartLine,
  Checkout,
  DomainEvent,
  Order,
  PaymentFailureReason,
  PaymentMethod,
} from './types';

export const STATE_VERSION = 3;

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
    orders: { [past.id]: past },
    orderSeq: 24868,
    checkoutSeq: 1,
    events: [{ id: 'EV-1', at: now, actor: 'system', type: 'demo.seeded' }],
    social: { liked: [], saved: [], reposted: [], following: ['mama-luka-mode'], wishlist: [] },
    search: { recent: [...SEED_RECENT_SEARCHES] },
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
  if (s.version === 2 && s.social) {
    return {
      ...(s as AppState),
      version: STATE_VERSION,
      social: { ...s.social, wishlist: [] },
      search: { recent: [...SEED_RECENT_SEARCHES] },
      lastError: undefined,
    };
  }
  return createInitialState(now);
}

/** Pure reducer: the only place where business state changes. */
export function reducer(state: AppState, action: Action): AppState {
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
      const result = applyOrderEvent(order, action.event, action.at);
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

    case 'demo/reset':
      return createInitialState(action.at);
  }
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

export const confirmedOrders = (s: AppState): Order[] =>
  Object.values(s.orders)
    .filter((o) => s.checkouts[o.checkoutId]?.status === 'succeeded')
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
