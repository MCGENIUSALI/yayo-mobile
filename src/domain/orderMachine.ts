import { demoCourier } from './catalog';
import { pickupCodeFor } from './seller';
import type { CancelReason, Courier, DisputeReason, IncidentReason, Mission, Order, PaymentStatus } from './types';

/**
 * Authoritative order state machine (mock back-end).
 * UI components never set a status: they dispatch an event, and this module
 * decides whether the transition is allowed. Every rejected transition
 * returns a typed error instead of silently mutating the order.
 */

export type OrderEvent =
  | { type: 'seller.start_preparing' }
  /** The parcel is ready: the dispatcher's courier and mission come with it (defaults to the simulated fleet). */
  | { type: 'seller.mark_ready'; courier?: Courier; mission?: Mission }
  | { type: 'courier.accept' }
  /** L4 "Refuser": the mission goes to the next courier, never back to this one. */
  | { type: 'courier.decline'; by: string; next: Courier }
  /** The courier types the seller's pick-up code (V7) to confirm the collection. */
  | { type: 'courier.collect'; code: string }
  /** L6 "Je suis arrivé". */
  | { type: 'courier.arrive' }
  | { type: 'courier.confirm_delivery'; code: string; cashCollected?: boolean }
  /** L9 · Impossible de livrer. Funds stay with YA YO until it decides (new attempt, return or refund). */
  | { type: 'courier.report_incident'; reason: IncidentReason; photo: number | string }
  | { type: 'escrow.release' }
  /** D18 · The buyer cancels before the parcel is handed to the courier. */
  | { type: 'buyer.cancel'; reason: CancelReason; note?: string }
  /** D19 · The operator confirms the refund reached the buyer's account. */
  | { type: 'refund.received' }
  /** D4 · The buyer reports a problem with proof; funds stay blocked. */
  | { type: 'buyer.dispute'; id: string; reason: DisputeReason; description: string; photos: (number | string)[] }
  /** D5 · Ajouter une information. */
  | { type: 'buyer.dispute_note'; text: string }
  /** YA YO decides the dispute (back-office; simulated in the demo). */
  | { type: 'dispute.decide'; outcome: 'refund' | 'pay_seller' };

export type OrderEventType = OrderEvent['type'];

export type DomainErrorCode =
  | 'INVALID_TRANSITION'
  | 'PAYMENT_NOT_SECURED'
  | 'WRONG_RECEIPT_CODE'
  | 'WRONG_PICKUP_CODE'
  | 'CASH_NOT_COLLECTED'
  | 'PROOF_REQUIRED'
  | 'DISPUTED';

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

/**
 * D18 rule: the buyer may cancel a paid order (or a confirmed cash order) as long
 * as the seller has not handed the parcel to the courier. After that, only a
 * dispute (D4) is possible.
 */
export function canCancel(order: Order): boolean {
  if (order.cancellation || order.incident) return false;
  const paid = order.method === 'cash' ? order.payment === 'pending' : order.payment === 'held_in_escrow';
  // The courier may already be on the way to the shop (picking_up): the mission is withdrawn.
  return paid && order.seller !== 'handed_over' && ['unassigned', 'assigned', 'picking_up'].includes(order.delivery);
}

/**
 * D4 rule: a problem is reported before the receipt code is given (the code
 * releases the seller's payment), i.e. while the parcel is with the courier,
 * or after a failed delivery. Before the hand-over the buyer cancels instead (D18).
 */
export function canDispute(order: Order): boolean {
  if (order.cancellation || order.dispute) return false;
  return order.payment === 'in_delivery' || order.delivery === 'failed';
}

export const MAX_DISPUTE_PHOTOS = 4;

