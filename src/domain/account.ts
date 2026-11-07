/**
 * US-09 · Gérer mon compte : adresses (D13–D15), aide et support (D16–D17),
 * suppression du compte (D9–D12), annulation d'une commande (US-06, D18–D19).
 * Pure rules shared by the reducer and the screens.
 */
import { CITIES, formatPhone, normalizePhone } from './auth';
import type { Address, CancelReason } from './types';

/* ---------- Adresses (D13–D15) ---------- */

export interface AddressBook {
  items: Address[];
  /** Proposed first on C2 (D13 "Adresse par défaut"). */
  defaultId?: string;
}

export interface AddressInput {
  label: string;
  city: string;
  commune: string;
  street: string;
  landmark?: string;
  /** "81 234 5678" as typed. */
  phone: string;
}

export type AddressField = 'label' | 'city' | 'commune' | 'street' | 'phone';

export const MAX_ADDRESSES = 10;

export function addressError(a: AddressInput): { field: AddressField; message: string } | null {
  if (a.label.trim().length < 2) return { field: 'label', message: 'Donne un nom à cette adresse (Maison, Bureau…).' };
  if (!CITIES[a.city]) return { field: 'city', message: 'Choisis la ville.' };
  if (!CITIES[a.city]!.includes(a.commune)) return { field: 'commune', message: 'Choisis la commune.' };
  if (a.street.trim().length < 5) return { field: 'street', message: 'Indique le quartier, l’avenue et le numéro.' };
  if (!normalizePhone(a.phone)) return { field: 'phone', message: 'Saisis un numéro mobile congolais à 9 chiffres.' };
  return null;
}

/** "12, av. Kasa-Vubu, Q. Matonge, Kalamu" (+ the city outside Kinshasa). */
export function addressLine(a: Pick<AddressInput, 'street' | 'commune' | 'city'>): string {
  const parts = [a.street.trim().replace(/\s+/g, ' '), a.commune];
  if (a.city !== 'Kinshasa') parts.push(a.city);
  return parts.join(', ');
}

export function toAddress(id: string, a: AddressInput): Address {
  return {
    id,
    label: a.label.trim().replace(/\s+/g, ' '),
    line: addressLine(a),
    phone: formatPhone(normalizePhone(a.phone)!),
    city: a.city,
    commune: a.commune,
    street: a.street.trim().replace(/\s+/g, ' '),
    landmark: a.landmark?.trim() || undefined,
  };
}

/* ---------- Annulation (D18) ---------- */

export const CANCEL_REASONS: { id: CancelReason; label: string }[] = [
  { id: 'wrong_item', label: 'Je me suis trompé d’article' },
  { id: 'too_slow', label: 'Le délai est trop long' },
  { id: 'cheaper', label: 'J’ai trouvé moins cher ailleurs' },
  { id: 'other', label: 'Autre raison' },
];

export const cancelReasonLabel = (r: CancelReason) => CANCEL_REASONS.find((x) => x.id === r)?.label ?? 'Autre raison';

/* ---------- Support (D16–D17) ---------- */

export interface SupportMessage {
  id: string;
  from: 'me' | 'agent';
  text: string;
  at: string;
  /** "À propos de la commande #YY-24868". */
  orderId?: string;
}

export const SUPPORT_AGENT = 'Aline';
export const MAX_SUPPORT_MESSAGE = 1000;

export function supportGreeting(firstName: string): string {
  return `Bonjour ${firstName}, je suis ${SUPPORT_AGENT} du support YA YO. Comment puis-je t’aider ?`;
}

/** D16 · Questions fréquentes: answers follow the app's own rules. */
export const FAQ: { id: string; question: string; answer: string }[] = [
  {
    id: 'seller-paid',
    question: 'Quand le vendeur est-il payé ?',
    answer:
      'Ton argent est bloqué par YA YO, pas par le vendeur. Il est payé seulement quand tu donnes ton code de réception au livreur. Si le colis n’arrive pas ou n’est pas conforme, tu es remboursé.',
  },
  {
    id: 'receipt-code',
    question: 'Comment marche le code de réception ?',
    answer:
      'Chaque colis a un code à 4 chiffres, visible dans le suivi de ta commande. Donne-le au livreur seulement quand tu as vérifié le colis : c’est lui qui déclenche le paiement du vendeur.',
  },
  {
    id: 'momo-failed',
    question: 'Mon paiement Mobile Money a échoué',
    answer:
      'Aucun montant n’est débité quand le paiement échoue. Ta commande est gardée 30 minutes : tu peux réessayer, changer de numéro ou payer autrement.',
  },
  {
    id: 'cancel',
    question: 'Annuler une commande',
    answer:
      'Tu peux annuler depuis le suivi tant que le vendeur n’a pas remis le colis au livreur. Le montant payé revient en entier sur ton moyen de paiement. Après la remise, signale plutôt un problème.',
  },
];

/* ---------- Suppression du compte (D9) ---------- */

export const DELETE_REASONS = ['Je n’utilise plus YA YO', 'J’ai un autre compte', 'Une mauvaise expérience', 'Autre raison'] as const;

/** D10: why the account cannot be deleted yet. */
export type DeletionBlocker =
  | { kind: 'order'; orderId: string }
  | { kind: 'dispute'; orderId: string }
  | { kind: 'refund'; orderId: string }
  | { kind: 'shop' }
  | { kind: 'courier' };

export function blockerText(b: DeletionBlocker): { title: string; body: string; action: string } {
  switch (b.kind) {
    case 'order':
      return {
        title: 'Une commande est encore en cours',
        body: `Tu pourras supprimer ton compte quand la commande #${b.orderId} sera livrée ou annulée. D’ici là, ton argent reste protégé par YA YO.`,
        action: 'Voir mes commandes',
      };
    case 'dispute':
      return {
        title: 'Un litige est en cours',
        body: `Attends la décision de YA YO sur la commande #${b.orderId} : elle peut te rembourser. Tu pourras ensuite supprimer ton compte.`,
        action: 'Voir mes commandes',
      };
    case 'refund':
      return {
        title: 'Un remboursement est en cours',
        body: `Attends que le remboursement de la commande #${b.orderId} arrive sur ton compte. Tu pourras ensuite supprimer ton compte.`,
        action: 'Voir mes commandes',
      };
    case 'shop':
      return {
        title: 'Ta boutique a des commandes en cours',
        body: 'Termine les commandes de ta boutique et attends le versement de tes revenus avant de supprimer ton compte.',
        action: 'Contacter le support',
      };
    case 'courier':
      return {
        title: 'Tu as des missions ou du cash à reverser',
        body: 'Termine tes missions en cours et reverse le cash encaissé avant de supprimer ton compte.',
        action: 'Contacter le support',
      };
  }
}
