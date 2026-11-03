import { DEMO_SELLER_ID } from './auth';
import { products } from './catalog';
import { receiptCodeFor } from './orderMachine';
import type { SellerProduct, SellerSpace } from './seller';
import type { Checkout, Order, OrderLine } from './types';

/**
 * Demo data for the seeded seller (Grâce, JBL Store Kin), shaped after the
 * Figma screens V4–V13. Orders are real orders of the shared state, so a
 * purchase made by a buyer in the app also reaches this seller.
 */

export const SELLER_SHOP_ID = 'jbl-store-kin';
export const SELLER_CHECKOUT_ID = 'CK-S';

const ago = (now: string, minutes: number) => new Date(new Date(now).getTime() - minutes * 60_000).toISOString();

const go3 = products['jbl-go-3']!;
const charge5 = products['jbl-charge-5']!;
const tune = products['jbl-tune-510']!;
const earbuds = products['earbuds-pro']!;
const batterie = products['batterie-externe']!;

export function seedSellerSpace(now: string): SellerSpace {
  const fromCatalog = (id: 'jbl-go-3' | 'jbl-charge-5'): SellerProduct => {
    const p = products[id]!;
    return {
      id: p.id,
      name: p.shortName,
      category: 'Électronique › Enceintes',
      description: p.description,
      photos: p.image ? [p.image] : [],
      price: p.price,
      compareAt: p.compareAt,
      stock: p.stock,
      colors: p.colors.map((c) => c.name),
      status: 'online',
      rating: p.rating,
      reviews: p.reviews,
      updatedAt: '2026-10-20T09:00:00.000Z',
    };
  };
  return {
    accountId: DEMO_SELLER_ID,
    shopId: SELLER_SHOP_ID,
    status: 'verified',
    profile: {
      name: 'JBL Store Kin',
      category: 'Électronique et audio',
      commune: 'Gombe',
      pickupAddress: 'Av. du Commerce n°18, Gombe',
      hours: 'Lun–Sam, 8h–18h',
    },
    kyc: { idDoc: go3.image, selfie: go3.image, rccm: 'CD/KIN/RCCM/24-A-01234', payoutPhone: '+243812345678' },
    submittedAt: '2026-10-12T10:00:00.000Z',
    verifiedAt: '2026-10-14T09:30:00.000Z',
    products: [
      fromCatalog('jbl-go-3'),
      fromCatalog('jbl-charge-5'),
      {
        id: 'P-3',
        name: 'JBL Tune 520BT – Casque sans fil',
        category: 'Électronique › Audio',
        description: 'Casque Bluetooth pliable, 57 h d’autonomie, son JBL Pure Bass.',
        photos: tune.image ? [tune.image] : [],
        price: 125_000,
        stock: 3,
        colors: ['Noir', 'Bleu'],
        status: 'online',
        rating: 4.5,
        reviews: 41,
        updatedAt: ago(now, 60),
      },
      {
        id: 'P-4',
        name: 'JBL Wave Buds – Écouteurs',
        category: 'Électronique › Audio',
        description: 'Écouteurs sans fil, boîtier de charge, 32 h d’autonomie.',
        photos: earbuds.image ? [earbuds.image] : [],
        price: 82_000,
        stock: 0,
        colors: ['Noir', 'Blanc'],
        status: 'online',
        rating: 4.3,
        reviews: 18,
        updatedAt: '2026-10-28T16:00:00.000Z',
      },
      {
        id: 'P-5',
        name: 'Batterie externe 20 000 mAh',
        category: 'Électronique › Accessoires',
        description: '',
        photos: batterie.image ? [batterie.image] : [],
        price: 45_000,
        stock: 10,
        colors: ['Noir'],
        status: 'draft',
        updatedAt: '2026-11-01T18:00:00.000Z',
      },
    ],
    withdrawals: [],
    // History already seen by the seller; today's orders and stock alerts stay unread (V13).
    readNotifications: ['order-YY-24812', 'payout-YY-24812', 'order-YY-24838', 'payout-YY-24838', 'stock-P-4-0'],
    productSeq: 5,
  };
}