export function applyOrderEvent(order: Order, event: OrderEvent, at: string): Transition {
  // A cancelled order is frozen: only the refund confirmation still applies.
  if (order.cancellation && event.type !== 'refund.received') return fail('INVALID_TRANSITION', 'Cette commande a été annulée par l’acheteur.');
  switch (event.type) {
    case 'buyer.cancel': {
      if (!canCancel(order))
        return fail('INVALID_TRANSITION', 'Le colis est déjà parti chez le livreur : signale plutôt un problème à la réception.');
      const prepaid = order.method !== 'cash';
      return {
        ok: true,
        order: {
          ...order,
          payment: prepaid ? 'refunded' : 'failed',
          // The mission proposed to a courier is withdrawn.
          delivery: 'unassigned',
          courier: undefined,
          mission: undefined,
          cancellation: { reason: event.reason, note: event.note?.trim() || undefined, at, refund: prepaid ? 'sent' : 'none' },
          milestones: { ...order.milestones, cancelledAt: at },
        },
      };
    }
    case 'refund.received': {
      const c = order.cancellation;
      if (!c || c.refund !== 'sent') return fail('INVALID_TRANSITION', 'Aucun remboursement en cours.');
      return { ok: true, order: { ...order, cancellation: { ...c, refund: 'received', refundedAt: at } } };
    }
    case 'buyer.dispute': {
      if (!canDispute(order)) return fail('INVALID_TRANSITION', 'Un problème se signale pendant la livraison, avant de donner ton code de réception.');
      const description = event.description.trim();
      if (description.length < 10) return fail('PROOF_REQUIRED', 'Décris le problème en quelques mots (10 caractères au moins).');
      if (event.reason !== 'not_received' && event.photos.length === 0) return fail('PROOF_REQUIRED', 'Ajoute au moins une photo du produit reçu.');
      if (event.photos.length > MAX_DISPUTE_PHOTOS) return fail('PROOF_REQUIRED', `${MAX_DISPUTE_PHOTOS} photos au maximum.`);
      return {
        ok: true,
        order: {
          ...order,
          payment: 'disputed',
          dispute: { id: event.id, reason: event.reason, description, photos: event.photos, openedAt: at, notes: [] },
          milestones: { ...order.milestones, disputedAt: at },
        },
      };
    }
    case 'buyer.dispute_note': {
      if (!order.dispute || order.dispute.decision) return fail('INVALID_TRANSITION', 'Aucun litige en cours.');
      const text = event.text.trim();
      if (!text) return fail('PROOF_REQUIRED', 'Écris ton information.');
      return { ok: true, order: { ...order, dispute: { ...order.dispute, notes: [...order.dispute.notes, { text: text.slice(0, 500), at }] } } };
    }
    case 'dispute.decide': {
      if (!order.dispute || order.dispute.decision) return fail('INVALID_TRANSITION', 'Aucun litige en cours.');
      const dispute = { ...order.dispute, decision: { outcome: event.outcome, at } };
      if (event.outcome === 'refund') return { ok: true, order: { ...order, dispute, payment: 'refunded' } };
      return {
        ok: true,
        order: { ...order, dispute, payment: 'released', delivery: 'delivered', milestones: { ...order.milestones, deliveredAt: order.milestones.deliveredAt ?? at, releasedAt: at } },
      };
    }
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
          courier: event.courier ?? demoCourier,
          mission: event.mission,
          milestones: { ...order.milestones, preparedAt: at },
        },
      };
    }
    case 'courier.accept': {
      if (order.delivery !== 'assigned') return fail('INVALID_TRANSITION', 'Aucune mission assignée.');
      return { ok: true, order: { ...order, delivery: 'picking_up', milestones: { ...order.milestones, acceptedAt: at } } };
    }
    case 'courier.decline': {
      if (order.delivery !== 'assigned') return fail('INVALID_TRANSITION', 'Cette mission n’est plus proposée.');
      const mission = order.mission ? { ...order.mission, declinedBy: [...order.mission.declinedBy, event.by], proposedAt: at } : undefined;
      return { ok: true, order: { ...order, courier: event.next, mission } };
    }
    case 'courier.arrive': {
      if (order.delivery !== 'delivering') return fail('INVALID_TRANSITION', 'Le colis n’est pas en cours de livraison.');
      if (order.milestones.arrivedAt) return { ok: true, order };
      return { ok: true, order: { ...order, milestones: { ...order.milestones, arrivedAt: at } } };
    }
    case 'courier.report_incident': {
      if (order.delivery !== 'delivering') return fail('INVALID_TRANSITION', 'Un incident se déclare pendant la livraison.');
      if (!event.photo) return fail('PROOF_REQUIRED', 'Ajoute une photo du lieu comme preuve de passage.');
      return {
        ok: true,
        order: {
          ...order,
          delivery: 'failed',
          incident: { reason: event.reason, photo: event.photo, at },
        },
      };
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
      if (order.payment === 'disputed') return fail('DISPUTED', 'Le client a signalé un problème : garde le colis, YA YO te contacte pour la suite.');
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
