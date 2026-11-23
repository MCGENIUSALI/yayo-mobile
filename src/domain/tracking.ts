import { deliverySlots, getShop } from './catalog';
import { formatDayTime, formatTime } from './format';
import type { Order } from './types';

export type StepState = 'done' | 'current' | 'upcoming';
export type StepKey = 'paid' | 'prepared' | 'collected' | 'delivering' | 'delivered';

export interface TimelineStepModel {
  key: StepKey;
  title: string;
  description: string;
  state: StepState;
}

/**
 * Buyer timeline (D2), derived only from the authoritative order state, so
 * the buyer, seller and courier views can never disagree.
 */
export function buildTimeline(order: Order, now = new Date()): TimelineStepModel[] {
  const shop = getShop(order.shopId);
  const m = order.milestones;
  const cash = order.method === 'cash';
  const paidDone = cash || ['held_in_escrow', 'in_delivery', 'delivered', 'released'].includes(order.payment);
  const preparedDone = order.seller === 'ready' || order.seller === 'handed_over';
  const collectedDone = !!m.pickedUpAt;
  const deliveredDone = order.delivery === 'delivered';

  const raw: { key: StepKey; title: string; done: boolean; doneText: string; pendingText: string }[] = [
    {
      key: 'paid',
      title: cash ? 'Commande confirmée' : 'Paiement sécurisé',
      done: paidDone,
      doneText: cash
        ? `${formatDayTime(m.createdAt, now)} · paiement à la livraison`
        : `${formatDayTime(m.paidAt ?? m.createdAt, now)} · fonds bloqués par YA YO`,
      pendingText: 'En attente de la validation du paiement',
    },
    {
      key: 'prepared',
      title: 'Commande préparée',
      done: preparedDone,
      doneText: `${shop.name} · ${m.preparedAt ? formatTime(m.preparedAt) : ''}`,
      pendingText: order.seller === 'preparing' ? `${shop.name} prépare ton colis` : `${shop.name} va préparer ton colis`,
    },
    {
      key: 'collected',
      title: 'Colis collecté',
      done: collectedDone,
      doneText: `${order.courier?.name ?? 'Livreur'} · ${m.pickedUpAt ? formatTime(m.pickedUpAt) : ''}`,
      pendingText: order.courier ? `${order.courier.name} se rend chez le vendeur` : 'Un livreur sera assigné',
    },
    {
      key: 'delivering',
      title: 'En livraison',
      done: deliveredDone,
      doneText: m.deliveredAt ? `Arrivé à ${formatTime(m.deliveredAt)}` : '',
      pendingText:
        order.delivery === 'failed'
          ? 'Livraison interrompue : YA YO te contacte'
          : order.milestones.arrivedAt
            ? `${order.courier?.name ?? 'Ton livreur'} est arrivé`
            : eta(order)
              ? `Arrivée vers ${eta(order)!.from}`
              : 'Le livreur part après la collecte',
    },
    {
      key: 'delivered',
      title: 'Livrée',
      done: deliveredDone,
      doneText: m.releasedAt ? `${formatTime(m.deliveredAt ?? m.releasedAt)} · vendeur payé par YA YO` : 'Colis remis',
      pendingText: 'Le livreur saisit ton code de réception',
    },
  ];

  const firstOpen = raw.findIndex((s) => !s.done);
  return raw.map((s, i) => ({
    key: s.key,
    title: s.title,
    description: s.done ? s.doneText : s.pendingText,
    state: s.done ? 'done' : i === firstOpen ? 'current' : 'upcoming',
  }));
}

/** Estimated arrival window, once the parcel is collected (pickup + 35–55 min in Kinshasa traffic). */
export function eta(order: Order): { from: string; to: string } | null {
  if (!order.milestones.pickedUpAt || order.delivery === 'delivered' || order.delivery === 'failed') return null;
  const t = new Date(order.milestones.pickedUpAt).getTime();
  return { from: formatTime(new Date(t + 35 * 60_000).toISOString()), to: formatTime(new Date(t + 55 * 60_000).toISOString()) };
}

export function etaLabel(order: Order): { caption: string; value: string } {
  if (order.delivery === 'delivered')
    return { caption: 'Livrée', value: order.milestones.deliveredAt ? formatDayTime(order.milestones.deliveredAt) : '—' };
  const e = eta(order);
  if (e) return { caption: 'Arrivée estimée', value: `${e.from} – ${e.to}` };
  return { caption: 'Créneau choisi', value: deliverySlots.find((s) => s.id === order.slotId)?.label ?? '—' };
}

/** The receipt code is shown only while it can still be used. */
export function showReceiptCode(order: Order): boolean {
  if (order.delivery === 'delivered' || order.delivery === 'failed' || order.payment === 'disputed' || order.payment === 'refunded') return false;
  return order.method === 'cash' ? order.payment === 'pending' || order.payment === 'in_delivery' : ['held_in_escrow', 'in_delivery'].includes(order.payment);
}
