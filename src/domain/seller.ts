/**
 * Vendeur · US-10 à US-14 (Figma V1–V15), mock côté appareil.
 *
 * Règles reprises des écrans Figma, sans en inventer :
 * - V10 / V6 / V11 : commission YA YO 10 % du montant des articles ; le net vendeur
 *   retire aussi une participation livraison de 5 % (V6 : 14 250 FC sur 285 000 FC,
 *   V11 : 172 500 FC sur 3 450 000 FC) ;
 * - V6 : le net est « versé après confirmation de la livraison » (séquestre) ;
 * - V3 : la boutique est vérifiée par l’équipe YA YO sous 24 à 48 h ; le vendeur peut
 *   préparer son catalogue en attendant, il sera publié à la validation ;
 * - V9 : jusqu’à 6 photos, la première est la couverture ;
 * - V10 / V14 : un produit passe en rupture automatiquement à 0 ; « Stock faible » à 3 ou moins (V13) ;
 * - V15 : supprimer un produit ne touche pas les commandes en cours.
 *
 * Comme pour les rôles (auth.ts), l’app ne valide jamais une boutique : la
 * validation est simulée par un bouton « démo » qui joue le rôle de l’équipe YA YO.
 */

import { normalizePhone } from './auth';
import { detectOperator } from './paymentProvider';
import type { FC, MobileMoneyOperator, Order } from './types';

export const COMMISSION_RATE = 0.1;
export const SELLER_DELIVERY_RATE = 0.05;
export const MAX_PHOTOS = 6;
export const LOW_STOCK = 3;

/** V1 · Catégorie principale. */
export const SHOP_CATEGORIES = ['Électronique et audio', 'Mode', 'Beauté et soins', 'Maison et déco', 'Alimentation'];
/** V9 · Catégorie du produit. */
export const PRODUCT_CATEGORIES = [
  'Électronique › Audio',
  'Électronique › Enceintes',
  'Électronique › Accessoires',
  'Mode › Vêtements',
  'Mode › Chaussures',
  'Beauté › Soins',
  'Maison › Déco',
];
/** V10 · Couleurs proposées. */
export const PRODUCT_COLORS = ['Noir', 'Blanc', 'Bleu', 'Jaune', 'Rouge', 'Vert', 'Orange', 'Rose', 'Gris'];

/** Photo: local require() (demo gallery) or a URI. */
export type Photo = number | string;

export type ShopStatus = 'draft' | 'submitted' | 'verified';

export interface ShopProfile {
  name: string;
  category: string;
  commune: string;
  pickupAddress: string;
  logo?: Photo;
  hours: string;
}

export interface Kyc {
  idDoc?: Photo;
  selfie?: Photo;
  rccm?: string;
  /** E.164 Mobile Money number for payouts. */
  payoutPhone: string;
}

export type ProductStatus = 'online' | 'offline' | 'draft';

export interface SellerProduct {
  id: string;
  name: string;
  category: string;
  description: string;
  photos: Photo[];
  price: FC;
  compareAt?: FC;
  stock: number;
  colors: string[];
  status: ProductStatus;
  rating?: number;
  reviews?: number;
  updatedAt: string;
}

export interface Withdrawal {
  id: string;
  amount: FC;
  phone: string;
  operator: MobileMoneyOperator;
  at: string;
}

export interface SellerSpace {
  accountId: string;
  /** Catalogue shop id (an existing demo shop for the seeded seller). */
  shopId: string;
  status: ShopStatus;
  profile: ShopProfile;
  kyc?: Kyc;
  submittedAt?: string;
  verifiedAt?: string;
  products: SellerProduct[];
  withdrawals: Withdrawal[];
  readNotifications: string[];
  productSeq: number;
}

/* ---------- Validation ---------- */

