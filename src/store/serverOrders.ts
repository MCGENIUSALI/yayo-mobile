import type { SupabaseClient } from '@supabase/supabase-js';
import { addressError, toAddress, type AddressBook, type AddressInput } from '@/domain/account';
import { normalizePhone } from '@/domain/auth';
import type { CartLine, Checkout, Order, PaymentMethod } from '@/domain/types';
import { supabase } from '@/lib/supabase';

/**
 * Adresses, passage de commande et suivi en mode serveur (C2, C3, C5, D1, D2,
 * V4 à V7). Les prix, le stock, la remise et les frais sont recalculés par la
 * base (place_checkout) : l'app n'envoie que les lignes, l'adresse et le moyen.
 */

export type OrdersFailure = { ok: false; code: string; message: string };
const fail = (code: string, message: string): OrdersFailure => ({ ok: false, code, message });
const NETWORK = fail('NETWORK', 'Pas de connexion au serveur YA YO. Vérifie ton réseau puis réessaie.');
const SERVER = fail('SERVER', 'Le serveur YA YO n’a pas pu enregistrer. Réessaie dans un instant.');
/** Mobile Money and card need the aggregator (FlexPay / pawaPay), not connected yet. */
export const PAYMENT_CLOSED = fail(
  'PAYMENT_CLOSED',
  'Le paiement Mobile Money et carte n’est pas encore ouvert. Choisis « Cash à la livraison » pour commander.',
);

function client(c?: SupabaseClient | null): SupabaseClient {
  const x = c ?? supabase;
  if (!x) throw new Error('Supabase non configuré');
  return x;
}

/** Errors raised by public.fail(): errcode P0001, the rule code in the hint, the French message as is. */
export function rpcFailure(error: { message?: string; code?: string; hint?: string | null } | null): OrdersFailure {
  if (error?.code === 'P0001' && error.hint && error.message) return fail(error.hint, error.message);
  if (!error?.code && /fetch|network/i.test(error?.message ?? '')) return NETWORK;
  return SERVER;
}

/* ---------- Adresses (C2, D13 à D15) ---------- */

export interface AddressRow {
  id: string;
  label: string;
  street: string;
  commune: string;
  city: string;
  landmark: string | null;
  phone: string;
  is_default: boolean;
  created_at: string;
}

export function toAddressBook(rows: AddressRow[]): AddressBook {
  const sorted = [...rows].sort((a, b) => (a.created_at < b.created_at ? -1 : 1));
  const items = sorted.map((r) =>
    toAddress(r.id, { label: r.label, street: r.street, commune: r.commune, city: r.city, landmark: r.landmark ?? undefined, phone: r.phone }),
  );
  return { items, defaultId: sorted.find((r) => r.is_default)?.id ?? items[0]?.id };
}

export async function loadAddresses(userId: string, c?: SupabaseClient | null): Promise<AddressBook> {
  const { data, error } = await client(c)
    .from('addresses')
    .select('id, label, street, commune, city, landmark, phone, is_default, created_at')
    .eq('user_id', userId);
  if (error) throw error;
  return toAddressBook((data ?? []) as AddressRow[]);
}

export type AddressWrite = { ok: true; id: string } | OrdersFailure;

export async function saveAddress(
  userId: string,
  id: string | undefined,
  input: AddressInput,
  makeDefault: boolean,
  c?: SupabaseClient | null,
): Promise<AddressWrite> {
  const err = addressError(input);
  if (err) return fail('INVALID_ADDRESS', err.message);
  const db = client(c);
  const a = toAddress(id ?? '', input);
  const row = { label: a.label, street: a.street!, commune: a.commune!, city: a.city!, landmark: a.landmark ?? null, phone: normalizePhone(input.phone)! };
  try {
    // One default per account (unique index): the old one is cleared first.
    if (makeDefault) await db.from('addresses').update({ is_default: false }).eq('user_id', userId).eq('is_default', true);
    if (id) {
      const { error } = await db.from('addresses').update(makeDefault ? { ...row, is_default: true } : row).eq('id', id);
      if (error) return SERVER;
      return { ok: true, id };
    }
    const { count } = await db.from('addresses').select('id', { count: 'exact', head: true }).eq('user_id', userId);
    const { data, error } = await db
      .from('addresses')
      .insert({ ...row, user_id: userId, is_default: makeDefault || !count })
      .select('id')
      .single();
    if (error || !data) return SERVER;
    return { ok: true, id: (data as { id: string }).id };
  } catch {
    return NETWORK;
  }
}

export async function deleteAddress(id: string, c?: SupabaseClient | null): Promise<AddressWrite> {
  try {
    const { error } = await client(c).from('addresses').delete().eq('id', id);
    return error ? SERVER : { ok: true, id };
  } catch {
    return NETWORK;
  }
}