const line = (p: typeof go3, color: string, qty: number): OrderLine => ({ productId: p.id, name: p.shortName, color, qty, unitPrice: p.price });

function order(
  seq: number,
  lines: OrderLine[],
  buyer: { name: string; commune: string },
  status: Pick<Order, 'payment' | 'seller' | 'delivery'>,
  milestones: Order['milestones'],
  buyerId = 'EXT',
): Order {
  const itemsTotal = lines.reduce((t, l) => t + l.unitPrice * l.qty, 0);
  return {
    id: `YY-${seq}`,
    checkoutId: SELLER_CHECKOUT_ID,
    shopId: SELLER_SHOP_ID,
    lines,
    itemsTotal,
    deliveryFee: 5_000,
    discount: 0,
    total: itemsTotal + 5_000,
    method: 'mobile_money',
    ...status,
    receiptCode: receiptCodeFor(seq),
    addressId: 'home',
    slotId: 'asap',
    buyer,
    buyerId,
    milestones,
  };
}

/** V5 "Nouvelles (2)", one parcel waiting for the courier, and paid history for V11. */
export function seedSellerOrders(now: string): { orders: Record<string, Order>; checkout: Checkout } {
  const list: Order[] = [
    order(
      24871,
      [line(charge5, 'Bleu', 1), line(go3, 'Noir', 1)],
      { name: 'Grâce M.', commune: 'Kalamu' },
      { payment: 'held_in_escrow', seller: 'new', delivery: 'unassigned' },
      { createdAt: ago(now, 34), paidAt: ago(now, 33) },
    ),
    order(
      24875,
      [line(go3, 'Jaune', 2)],
      { name: 'Junior K.', commune: 'Lemba' },
      { payment: 'held_in_escrow', seller: 'new', delivery: 'unassigned' },
      { createdAt: ago(now, 3), paidAt: ago(now, 2) },
    ),
    order(
      24866,
      [line(go3, 'Bleu', 1)],
      { name: 'Patricia N.', commune: 'Ngaliema' },
      { payment: 'held_in_escrow', seller: 'preparing', delivery: 'unassigned' },
      { createdAt: ago(now, 26 * 60), paidAt: ago(now, 26 * 60 - 1) },
    ),
    order(
      24812,
      [line(charge5, 'Noir', 1)],
      { name: 'Didier T.', commune: 'Bandalungwa' },
      { payment: 'released', seller: 'handed_over', delivery: 'delivered' },
      {
        createdAt: '2026-10-21T09:10:00.000Z',
        paidAt: '2026-10-21T09:11:00.000Z',
        preparedAt: '2026-10-21T11:00:00.000Z',
        pickedUpAt: '2026-10-21T12:30:00.000Z',
        deliveredAt: '2026-10-21T14:05:00.000Z',
        releasedAt: '2026-10-21T14:05:00.000Z',
      },
    ),
    order(
      24838,
      [line(go3, 'Jaune', 3), line(charge5, 'Bleu', 1)],
      { name: 'Merveille L.', commune: 'Limete' },
      { payment: 'released', seller: 'handed_over', delivery: 'delivered' },
      {
        createdAt: '2026-11-01T10:00:00.000Z',
        paidAt: '2026-11-01T10:01:00.000Z',
        preparedAt: '2026-11-01T12:00:00.000Z',
        pickedUpAt: '2026-11-01T13:10:00.000Z',
        deliveredAt: '2026-11-01T15:20:00.000Z',
        releasedAt: '2026-11-01T15:20:00.000Z',
      },
    ),
  ];
  return {
    orders: Object.fromEntries(list.map((o) => [o.id, o])),
    checkout: {
      id: SELLER_CHECKOUT_ID,
      orderIds: list.map((o) => o.id),
      amount: list.reduce((t, o) => t + o.total, 0),
      method: 'mobile_money',
      operator: 'M-Pesa',
      status: 'succeeded',
      attempt: 1,
    },
  };
}
