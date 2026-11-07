import { DEMO_COURIER_ID, DEMO_PHONE_COURIER } from './auth';
import { products } from './catalog';
import type { CourierSpace } from './courier';
import { receiptCodeFor } from './orderMachine';
import type { Checkout, Courier, Order, OrderLine } from './types';

/**
 * Demo data for the seeded courier (Patrick, Figma L4–L14). Missions are real
 * orders of the shared state: the proposed one is JBL Store Kin's parcel, so
 * Grâce's V7 shows the pick-up code that Patrick types on L5.
 */

export const COURIER_CASH_CHECKOUT_ID = 'CK-L';
export const COURIER_MOMO_CHECKOUT_ID = 'CK-L2';

export const PATRICK: Courier = { id: DEMO_COURIER_ID, name: 'Patrick K.', initials: 'PK', vehicle: 'Moto', rating: 4.9 };

const ago = (now: string, minutes: number) => new Date(new Date(now).getTime() - minutes * 60_000).toISOString();
/** `minutes` ago, squeezed into today when it is early morning (L4 "Gains du jour", L10 "avant ce soir"). Keeps the order of events. */
const today = (now: string, minutes: number) => {
  const t = new Date(now).getTime();
  const midnight = new Date(now);
  midnight.setHours(0, 0, 0, 0);
  const offset = Math.min(minutes * 60_000, ((t - midnight.getTime()) * minutes) / 300);
  return new Date(t - offset).toISOString();
};

export function seedCourierSpace(now: string): CourierSpace {
  return {
    accountId: DEMO_COURIER_ID,
    status: 'verified',
    profile: { transport: 'Moto', plate: 'KN 4521 BB', zones: ['Gombe', 'Kalamu', 'Lingwala'], payoutPhone: DEMO_PHONE_COURIER },
    docs: {
      idDoc: products['jbl-go-3']!.image,
      license: products['jbl-go-3']!.image,
      registration: products['jbl-charge-5']!.image,
      selfie: products['jbl-go-3']!.image,
    },
    submittedAt: '2026-10-20T09:00:00.000Z',
    verifiedAt: '2026-10-21T10:00:00.000Z',
    available: true,
    availableSince: ago(now, 120),
    remittances: [],
    rating: 4.9,
    ratingCount: 214,
  };
}

const line = (id: string, color: string, qty: number): OrderLine => {
  const p = products[id]!;
  return { productId: p.id, name: p.shortName, color, qty, unitPrice: p.price };
};

function order(o: {
  seq: number;
  shopId: string;
  lines: OrderLine[];
  method: 'cash' | 'mobile_money';
  buyer: { name: string; commune: string };
  dropoff: string;
  note?: string;
  status: Pick<Order, 'payment' | 'seller' | 'delivery'>;
  mission: { id: string; km: number; proposedAt: string };
  milestones: Order['milestones'];
  extra?: Partial<Order>;
}): Order {
  const itemsTotal = o.lines.reduce((t, l) => t + l.unitPrice * l.qty, 0);
  return {
    id: `YY-${o.seq}`,
    checkoutId: o.method === 'cash' ? COURIER_CASH_CHECKOUT_ID : COURIER_MOMO_CHECKOUT_ID,
    shopId: o.shopId,
    lines: o.lines,
    itemsTotal,
    deliveryFee: 5_000,
    discount: 0,
    total: itemsTotal + 5_000,
    method: o.method,
    ...o.status,
    receiptCode: receiptCodeFor(o.seq),
    addressId: 'home',
    slotId: 'asap',
    courierNote: o.note,
    buyerId: 'EXT',
    buyer: o.buyer,
    dropoff: o.dropoff,
    courier: PATRICK,
    mission: { id: o.mission.id, distanceKm: o.mission.km, proposedAt: o.mission.proposedAt, declinedBy: [] },
    milestones: o.milestones,
    ...o.extra,
  };
}