export function profileError(p: ShopProfile): string | null {
  if (p.name.trim().length < 2) return 'Indique le nom de ta boutique.';
  if (!p.category) return 'Choisis la catégorie principale.';
  if (!p.commune) return 'Choisis ta commune.';
  if (p.pickupAddress.trim().length < 5) return 'Indique l’adresse où le livreur récupère les colis.';
  return null;
}

export function kycError(k: Kyc): string | null {
  if (!k.idDoc) return 'Ajoute une photo de ta pièce d’identité.';
  if (!k.selfie) return 'Ajoute un selfie avec ta pièce.';
  const phone = normalizePhone(k.payoutPhone);
  if (!phone) return 'Saisis un numéro Mobile Money congolais à 9 chiffres.';
  if (!detectOperator(phone.slice(4))) return 'Ce numéro n’est ni M-Pesa, ni Orange Money, ni Airtel Money.';
  return null;
}

export interface ProductDraft {
  name: string;
  category: string;
  description: string;
  photos: Photo[];
  price: string;
  compareAt: string;
  stock: string;
  colors: string[];
}

/** "95 000" → 95000; anything else → NaN. */
export function parseAmount(input: string): number {
  const d = input.replace(/[\s  ]/g, '');
  return /^\d+$/.test(d) ? Number(d) : NaN;
}

/** Step 1 (V9): photos and description. */
export function productInfoError(d: Pick<ProductDraft, 'name' | 'category' | 'photos'>): string | null {
  if (d.photos.length === 0) return 'Ajoute au moins une photo : la première sert de couverture.';
  if (d.photos.length > MAX_PHOTOS) return `${MAX_PHOTOS} photos maximum.`;
  if (d.name.trim().length < 3) return 'Indique le nom du produit.';
  if (!d.category) return 'Choisis une catégorie.';
  return null;
}

/** Step 2 (V10): price and stock. */
export function productPriceError(d: Pick<ProductDraft, 'price' | 'compareAt' | 'stock'>): string | null {
  const price = parseAmount(d.price);
  if (!(price > 0)) return 'Indique un prix de vente en francs congolais.';
  if (d.compareAt.trim()) {
    const compareAt = parseAmount(d.compareAt);
    if (!(compareAt > price)) return 'Le prix barré doit être plus élevé que le prix de vente.';
  }
  const stock = parseAmount(d.stock);
  if (!(stock >= 0)) return 'Indique la quantité en stock (0 si tu n’en as plus).';
  return null;
}

/** V10 · "Tu reçois (hors livraison)". */
export function payoutPreview(price: FC) {
  const commission = Math.round(price * COMMISSION_RATE);
  return { commission, net: price - commission };
}

/* ---------- Money per order (V6 "Ce que tu recevras") ---------- */

export interface OrderNet {
  items: FC;
  commission: FC;
  delivery: FC;
  net: FC;
}

export function orderNet(o: Pick<Order, 'itemsTotal'>): OrderNet {
  const items = o.itemsTotal;
  const commission = Math.round(items * COMMISSION_RATE);
  const delivery = Math.round(items * SELLER_DELIVERY_RATE);
  return { items, commission, delivery, net: items - commission - delivery };
}

/** Payment secured for the seller: escrow for prepaid orders, confirmed cash order otherwise. */
export function orderSecured(o: Order): boolean {
  // D18: a cancelled order earns the seller nothing.
  if (o.cancellation) return false;
  if (o.method === 'cash') return o.payment !== 'failed' && o.payment !== 'initiated' && o.payment !== 'refunded';
  return ['held_in_escrow', 'in_delivery', 'delivered', 'released', 'disputed'].includes(o.payment);
}

/** V5 tabs (+ "Remises" for parcels already handed to the courier). */
export type SellerOrderTab = 'new' | 'preparing' | 'ready' | 'handed_over';

export function sellerTab(o: Order): SellerOrderTab {
  return o.seller;
}