export async function setDefaultAddress(userId: string, id: string, c?: SupabaseClient | null): Promise<AddressWrite> {
  const db = client(c);
  try {
    await db.from('addresses').update({ is_default: false }).eq('user_id', userId).eq('is_default', true);
    const { error } = await db.from('addresses').update({ is_default: true }).eq('id', id);
    return error ? SERVER : { ok: true, id };
  } catch {
    return NETWORK;
  }
}

/* ---------- Commande (C3 → C5) ---------- */

export interface CheckoutRequest {
  cart: CartLine[];
  addressId: string;
  slotId: string;
  method: PaymentMethod;
  promoCode?: string;
  note: string;
}

export type CheckoutWrite = { ok: true; checkoutId: string } | OrdersFailure;

export async function placeCheckout(req: CheckoutRequest, c?: SupabaseClient | null): Promise<CheckoutWrite> {
  if (req.method !== 'cash') return PAYMENT_CLOSED;
  if (req.cart.length === 0) return fail('EMPTY_CART', 'Ton panier est vide.');
  const db = client(c);
  try {
    // The cart keeps product + colour; the order line needs the variant.
    const ids = [...new Set(req.cart.map((l) => l.productId))];
    const { data: variants, error: vErr } = await db.from('product_variants').select('id, product_id, color').in('product_id', ids);
    if (vErr) return SERVER;
    const rows = (variants ?? []) as { id: string; product_id: string; color: string }[];
    const lines: { variant_id: string; qty: number }[] = [];
    for (const l of req.cart) {
      const v = rows.find((r) => r.product_id === l.productId && r.color === l.color) ?? (l.color ? undefined : rows.find((r) => r.product_id === l.productId));
      if (!v) return fail('UNAVAILABLE', 'Un article de ton panier n’est plus disponible.');
      lines.push({ variant_id: v.id, qty: l.qty });
    }
    const { data, error } = await db.rpc('place_checkout', {
      p_lines: lines,
      p_address: req.addressId,
      p_slot: req.slotId,
      p_method: req.method,
      p_promo: req.promoCode ?? null,
      p_note: req.note.trim() || null,
    });
    if (error) return rpcFailure(error);
    return { ok: true, checkoutId: data as string };
  } catch {
    return NETWORK;
  }
}

/* ---------- Commandes visibles (acheteur, vendeur) ---------- */

export interface OrderRow {
  id: string;
  number: string;
  checkout_id: string;
  buyer_id: string;
  shop_id: string;
  items_total: number;
  delivery_fee: number;
  discount: number;
  total: number;
  method: PaymentMethod;
  payment: Order['payment'];
  seller: Order['seller'];
  delivery: Order['delivery'];
  address_id: string | null;
  dropoff: string;
  buyer_label: string;
  buyer_commune: string;
  slot_id: string | null;
  courier_note: string | null;
  cash_collected: boolean | null;
  cancel_reason: string | null;
  cancel_note: string | null;
  refund: 'none' | 'sent' | 'received' | null;
  created_at: string;
  paid_at: string | null;
  prepared_at: string | null;
  accepted_at: string | null;
  picked_up_at: string | null;
  arrived_at: string | null;
  delivered_at: string | null;
  released_at: string | null;
  disputed_at: string | null;
  cancelled_at: string | null;
  order_lines: { product_id: string | null; name: string; color: string; qty: number; unit_price: number }[];
}

export interface CheckoutRow {
  id: string;
  amount: number;
  method: PaymentMethod;
  operator: Checkout['operator'] | null;
  msisdn: string | null;
  status: Checkout['status'];
  attempt: number;
  requested_at: string | null;
  expires_at: string | null;
  hold_until: string | null;
  failure_reason: Checkout['failureReason'] | null;
}

const opt = <T>(v: T | null): T | undefined => (v === null ? undefined : v);

export function toOrder(r: OrderRow, codes: { receipt?: string; pickup?: string } = {}): Order {
  return {
    id: r.number,
    serverId: r.id,
    checkoutId: r.checkout_id,
    shopId: r.shop_id,
    lines: r.order_lines.map((l) => ({ productId: l.product_id ?? '', name: l.name, color: l.color, qty: l.qty, unitPrice: l.unit_price })),
    itemsTotal: r.items_total,
    deliveryFee: r.delivery_fee,
    discount: r.discount,
    total: r.total,
    method: r.method,
    payment: r.payment,
    seller: r.seller,
    delivery: r.delivery,
    // Only the buyer gets it, while the parcel is on its way (my_receipt_code).
    receiptCode: codes.receipt ?? '',
    pickupCode: codes.pickup,
    buyerId: r.buyer_id,
    buyer: { name: r.buyer_label, commune: r.buyer_commune },
    addressId: r.address_id ?? '',
    dropoff: r.dropoff,
    slotId: r.slot_id ?? 'asap',
    courierNote: opt(r.courier_note),
    cashCollected: opt(r.cash_collected),
    cancellation:
      r.cancelled_at && r.cancel_reason
        ? {
            reason: r.cancel_reason as NonNullable<Order['cancellation']>['reason'],
            note: opt(r.cancel_note),
            at: r.cancelled_at,
            refund: r.refund ?? 'none',
          }
        : undefined,
    milestones: {
      createdAt: r.created_at,
      paidAt: opt(r.paid_at),
      preparedAt: opt(r.prepared_at),
      acceptedAt: opt(r.accepted_at),
      pickedUpAt: opt(r.picked_up_at),
      arrivedAt: opt(r.arrived_at),
      deliveredAt: opt(r.delivered_at),
      releasedAt: opt(r.released_at),
      disputedAt: opt(r.disputed_at),
      cancelledAt: opt(r.cancelled_at),
    },
  };
}

