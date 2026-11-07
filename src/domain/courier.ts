import { addresses, getShop } from './catalog';
import { normalizePhone } from './auth';
import { detectOperator } from './paymentProvider';
import type { Photo } from './seller';
import type { Courier, FC, IncidentReason, Order } from './types';

/**
 * Courier app (Figma US-15 à US-19, écrans L1–L14), mock back-end rules.
 *
 * - Pay per mission: the "Rémunération livreur par course" set by the YA YO
 *   admin (dashboard AD5): 3 000 FC + 500 FC per km. A failed mission (L9)
 *   pays the base only (Figma L11: "#M-5498 · Échec, client absent · 3 000 FC").
 * - Cash on delivery: the courier collects the exact total (L7) and pays it
 *   back to YA YO the same day, before 20h (L10).
 * - The role is never granted by the app: L2 files the request, the YA YO
 *   team validates (simulated by a demo button on L3).
 */

export const COURIER_BASE_PAY: FC = 3_000;
export const COURIER_PAY_PER_KM: FC = 500;
/** L10: "à reverser avant ce soir 20h". */
export const CASH_REMIT_HOUR = 20;
/** L10 · Point de dépôt YA YO. */
export const DEPOSIT_POINT = { name: 'Point de dépôt YA YO', address: 'Gombe, av. des Aviateurs', hours: '8h–20h' };

export const TRANSPORTS = ['Moto', 'Voiture', 'Vélo', 'À pied'] as const;
export type Transport = (typeof TRANSPORTS)[number];

/** Motorised vehicles need a plate, a driving licence and the registration card (L1, L2). */
export const isMotorised = (t: Transport) => t === 'Moto' || t === 'Voiture';

export type CourierStatus = 'draft' | 'submitted' | 'verified';

export interface CourierProfile {
  transport: Transport;
  /** "KN 4521 BB"; empty for bike and on foot. */
  plate: string;
  /** Where the courier works (v7), see src/domain/geo. Older profiles are in Kinshasa. */
  country?: string;
  province?: string;
  city?: string;
  /** Communes where the courier takes missions (L1 "Zone de travail"); the whole city where it has no commune list. */
  zones: string[];
  /** E.164 Mobile Money number for the weekly payout. */
  payoutPhone: string;
}

export interface CourierDocs {
  idDoc?: Photo;
  license?: Photo;
  registration?: Photo;
  selfie?: Photo;
}

export type DocKey = keyof CourierDocs;

export type RemitChannel = 'mobile_money' | 'deposit_point';

export interface Remittance {
  id: string;
  amount: FC;
  orderIds: string[];
  channel: RemitChannel;
  at: string;
}

export interface CourierSpace {
  accountId: string;
  status: CourierStatus;
  profile: CourierProfile;
  docs: CourierDocs;
  submittedAt?: string;
  verifiedAt?: string;
  /** L4 / L12: missions are proposed only while available. */
  available: boolean;
  availableSince?: string;
  remittances: Remittance[];
  rating?: number;
  ratingCount?: number;
}

/* ---------- L1 · Profil et véhicule ---------- */

export function normalizePlate(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
}

export function profileError(p: CourierProfile): string | null {
  if (!TRANSPORTS.includes(p.transport)) return 'Choisis ton moyen de transport.';
  if (isMotorised(p.transport) && !/^[A-Z0-9]{2,4}( ?[A-Z0-9]{1,4}){1,3}$/.test(normalizePlate(p.plate)))
    return 'Indique la plaque d’immatriculation de ton véhicule.';
  if (p.zones.length === 0) return 'Choisis au moins une commune où tu livres.';
  const phone = normalizePhone(p.payoutPhone);
  if (!phone) return 'Saisis un numéro Mobile Money congolais à 9 chiffres.';
  if (!detectOperator(phone.slice(4))) return 'Ce numéro n’est ni M-Pesa, ni Orange Money, ni Airtel Money.';
  return null;
}

/* ---------- L2 · Documents ---------- */

export interface DocSpec {
  key: DocKey;
  title: string;
  hint: string;
}