/** Pick-up code shown on V7 ("H067"): one letter + 3 digits, stable per order. */
export function pickupCodeFor(orderId: string): string {
  let h = 0;
  for (let i = 0; i < orderId.length; i++) h = (Math.imul(31, h) + orderId.charCodeAt(i)) | 0;
  const n = Math.abs(h);
  const letters = 'ABCDEFGHJKLMNPRSTUVWXYZ';
  return `${letters[n % letters.length]}${String(Math.floor(n / letters.length) % 1000).padStart(3, '0')}`;
}

/* ---------- Revenue (V11) ---------- */

const monthKey = (iso: string) => iso.slice(0, 7);
const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

export interface Revenue {
  available: FC;
  blocked: FC;
  month: OrderNet;
  monthSales: FC;
  previousMonthSales: FC;
  movements: { id: string; at: string; label: string; detail: string; amount: FC }[];
}

export function revenue(orders: Order[], withdrawals: Withdrawal[], now: string): Revenue {
  const secured = orders.filter(orderSecured);
  const released = secured.filter((o) => o.payment === 'released');
  const blockedOrders = secured.filter((o) => o.payment !== 'released' && o.payment !== 'disputed');
  const withdrawn = withdrawals.reduce((t, w) => t + w.amount, 0);
  const thisMonth = monthKey(now);
  const prev = new Date(now);
  prev.setUTCDate(1);
  prev.setUTCMonth(prev.getUTCMonth() - 1);
  const prevMonth = monthKey(prev.toISOString());
  const inMonth = secured.filter((o) => monthKey(o.milestones.paidAt ?? o.milestones.createdAt) === thisMonth);
  const month = inMonth.reduce<OrderNet>(
    (t, o) => {
      const n = orderNet(o);
      return { items: t.items + n.items, commission: t.commission + n.commission, delivery: t.delivery + n.delivery, net: t.net + n.net };
    },
    { items: 0, commission: 0, delivery: 0, net: 0 },
  );
  const previousMonthSales = secured
    .filter((o) => monthKey(o.milestones.paidAt ?? o.milestones.createdAt) === prevMonth)
    .reduce((t, o) => t + o.itemsTotal, 0);
  const movements = [
    ...released.map((o) => ({
      id: `in-${o.id}`,
      at: o.milestones.releasedAt ?? o.milestones.createdAt,
      label: `Commande #${o.id}`,
      detail: 'Paiement libéré',
      amount: orderNet(o).net,
    })),
    ...withdrawals.map((w) => ({ id: w.id, at: w.at, label: `Retrait ${w.operator}`, detail: w.phone, amount: -w.amount })),
  ].sort((a, b) => (a.at < b.at ? 1 : -1));
  return {
    available: Math.max(0, released.reduce((t, o) => t + orderNet(o).net, 0) - withdrawn),
    blocked: blockedOrders.reduce((t, o) => t + orderNet(o).net, 0),
    month,
    monthSales: month.items,
    previousMonthSales,
    movements,
  };
}

