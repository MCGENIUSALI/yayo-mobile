import { demoCourier } from './catalog';
import { pickupCodeFor } from './seller';
import type { Order, PaymentStatus } from './types';

/**
 * Authoritative order state machine (mock back-end).
 * UI components never set a status: they dispatch an event, and this module
 * decides whether the transition is allowed. Every rejected transition
 * returns a typed error instead of silently mutating the order.
 */

export type OrderEvent =
  | { type: 'seller.start_preparing' }
  | { type: 'seller.mark_ready' }
  | { type: 'courier.accept' }
  /** The courier types the seller's pick-up code (V7) to confirm the collection. */
  | { type: 'courier.collect'; code: string }
  | { type: 'courier.confirm_delivery'; code: string; cashCollected?: boolean }
  | { type: 'escrow.release' };

export type OrderEventType = OrderEvent['type'];

export type DomainErrorCode =
  | 'INVALID_TRANSITION'
  | 'PAYMENT_NOT_SECURED'
  | 'WRONG_RECEIPT_CODE'
  | 'WRONG_PICKUP_CODE'
  | 'CASH_NOT_COLLECTED';

export class DomainError extends Error {
  constructor(
    public readonly code: DomainErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'DomainError';
  }
}

export type Transition = { ok: true; order: Order } | { ok: false; error: DomainError };

const fail = (code: DomainErrorCode, message: string): Transition => ({ ok: false, error: new DomainError(code, message) });

/** Payment statuses in which the seller may start working on the order. */
function paymentSecured(order: Order): boolean {
  if (order.method === 'cash') return order.payment === 'pending';
  return order.payment === 'held_in_escrow';
}

export function applyOrderEvent(order: Order, event: OrderEvent, at: string): Transition {
  switch (event.type) {
    case 'seller.start_preparing': {
      if (order.seller !== 'new') return fail('INVALID_TRANSITION', 'La commande est déjà en préparation.');
      if (!paymentSecured(order))
        return fail('PAYMENT_NOT_SECURED', 'Le vendeur ne prépare qu’une commande dont le paiement est sécurisé.');
      return { ok: true, order: { ...order, seller: 'preparing' } };
    }
    case 'seller.mark_ready': {
      if (order.seller !== 'preparing') return fail('INVALID_TRANSITION', 'La commande doit être en préparation.');
      return {
        ok: true,
        order: {
          ...order,
          seller: 'ready',
          delivery: 'assigned',
          courier: demoCourier,
          milestones: { ...order.milestones, preparedAt: at },
        },
      };
    }
    case 'courier.accept': {
      if (order.delivery !== 'assigned') return fail('INVALID_TRANSITION', 'Aucune mission assignée.');
      return { ok: true, order: { ...order, delivery: 'picking_up' } };
    }
    case 'courier.collect': {
      if (order.delivery !== 'picking_up' || order.seller !== 'ready')
        return fail('INVALID_TRANSITION', 'Le colis n’est pas prêt pour la collecte.');
      if (event.code.trim().toUpperCase() !== pickupCodeFor(order.id)) return fail('WRONG_PICKUP_CODE', 'Code de remise incorrect.');
      const payment: PaymentStatus = 'in_delivery';
      return {
        ok: true,
        order: {
          ...order,
          seller: 'handed_over',
          delivery: 'delivering',
          payment,
          milestones: { ...order.milestones, pickedUpAt: at },
        },
      };
    }
    case 'courier.confirm_delivery': {
      if (order.delivery !== 'delivering' || order.payment !== 'in_delivery')
        return fail('INVALID_TRANSITION', 'Le colis n’est pas en cours de livraison.');
      if (event.code !== order.receiptCode) return fail('WRONG_RECEIPT_CODE', 'Code de réception incorrect.');
      if (order.method === 'cash' && !event.cashCollected)
        return fail('CASH_NOT_COLLECTED', 'Le livreur doit encaisser le montant avant de confirmer.');
      return {
        ok: true,
        order: {
          ...order,
          delivery: 'delivered',
          payment: 'delivered',
          cashCollected: order.method === 'cash' ? true : undefined,
          milestones: { ...order.milestones, deliveredAt: at },
        },
      };
    }
    case 'escrow.release': {
      if (order.payment !== 'delivered') return fail('INVALID_TRANSITION', 'Les fonds ne sont libérés qu’après la livraison.');
      return { ok: true, order: { ...order, payment: 'released', milestones: { ...order.milestones, releasedAt: at } } };
    }
  }
}

/** Next role actions available in the demo console (seller / courier simulation). */
export function nextRoleEvents(order: Order): OrderEventType[] {
  const candidates: OrderEvent[] = [
    { type: 'seller.start_preparing' },
    { type: 'seller.mark_ready' },
    { type: 'courier.accept' },
    { type: 'courier.collect', code: pickupCodeFor(order.id) },
    { type: 'courier.confirm_delivery', code: order.receiptCode, cashCollected: true },
  ];
  return candidates.filter((e) => applyOrderEvent(order, e, '').ok).map((e) => e.type);
}

/** 4-digit receipt code, deterministic per order so demo scenarios are reproducible. */
export function receiptCodeFor(seq: number): string {
  return String((seq * 7919 + 4321) % 10000).padStart(4, '0');
}