export function requiredDocs(transport: Transport): DocSpec[] {
  return [
    { key: 'idDoc', title: 'Pièce d’identité', hint: 'Carte d’électeur ou passeport' },
    ...(isMotorised(transport)
      ? ([
          { key: 'license', title: 'Permis de conduire', hint: 'Recto et verso' },
          { key: 'registration', title: 'Carte grise du véhicule', hint: `Au nom du propriétaire de la ${transport.toLowerCase()}` },
        ] as DocSpec[])
      : []),
    { key: 'selfie', title: 'Selfie avec la pièce', hint: 'Ton visage et ta pièce bien lisibles' },
  ];
}

export function docsError(transport: Transport, docs: CourierDocs): string | null {
  const missing = requiredDocs(transport).find((d) => !docs[d.key]);
  return missing ? `Ajoute : ${missing.title.toLowerCase()}.` : null;
}

/* ---------- Missions ---------- */

const seqOf = (orderId: string) => Number(orderId.replace(/\D/g, '')) || 0;

/** "YY-24860" → "M-5521"-style number, stable for an order. */
export function missionIdFor(orderId: string): string {
  return `M-${5000 + ((seqOf(orderId) * 37) % 1000)}`;
}

/** Simulated route length until the maps SDK computes it (2,5 to 12 km). */
export function distanceKmFor(orderId: string): number {
  return (25 + ((seqOf(orderId) * 53) % 96)) / 10;
}

/** Minutes for the whole mission in Kinshasa traffic. */
export function etaMinutes(km: number): number {
  return Math.round(km * 3 + 5);
}

export function missionPay(o: Pick<Order, 'mission' | 'delivery'>): FC {
  if (!o.mission) return 0;
  if (o.delivery === 'failed') return COURIER_BASE_PAY;
  return COURIER_BASE_PAY + Math.round((o.mission.distanceKm * COURIER_PAY_PER_KM) / 100) * 100;
}

export const parcelCount = (o: Pick<Order, 'lines'>) => o.lines.reduce((n, l) => n + l.qty, 0);

/** Exact amount the courier collects at the door (cash on delivery). */
export const cashToCollect = (o: Pick<Order, 'method' | 'total'>): FC => (o.method === 'cash' ? o.total : 0);

export type MissionStage = 'proposed' | 'pickup' | 'delivery' | 'handover' | 'delivered' | 'failed';

export function missionStage(o: Order): MissionStage {
  switch (o.delivery) {
    case 'assigned':
    case 'unassigned':
      return 'proposed';
    case 'picking_up':
      return 'pickup';
    case 'delivering':
      return o.milestones.arrivedAt ? 'handover' : 'delivery';
    case 'delivered':
      return 'delivered';
    case 'failed':
      return 'failed';
  }
}

export type MissionTab = 'active' | 'proposed' | 'done';

export function missionTab(o: Order): MissionTab {
  const s = missionStage(o);
  if (s === 'proposed') return 'proposed';
  if (s === 'delivered' || s === 'failed') return 'done';
  return 'active';
}

export const finishedAt = (o: Order): string | undefined => o.milestones.deliveredAt ?? o.incident?.at;

/** Missions of one courier: in progress (oldest accepted first), proposed (newest first), done (newest first). */
export function sortMissions(list: Order[]): Order[] {
  const rank: Record<MissionTab, number> = { active: 0, proposed: 1, done: 2 };
  const key = (o: Order) => {
    const tab = missionTab(o);
    if (tab === 'active') return o.milestones.acceptedAt ?? '';
    if (tab === 'proposed') return o.mission?.proposedAt ?? '';
    return finishedAt(o) ?? '';
  };
  return [...list].sort((a, b) => {
    const ta = missionTab(a);
    const tb = missionTab(b);
    if (ta !== tb) return rank[ta] - rank[tb];
    return ta === 'active' ? (key(a) < key(b) ? -1 : 1) : key(a) < key(b) ? 1 : -1;
  });
}

/** Pick-up addresses of the catalogue shops (the seller app overrides them with V1's address). */
const SHOP_PICKUP: Record<string, string> = {
  'jbl-store-kin': 'Av. du Commerce n°18, Gombe',
  'audio-plus-gombe': 'Bd du 30 Juin n°112, Gombe',
  'tech-lingwala': 'Av. Kabinda n°40, Lingwala',
  bilokos2kin: 'Av. de la Justice n°7, Gombe',
  'mama-luka-mode': 'Marché de la Liberté, stand 14, Masina',
  'karite-ngaliema': 'Av. Kalembelembe n°3, Ngaliema',
  'deco-limete': '7e rue n°21, Limete',
};