/** L4 proposed mission, L13 mission in progress, L10 cash to pay back, L11 history (one failure). */
export function seedCourierOrders(now: string): { orders: Record<string, Order>; checkouts: Checkout[] } {
  const list: Order[] = [
    // L4 · Nouvelle mission: JBL Store Kin → Kalamu, cash on delivery (Figma: 290 000 FC).
    order({
      seq: 24860,
      shopId: 'jbl-store-kin',
      lines: [line('jbl-go-3', 'Noir', 3)],
      method: 'cash',
      buyer: { name: 'Christelle B.', commune: 'Kalamu' },
      dropoff: '8, av. Lukandu, Q. Matonge, Kalamu',
      note: 'Portail bleu, face à la pharmacie',
      status: { payment: 'pending', seller: 'ready', delivery: 'assigned' },
      mission: { id: 'M-5521', km: 11, proposedAt: ago(now, 2) },
      milestones: { createdAt: ago(now, 95), preparedAt: ago(now, 3) },
    }),
    // L13 · En cours: accepted, on the way to Tech Lingwala.
    order({
      seq: 24862,
      shopId: 'tech-lingwala',
      lines: [line('earbuds-pro', 'Orange', 1), line('batterie-externe', 'Noir', 1)],
      method: 'mobile_money',
      buyer: { name: 'Junior K.', commune: 'Lemba' },
      dropoff: '23, av. Kikwit, Lemba',
      status: { payment: 'held_in_escrow', seller: 'ready', delivery: 'picking_up' },
      mission: { id: 'M-5530', km: 6, proposedAt: ago(now, 42) },
      milestones: { createdAt: ago(now, 130), paidAt: ago(now, 129), preparedAt: ago(now, 45), acceptedAt: ago(now, 40) },
    }),
    // L10 · Cash collected today, still to pay back.
    order({
      seq: 24857,
      shopId: 'bilokos2kin',
      lines: [line('jbl-pulse-5', 'Noir', 1)],
      method: 'cash',
      buyer: { name: 'Grâce M.', commune: 'Kalamu' },
      dropoff: '14, av. Victoire, Kalamu',
      status: { payment: 'released', seller: 'handed_over', delivery: 'delivered' },
      mission: { id: 'M-5512', km: 4.2, proposedAt: today(now, 230) },
      milestones: {
        createdAt: today(now, 300),
        preparedAt: today(now, 232),
        acceptedAt: today(now, 228),
        pickedUpAt: today(now, 200),
        arrivedAt: today(now, 172),
        deliveredAt: today(now, 170),
        releasedAt: today(now, 170),
      },
      extra: { cashCollected: true },
    }),
    order({
      seq: 24855,
      shopId: 'mama-luka-mode',
      lines: [line('veste-jean-brut', 'Bleu brut', 1), line('chaussures-sport', 'Blanc', 1)],
      method: 'cash',
      buyer: { name: 'Ruth N.', commune: 'Bandalungwa' },
      dropoff: '3, av. Kasa-Vubu, Bandalungwa',
      status: { payment: 'released', seller: 'handed_over', delivery: 'delivered' },
      mission: { id: 'M-5517', km: 8, proposedAt: today(now, 150) },
      milestones: {
        createdAt: today(now, 200),
        preparedAt: today(now, 152),
        acceptedAt: today(now, 148),
        pickedUpAt: today(now, 120),
        arrivedAt: today(now, 92),
        deliveredAt: today(now, 90),
        releasedAt: today(now, 90),
      },
      extra: { cashCollected: true },
    }),
    // L11 · Échec, client absent (yesterday): base pay only.
    order({
      seq: 24852,
      shopId: 'audio-plus-gombe',
      lines: [line('jbl-tune-510', 'Noir', 1)],
      method: 'mobile_money',
      buyer: { name: 'Aimé T.', commune: 'Lemba' },
      dropoff: '41, av. de l’Université, Lemba',
      status: { payment: 'in_delivery', seller: 'handed_over', delivery: 'failed' },
      mission: { id: 'M-5498', km: 7, proposedAt: ago(now, 26 * 60 + 90) },
      milestones: {
        createdAt: ago(now, 28 * 60),
        paidAt: ago(now, 28 * 60 - 1),
        preparedAt: ago(now, 26 * 60 + 92),
        acceptedAt: ago(now, 26 * 60 + 88),
        pickedUpAt: ago(now, 26 * 60 + 60),
        arrivedAt: ago(now, 26 * 60 + 5),
      },
      extra: { incident: { reason: 'absent', photo: products['jbl-tune-510']!.image!, at: ago(now, 26 * 60) } },
    }),
  ];
  const orders = Object.fromEntries(list.map((o) => [o.id, o]));
  const sum = (m: Order['method']) => list.filter((o) => o.method === m).reduce((t, o) => t + o.total, 0);
  const ids = (m: Order['method']) => list.filter((o) => o.method === m).map((o) => o.id);
  return {
    orders,
    checkouts: [
      { id: COURIER_CASH_CHECKOUT_ID, orderIds: ids('cash'), amount: sum('cash'), method: 'cash', status: 'succeeded', attempt: 1 },
      { id: COURIER_MOMO_CHECKOUT_ID, orderIds: ids('mobile_money'), amount: sum('mobile_money'), method: 'mobile_money', operator: 'M-Pesa', status: 'succeeded', attempt: 1 },
    ],
  };
}

/** Older deliveries of the demo (Jean's YY-24790, JBL Store Kin's paid orders) were Patrick's missions. */
const HISTORY: Record<string, { id: string; km: number }> = {
  'YY-24790': { id: 'M-5304', km: 6.4 },
  'YY-24812': { id: 'M-5388', km: 5.4 },
  'YY-24838': { id: 'M-5476', km: 9.8 },
};

export function withCourierHistory(orders: Record<string, Order>): Record<string, Order> {
  const next = { ...orders };
  for (const [orderId, m] of Object.entries(HISTORY)) {
    const o = next[orderId];
    if (!o || o.mission || o.delivery !== 'delivered') continue;
    const at = o.milestones.preparedAt ?? o.milestones.createdAt;
    next[orderId] = {
      ...o,
      courier: PATRICK,
      mission: { id: m.id, distanceKm: m.km, proposedAt: at, declinedBy: [] },
      milestones: { ...o.milestones, acceptedAt: o.milestones.acceptedAt ?? at },
    };
  }
  return next;
}
