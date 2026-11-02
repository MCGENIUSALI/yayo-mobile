/**
 * Shared domain contracts for Buyer, Seller and Courier.
 * Status names follow the cahier des charges (§7.5.4 escrow, §7.6 logistics)
 * and the Figma components "Payment Status" / "Delivery Status".
 */

export type FC = number; // Congolese francs, always integers.

export type PaymentMethod = 'mobile_money' | 'cash' | 'card';
export type MobileMoneyOperator = 'M-Pesa' | 'Orange Money' | 'Airtel Money';

/** Escrow payment lifecycle (§7.5.4) + dispute (§7.5.6). */
export type PaymentStatus =
  | 'initiated'
  | 'pending'
  | 'held_in_escrow'
  | 'in_delivery'
  | 'delivered'
  | 'released'
  | 'failed'
  | 'refunded'
  | 'disputed';

/** Seller preparation (§7.6). */
export type SellerStatus = 'new' | 'preparing' | 'ready' | 'handed_over';

/** Courier mission (§7.6): Assignée, En collecte, En livraison, Livrée, Échec. */
export type DeliveryStatus = 'unassigned' | 'assigned' | 'picking_up' | 'delivering' | 'delivered' | 'failed';

export interface Shop {
  id: string;
  name: string;
  initials: string;
  area: string;
  verified: boolean;
  deliveryLead: string;
}

export interface ColorOption {
  name: string;
  hex: string;
}

export interface Product {
  id: string;
  shopId: string;
  name: string;
  shortName: string;
  price: FC;
  compareAt?: FC;
  stock: number;
  rating: number;
  reviews: number;
  colors: ColorOption[];
  /** Background tint of the product photo, shown while the photo loads or if none is available. */
  tint: string;
  /** Local require() or remote URI. Optional until real catalogue photos are provided. */
  image?: number | string;
  description: string;
}

export interface CartLine {
  productId: string;
  color: string;
  qty: number;
}

export interface Address {
  id: string;
  label: string;
  line: string;
  phone: string;
}

export interface DeliverySlot {
  id: string;
  label: string;
}

export interface OrderLine {
  productId: string;
  name: string;
  color: string;
  qty: number;
  unitPrice: FC;
}

export interface Courier {
  name: string;
  initials: string;
  vehicle: string;
  rating: number;
}

/** Timestamps of the milestones shown in the buyer timeline (D2). */
export interface OrderMilestones {
  createdAt: string;
  paidAt?: string;
  preparedAt?: string;
  pickedUpAt?: string;
  deliveredAt?: string;
  releasedAt?: string;
  failedAt?: string;
  disputedAt?: string;
}

/**
 * One order per seller (multi-vendor cart → one parcel per seller,
 * hypothesis H-01). Orders from the same checkout share `checkoutId`.
 */
export interface Order {
  id: string;
  checkoutId: string;
  shopId: string;
  lines: OrderLine[];
  itemsTotal: FC;
  deliveryFee: FC;
  discount: FC;
  total: FC;
  method: PaymentMethod;
  payment: PaymentStatus;
  seller: SellerStatus;
  delivery: DeliveryStatus;
  receiptCode: string;
  addressId: string;
  slotId: string;
  courierNote?: string;
  courier?: Courier;
  cashCollected?: boolean;
  milestones: OrderMilestones;
}

export type CheckoutStatus = 'awaiting_confirmation' | 'pending' | 'succeeded' | 'failed' | 'expired';

export type PaymentFailureReason = 'insufficient_funds' | 'expired' | 'declined';

/** One payment for the whole checkout (all sub-orders are paid at once). */
export interface Checkout {
  id: string;
  orderIds: string[];
  amount: FC;
  method: PaymentMethod;
  operator?: MobileMoneyOperator;
  msisdn?: string;
  status: CheckoutStatus;
  attempt: number;
  requestedAt?: string;
  expiresAt?: string;
  /** Unpaid orders are kept 30 min after a failure (C6). */
  holdUntil?: string;
  failureReason?: PaymentFailureReason;
  /** Cart snapshot key: a retry is only allowed on an unchanged cart. */
  cartKey?: string;
}

/** Append-only event log: what happened, who did it, when. */
export interface DomainEvent {
  id: string;
  at: string;
  actor: 'buyer' | 'seller' | 'courier' | 'system' | 'payment_provider';
  type: string;
  orderId?: string;
  checkoutId?: string;
  detail?: string;
}