/** Percentage change, or null when there is nothing to compare with. */
export function trend(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

/* ---------- Dashboard (V4) ---------- */

export interface Dashboard {
  salesToday: FC;
  salesYesterday: FC;
  toProcess: number;
  secured: FC;
}

export function dashboard(orders: Order[], now: string): Dashboard {
  const today = new Date(now);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const secured = orders.filter(orderSecured);
  const salesOn = (d: Date) =>
    secured.filter((o) => dayKey(new Date(o.milestones.paidAt ?? o.milestones.createdAt)) === dayKey(d)).reduce((t, o) => t + o.itemsTotal, 0);
  return {
    salesToday: salesOn(today),
    salesYesterday: salesOn(yesterday),
    toProcess: secured.filter((o) => o.seller === 'new' || o.seller === 'preparing').length,
    secured: secured.filter((o) => o.payment !== 'released' && o.payment !== 'disputed' && o.method !== 'cash').reduce((t, o) => t + orderNet(o).net, 0),
  };
}

/* ---------- Notifications (V13) ---------- */

export type SellerNoticeKind = 'order' | 'courier' | 'stock' | 'payout';

export interface SellerNotice {
  id: string;
  kind: SellerNoticeKind;
  at: string;
  title: string;
  body: string;
  orderId?: string;
  productId?: string;
}

export function sellerNotices(orders: Order[], products: SellerProduct[], now: string): SellerNotice[] {
  const out: SellerNotice[] = [];
  for (const o of orders.filter((x) => x.cancellation)) {
    out.push({
      id: `cancel-${o.id}`,
      kind: 'order',
      at: o.cancellation!.at,
      title: `Commande #${o.id} annulée`,
      body: 'L’acheteur a annulé avant la remise au livreur. Ne prépare pas ce colis.',
      orderId: o.id,
    });
  }
  for (const o of orders.filter((x) => x.dispute)) {
    out.push({
      id: `dispute-${o.id}`,
      kind: 'order',
      at: o.dispute!.openedAt,
      title: `Litige sur #${o.id}`,
      body: o.dispute!.decision
        ? o.dispute!.decision.outcome === 'refund'
          ? 'YA YO a remboursé l’acheteur.'
          : 'YA YO a tranché en ta faveur : le paiement est libéré.'
        : 'L’acheteur a signalé un problème. Les fonds restent bloqués ; YA YO te contacte.',
      orderId: o.id,
    });
  }
  for (const o of orders.filter(orderSecured)) {
    const items = o.lines.map((l) => `${l.qty}× ${l.name.split(' – ')[0]}`).join(', ');
    out.push({
      id: `order-${o.id}`,
      kind: 'order',
      at: o.milestones.paidAt ?? o.milestones.createdAt,
      title: `Nouvelle commande #${o.id}`,
      body: `${o.buyer?.name ?? 'Client'} · ${items} · ${formatNet(orderNet(o).net)} net estimé.`,
      orderId: o.id,
    });
    if (o.courier && o.milestones.preparedAt) {
      out.push({
        id: `courier-${o.id}`,
        kind: 'courier',
        at: o.milestones.preparedAt,
        title: 'Livreur assigné',
        body: `${o.courier.name} vient collecter #${o.id}.`,
        orderId: o.id,
      });
    }
    if (o.payment === 'released') {
      out.push({
        id: `payout-${o.id}`,
        kind: 'payout',
        at: o.milestones.releasedAt ?? o.milestones.createdAt,
        title: 'Paiement libéré',
        body: `${formatNet(orderNet(o).net)} versés pour #${o.id}.`,
        orderId: o.id,
      });
    }
  }
  for (const p of products) {
    if (p.status === 'draft' || p.stock > LOW_STOCK) continue;
    out.push({
      id: `stock-${p.id}-${p.stock}`,
      kind: 'stock',
      at: p.updatedAt,
      title: p.stock === 0 ? 'Rupture de stock' : 'Stock faible',
      body: p.stock === 0 ? `${p.name} n’est plus visible à l’achat.` : `${p.name} : plus que ${p.stock} en stock.`,
      productId: p.id,
    });
  }
  return out.filter((n) => n.at <= now).sort((a, b) => (a.at < b.at ? 1 : -1));
}

function formatNet(n: FC) {
  return `${n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} FC`;
}

/* ---------- Catalogue (V8) ---------- */

export type ProductFilter = 'all' | 'online' | 'out' | 'draft' | 'offline';

export function productFilter(p: SellerProduct): Exclude<ProductFilter, 'all'> {
  if (p.status === 'draft') return 'draft';
  if (p.status === 'offline') return 'offline';
  return p.stock === 0 ? 'out' : 'online';
}

export function filterProducts(list: SellerProduct[], filter: ProductFilter, query: string): SellerProduct[] {
  const q = query.trim().toLowerCase();
  return list.filter((p) => (filter === 'all' || productFilter(p) === filter) && (!q || p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q)));
}

/* ---------- State machine ---------- */