export function toCheckout(r: CheckoutRow, orderIds: string[]): Checkout {
  return {
    id: r.id,
    orderIds,
    amount: r.amount,
    method: r.method,
    operator: opt(r.operator),
    msisdn: opt(r.msisdn),
    status: r.status,
    attempt: r.attempt,
    requestedAt: opt(r.requested_at),
    expiresAt: opt(r.expires_at),
    holdUntil: opt(r.hold_until),
    failureReason: opt(r.failure_reason),
  };
}

export interface ServerOrders {
  orders: Record<string, Order>;
  checkouts: Record<string, Checkout>;
}

const ORDER_COLUMNS =
  'id, number, checkout_id, buyer_id, shop_id, items_total, delivery_fee, discount, total, method, payment, seller, delivery, address_id, dropoff, buyer_label, buyer_commune, slot_id, courier_note, cash_collected, cancel_reason, cancel_note, refund, created_at, paid_at, prepared_at, accepted_at, picked_up_at, arrived_at, delivered_at, released_at, disputed_at, cancelled_at, order_lines(product_id, name, color, qty, unit_price)';

/** Every order the account may see (as buyer and as seller), with the codes it is allowed to read. */
export async function loadOrders(userId: string, shopId: string | undefined, c?: SupabaseClient | null): Promise<ServerOrders> {
  const db = client(c);
  const { data, error } = await db.from('orders').select(ORDER_COLUMNS).order('created_at', { ascending: false }).limit(200);
  if (error) throw error;
  const rows = (data ?? []) as unknown as OrderRow[];
  const { data: ckData, error: ckErr } = await db
    .from('checkouts')
    .select('id, amount, method, operator, msisdn, status, attempt, requested_at, expires_at, hold_until, failure_reason')
    .eq('buyer_id', userId);
  if (ckErr) throw ckErr;

  const codes = await Promise.all(
    rows.map(async (r) => {
      const out: { receipt?: string; pickup?: string } = {};
      if (r.buyer_id === userId && ['pending', 'held_in_escrow', 'in_delivery'].includes(r.payment) && !r.cancelled_at) {
        const { data: code } = await db.rpc('my_receipt_code', { p_order: r.id });
        if (typeof code === 'string') out.receipt = code;
      }
      if (shopId && r.shop_id === shopId && (r.seller === 'preparing' || r.seller === 'ready')) {
        const { data: code } = await db.rpc('my_pickup_code', { p_order: r.id });
        if (typeof code === 'string') out.pickup = code;
      }
      return out;
    }),
  );

  const orders: Record<string, Order> = {};
  rows.forEach((r, i) => {
    orders[r.number] = toOrder(r, codes[i]);
  });
  const checkouts: Record<string, Checkout> = {};
  for (const ck of (ckData ?? []) as CheckoutRow[]) {
    checkouts[ck.id] = toCheckout(
      ck,
      rows.filter((r) => r.checkout_id === ck.id).map((r) => r.number),
    );
  }
  // A seller sees orders of checkouts it cannot read: a settled stand-in keeps them in "Commandes".
  for (const r of rows) {
    if (!checkouts[r.checkout_id])
      checkouts[r.checkout_id] = {
        id: r.checkout_id,
        orderIds: rows.filter((x) => x.checkout_id === r.checkout_id).map((x) => x.number),
        amount: r.total,
        method: r.method,
        status: r.payment === 'initiated' || r.payment === 'failed' ? 'failed' : 'succeeded',
        attempt: 1,
      };
  }
  return { orders, checkouts };
}

/* ---------- Vendeur (V5 à V7) et annulation (D18) ---------- */

export type OrderWrite = { ok: true } | OrdersFailure;

async function call(fn: string, args: Record<string, unknown>, c?: SupabaseClient | null): Promise<OrderWrite> {
  try {
    const { error } = await client(c).rpc(fn, args);
    return error ? rpcFailure(error) : { ok: true };
  } catch {
    return NETWORK;
  }
}

export const sellerStartPreparing = (orderUuid: string, c?: SupabaseClient | null) => call('seller_start_preparing', { p_order: orderUuid }, c);
export const sellerMarkReady = (orderUuid: string, c?: SupabaseClient | null) => call('seller_mark_ready', { p_order: orderUuid }, c);
export const buyerCancel = (orderUuid: string, reason: string, note: string | undefined, c?: SupabaseClient | null) =>
  call('buyer_cancel', { p_order: orderUuid, p_reason: reason, p_note: note ?? null }, c);