export function pickupLine(o: Pick<Order, 'shopId'>, sellerAddress?: string): string {
  if (sellerAddress) return sellerAddress;
  return SHOP_PICKUP[o.shopId] ?? getShop(o.shopId).area;
}

export function dropoffLine(o: Pick<Order, 'dropoff' | 'addressId' | 'buyer'>): string {
  return o.dropoff ?? addresses.find((a) => a.id === o.addressId)?.line ?? o.buyer?.commune ?? 'Kinshasa';
}

/** "Gombe → Kalamu" (L11 history): commune of the pick-up address, then the buyer's. */
export function routeLabel(o: Pick<Order, 'shopId' | 'buyer'>): string {
  const from = pickupLine(o).split(',').at(-1)!.trim();
  return `${from} → ${o.buyer?.commune ?? 'Kinshasa'}`;
}

export const INCIDENT_REASONS: { value: IncidentReason; label: string; short: string }[] = [
  { value: 'absent', label: 'Client absent ou injoignable', short: 'client absent' },
  { value: 'refused', label: 'Le client refuse le colis', short: 'colis refusé' },
  { value: 'address', label: 'Adresse erronée ou introuvable', short: 'adresse introuvable' },
  { value: 'damaged', label: 'Colis endommagé', short: 'colis endommagé' },
];

export const incidentLabel = (r: IncidentReason) => INCIDENT_REASONS.find((x) => x.value === r)!;

/* ---------- L10 · Cash à reverser ---------- */

export interface CashDue {
  amount: FC;
  orders: Order[];
}

export function cashDue(missions: Order[], remittances: Remittance[]): CashDue {
  const remitted = new Set(remittances.flatMap((r) => r.orderIds));
  const orders = missions
    .filter((o) => o.method === 'cash' && o.delivery === 'delivered' && o.cashCollected && !remitted.has(o.id))
    .sort((a, b) => ((a.milestones.deliveredAt ?? '') < (b.milestones.deliveredAt ?? '') ? -1 : 1));
  return { amount: orders.reduce((t, o) => t + o.total, 0), orders };
}

/** Today at 20:00, local time. */
export function remitDeadline(now: string): string {
  const d = new Date(now);
  d.setHours(CASH_REMIT_HOUR, 0, 0, 0);
  return d.toISOString();
}

/* ---------- L11 · Revenus ---------- */

export type EarningsPeriod = 'day' | 'week' | 'month';

export function periodStart(period: EarningsPeriod, now: string, offset = 0): Date {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  if (period === 'day') d.setDate(d.getDate() - offset);
  if (period === 'week') d.setDate(d.getDate() - ((d.getDay() + 6) % 7) - 7 * offset);
  if (period === 'month') {
    d.setDate(1);
    d.setMonth(d.getMonth() - offset);
  }
  return d;
}

export interface Earnings {
  gains: FC;
  missions: number;
  delivered: number;
  failed: number;
  previousGains: FC;
  /** Finished missions of the period, newest first. */
  items: Order[];
}

export function earnings(missions: Order[], period: EarningsPeriod, now: string): Earnings {
  const start = periodStart(period, now).getTime();
  const prevStart = periodStart(period, now, 1).getTime();
  const end = new Date(now).getTime();
  const done = missions.filter((o) => missionTab(o) === 'done');
  const at = (o: Order) => new Date(finishedAt(o) ?? 0).getTime();
  const items = done.filter((o) => at(o) >= start && at(o) <= end).sort((a, b) => at(b) - at(a));
  const previous = done.filter((o) => at(o) >= prevStart && at(o) < start);
  return {
    gains: items.reduce((t, o) => t + missionPay(o), 0),
    missions: items.length,
    delivered: items.filter((o) => o.delivery === 'delivered').length,
    failed: items.filter((o) => o.delivery === 'failed').length,
    previousGains: previous.reduce((t, o) => t + missionPay(o), 0),
    items,
  };
}

/* ---------- Space reducer ---------- */

export type CourierAction =
  | { type: 'courier/saveProfile'; profile: CourierProfile; at: string }
  | { type: 'courier/submitDocs'; docs: CourierDocs; at: string }
  /** Demo only (L3): plays the YA YO admin validating the file. */
  | { type: 'courier/demoApprove'; at: string }
  | { type: 'courier/setAvailable'; available: boolean; at: string }
  | { type: 'courier/remitCash'; channel: RemitChannel; at: string };