export type SellerAction =
  | { type: 'seller/saveProfile'; profile: ShopProfile; at: string }
  | { type: 'seller/submitKyc'; kyc: Kyc; at: string }
  | { type: 'seller/demoApprove'; at: string }
  | { type: 'seller/setPayout'; phone: string; at: string }
  | { type: 'seller/saveProduct'; id?: string; draft: ProductDraft; status: ProductStatus; at: string }
  | { type: 'seller/setOnline'; id: string; online: boolean; at: string }
  | { type: 'seller/deleteProduct'; id: string; at: string }
  | { type: 'seller/markOutOfStock'; productIds: string[]; at: string }
  | { type: 'seller/withdraw'; amount: FC; at: string }
  | { type: 'seller/readNotifications'; ids: string[]; at: string };

export type SellerResult = { ok: true; space: SellerSpace; event?: string; id?: string } | { ok: false; code: string; message: string };

const ok = (space: SellerSpace, event?: string, id?: string): SellerResult => ({ ok: true, space, event, id });
const fail = (code: string, message: string): SellerResult => ({ ok: false, code, message });

/**
 * `space` is undefined until V1 is saved. `available` is the withdrawable
 * balance computed from the orders (V11), passed in by the store.
 */
export function sellerReduce(
  space: SellerSpace | undefined,
  a: SellerAction,
  ctx: { accountId: string; available: FC; shopId: string },
): SellerResult {
  if (a.type === 'seller/saveProfile') {
    const err = profileError(a.profile);
    if (err) return fail('INVALID_PROFILE', err);
    const profile = { ...a.profile, name: a.profile.name.trim().replace(/\s+/g, ' '), pickupAddress: a.profile.pickupAddress.trim() };
    if (!space) {
      return ok(
        {
          accountId: ctx.accountId,
          shopId: ctx.shopId,
          status: 'draft',
          profile,
          products: [],
          withdrawals: [],
          readNotifications: [],
          productSeq: 0,
        },
        'seller.shop.created',
      );
    }
    return ok({ ...space, profile }, 'seller.shop.updated');
  }
  if (!space) return fail('NO_SHOP', 'Crée d’abord ta boutique.');

  switch (a.type) {
    case 'seller/submitKyc': {
      if (space.status === 'verified') return fail('ALREADY_VERIFIED', 'Ta boutique est déjà vérifiée.');
      const err = kycError(a.kyc);
      if (err) return fail('INVALID_KYC', err);
      const kyc = { ...a.kyc, payoutPhone: normalizePhone(a.kyc.payoutPhone)!, rccm: a.kyc.rccm?.trim() || undefined };
      return ok({ ...space, kyc, status: 'submitted', submittedAt: a.at }, 'seller.kyc.submitted');
    }
    case 'seller/demoApprove':
      if (space.status !== 'submitted') return fail('NOT_SUBMITTED', 'Le dossier n’a pas encore été envoyé.');
      return ok({ ...space, status: 'verified', verifiedAt: a.at }, 'seller.shop.verified');

    case 'seller/setPayout': {
      const phone = normalizePhone(a.phone);
      if (!phone || !detectOperator(phone.slice(4))) return fail('INVALID_PHONE', 'Saisis un numéro M-Pesa, Orange Money ou Airtel Money.');
      if (!space.kyc) return fail('NO_KYC', 'Envoie d’abord ta vérification d’identité.');
      return ok({ ...space, kyc: { ...space.kyc, payoutPhone: phone } }, 'seller.payout.updated');
    }

    case 'seller/saveProduct': {
      const d = a.draft;
      const infoErr = productInfoError(d);
      if (infoErr) return fail('INVALID_PRODUCT', infoErr);
      // A draft may be saved before its price is known (V10 "Brouillon").
      const incompleteDraft = a.status === 'draft' && !d.price.trim();
      const priceErr = incompleteDraft ? null : productPriceError(d);
      if (priceErr) return fail('INVALID_PRICE', priceErr);
      const fields = {
        name: d.name.trim().replace(/\s+/g, ' '),
        category: d.category,
        description: d.description.trim(),
        photos: d.photos,
        price: incompleteDraft ? 0 : parseAmount(d.price),
        compareAt: d.compareAt.trim() && !incompleteDraft ? parseAmount(d.compareAt) : undefined,
        stock: d.stock.trim() ? parseAmount(d.stock) || 0 : 0,
        colors: d.colors,
        status: a.status,
        updatedAt: a.at,
      };
      if (a.id) {
        const existing = space.products.find((p) => p.id === a.id);
        if (!existing) return fail('NOT_FOUND', 'Produit introuvable.');
        return ok({ ...space, products: space.products.map((p) => (p.id === a.id ? { ...p, ...fields } : p)) }, 'seller.product.updated', a.id);
      }
      const id = `P-${space.productSeq + 1}`;
      return ok({ ...space, productSeq: space.productSeq + 1, products: [{ id, ...fields }, ...space.products] }, `seller.product.${a.status === 'draft' ? 'drafted' : 'published'}`, id);
    }

    case 'seller/setOnline': {
      const p = space.products.find((x) => x.id === a.id);
      if (!p) return fail('NOT_FOUND', 'Produit introuvable.');
      if (a.online && p.photos.length === 0) return fail('NO_PHOTO', 'Ajoute une photo avant de mettre le produit en ligne.');
      if (a.online && p.price <= 0) return fail('NO_PRICE', 'Indique un prix avant de mettre le produit en ligne.');
      const status: ProductStatus = a.online ? 'online' : 'offline';
      return ok({ ...space, products: space.products.map((x) => (x.id === a.id ? { ...x, status, updatedAt: a.at } : x)) }, `seller.product.${status}`);
    }

    case 'seller/deleteProduct':
      if (!space.products.some((p) => p.id === a.id)) return fail('NOT_FOUND', 'Produit introuvable.');
      // Orders keep their own copy of the lines: nothing in progress is cancelled (V15).
      return ok({ ...space, products: space.products.filter((p) => p.id !== a.id) }, 'seller.product.deleted');

    case 'seller/markOutOfStock':
      return ok(
        { ...space, products: space.products.map((p) => (a.productIds.includes(p.id) ? { ...p, stock: 0, updatedAt: a.at } : p)) },
        'seller.stockout.reported',
      );

    case 'seller/withdraw': {
      if (space.status !== 'verified' || !space.kyc) return fail('NOT_VERIFIED', 'Les retraits s’ouvrent après la vérification de ta boutique.');
      if (!Number.isInteger(a.amount) || a.amount <= 0) return fail('INVALID_AMOUNT', 'Indique un montant à retirer.');
      if (a.amount > ctx.available) return fail('INSUFFICIENT_BALANCE', 'Le montant dépasse ton solde disponible.');
      const operator = detectOperator(space.kyc.payoutPhone.slice(4));
      if (!operator) return fail('INVALID_PHONE', 'Ton compte de virement n’est pas un numéro Mobile Money.');
      const w: Withdrawal = { id: `W-${space.withdrawals.length + 1}`, amount: a.amount, phone: space.kyc.payoutPhone, operator, at: a.at };
      return ok({ ...space, withdrawals: [...space.withdrawals, w] }, 'seller.withdrawal.sent');
    }

    case 'seller/readNotifications': {
      const read = Array.from(new Set([...space.readNotifications, ...a.ids]));
      if (read.length === space.readNotifications.length) return ok(space);
      return ok({ ...space, readNotifications: read });
    }
  }
}

/** "+243812345678" → "+243 81 *** 678" (V12 · Compte de virement). */
export function maskPhone(e164: string): string {
  const d = e164.replace(/^\+243/, '');
  return `+243 ${d.slice(0, 2)} *** ${d.slice(-3)}`;
}