export type CourierResult = { ok: true; space: CourierSpace; event?: string } | { ok: false; code: string; message: string };

const fail = (code: string, message: string): CourierResult => ({ ok: false, code, message });

export function courierReduce(space: CourierSpace | undefined, a: CourierAction, ctx: { accountId: string; due: CashDue }): CourierResult {
  switch (a.type) {
    case 'courier/saveProfile': {
      const err = profileError(a.profile);
      if (err) return fail('INVALID_PROFILE', err);
      const profile: CourierProfile = {
        ...a.profile,
        plate: isMotorised(a.profile.transport) ? normalizePlate(a.profile.plate) : '',
        payoutPhone: normalizePhone(a.profile.payoutPhone)!,
      };
      if (!space) {
        return { ok: true, space: { accountId: ctx.accountId, status: 'draft', profile, docs: {}, available: false, remittances: [] }, event: 'courier.profile.created' };
      }
      // A validated courier who switches to a motorised vehicle sends the new documents first.
      if (space.status !== 'draft' && docsError(profile.transport, space.docs))
        return fail('DOCS_REQUIRED', 'Ce véhicule demande un permis et une carte grise : envoie-les d’abord pour validation.');
      return { ok: true, space: { ...space, profile }, event: 'courier.profile.updated' };
    }
    case 'courier/submitDocs': {
      if (!space) return fail('NO_PROFILE', 'Parle-nous d’abord de toi et de ton véhicule.');
      const err = docsError(space.profile.transport, a.docs);
      if (err) return fail('INVALID_DOCS', err);
      if (space.status === 'verified') return { ok: true, space: { ...space, docs: a.docs }, event: 'courier.docs.updated' };
      return { ok: true, space: { ...space, docs: a.docs, status: 'submitted', submittedAt: a.at }, event: 'courier.kyc.submitted' };
    }
    case 'courier/demoApprove': {
      if (!space || space.status !== 'submitted') return fail('NOT_SUBMITTED', 'Aucun dossier en attente de validation.');
      return { ok: true, space: { ...space, status: 'verified', verifiedAt: a.at, available: false }, event: 'courier.kyc.approved' };
    }
    case 'courier/setAvailable': {
      if (!space || space.status !== 'verified') return fail('NOT_VERIFIED', 'Ton compte livreur doit être validé pour recevoir des missions.');
      if (space.available === a.available) return { ok: true, space };
      return {
        ok: true,
        space: { ...space, available: a.available, availableSince: a.available ? a.at : undefined },
        event: a.available ? 'courier.available' : 'courier.unavailable',
      };
    }
    case 'courier/remitCash': {
      if (!space || space.status !== 'verified') return fail('NOT_VERIFIED', 'Ton compte livreur doit être validé.');
      if (ctx.due.amount <= 0) return fail('NOTHING_DUE', 'Tu n’as pas de cash à reverser.');
      const remittance: Remittance = {
        id: `R-${space.remittances.length + 1}`,
        amount: ctx.due.amount,
        orderIds: ctx.due.orders.map((o) => o.id),
        channel: a.channel,
        at: a.at,
      };
      return { ok: true, space: { ...space, remittances: [...space.remittances, remittance] }, event: `courier.cash.remitted.${a.channel}` };
    }
  }
}

/* ---------- Dispatch ---------- */

/** The rest of the YA YO fleet, simulated, when no courier of the app is available. */
export const FLEET_COURIER: Courier = { name: 'Didier L.', initials: 'DL', vehicle: 'Moto', rating: 4.7 };

export function courierCard(account: { id: string; name: string }, space: CourierSpace): Courier {
  const parts = account.name.trim().split(/\s+/);
  const first = parts[0] ?? '';
  const last = parts.length > 1 ? parts.at(-1)! : '';
  return {
    id: account.id,
    name: last ? `${first} ${last[0]}.` : first,
    initials: `${first[0] ?? ''}${last[0] ?? ''}`.toUpperCase(),
    vehicle: space.profile.transport,
    rating: space.rating ?? 0,
  };
}

/** Weekly payout operator (L11 "Versé le lundi sur M-Pesa"). */
export const payoutOperator = (space: CourierSpace) => detectOperator(space.profile.payoutPhone.replace(/^\+243/, '')) ?? 'Mobile Money';
