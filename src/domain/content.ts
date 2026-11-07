/**
 * Social commerce, seller side (US-24 to US-32: SV0–SV18) and the shared
 * parts the buyer sees (SC3–SC6: feed, comments, saves).
 * Pure rules: the reducer in state.ts applies them.
 */
import { products as catalog } from './catalog';
import { posts as staticPosts } from './feed';
import type { Photo } from './seller';
import type { FC, Post } from './types';

export type ContentKind = 'video' | 'photos' | 'story' | 'live';
/** SV1 tabs. `hidden` = masqué par la modération YA YO (SV9). */
export type ContentStatus = 'published' | 'scheduled' | 'draft' | 'hidden';

export interface ContentStats {
  views: number;
  likes: number;
  productClicks: number;
  sales: number;
  salesAmount: FC;
  shares: number;
  saves: number;
}

export interface Moderation {
  /** "Coordonnées dans la légende". */
  reason: string;
  detail: string;
  at: string;
  appeal?: { message: string; at: string; status: 'pending' | 'accepted' | 'rejected' };
}

export interface LiveInfo {
  title: string;
  description: string;
  startsAt: string;
  notify: boolean;
  state: 'scheduled' | 'live' | 'ended';
  startedAt?: string;
  endedAt?: string;
  pinnedProductId?: string;
  peak?: number;
  viewers?: number;
  orders?: number;
  salesAmount?: FC;
}

export interface ContentItem {
  id: string;
  shopId: string;
  kind: ContentKind;
  status: ContentStatus;
  caption: string;
  /** Photos (carousel), or the video cover. */
  media: Photo[];
  video?: Photo;
  /** Video: first frame. */
  poster?: Photo;
  /** Linked products (5 max). */
  productIds: string[];
  allowComments: boolean;
  allowShare: boolean;
  /** "Commander" button on the video (SC2 quick buy). */
  buyButton: boolean;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
  scheduledAt?: string;
  /** Stories: gone 24 h after publication. */
  expiresAt?: string;
  live?: LiveInfo;
  stats: ContentStats;
  /** SV4 "Par produit lié". */
  perProduct?: Record<string, { clicks: number; sales: number }>;
  moderation?: Moderation;
}

export interface Collection {
  id: string;
  shopId: string;
  name: string;
  description: string;
  cover?: Photo;
  productIds: string[];
  status: 'published' | 'draft';
  position: number;
}

export type CommentStatus = 'visible' | 'masked' | 'blocked';

export interface Comment {
  id: string;
  postId: string;
  author: string;
  authorId?: string;
  /** Written by the shop (badge "Vendeur"). */
  seller?: boolean;
  text: string;
  at: string;
  likes: number;
  status: CommentStatus;
  /** Masked automatically by YA YO (number, link, off-app payment). */
  autoMasked?: boolean;
  /** Needs the seller's attention (SV4 "Commentaires à modérer"). */
  review?: boolean;
  pinned?: boolean;
  replyTo?: string;
}

export interface ContentState {
  items: Record<string, ContentItem>;
  collections: Record<string, Collection>;
  comments: Record<string, Comment[]>;
  seq: number;
}

/* ---------- Limits (Figma SV2, SV3, SV5, SV13, SV16) ---------- */

export const MAX_LINKED_PRODUCTS = 5;
export const MAX_CAROUSEL_PHOTOS = 10;
export const MAX_CAPTION = 300;
export const MAX_COMMENT = 300;
export const MAX_APPEAL = 500;
export const SCHEDULE_MIN_MS = 15 * 60_000;
export const SCHEDULE_MAX_MS = 30 * 24 * 3_600_000;
export const STORY_TTL_MS = 24 * 3_600_000;
export const COLLECTION_MIN = 2;
export const COLLECTION_MAX = 30;

const ms = (iso: string) => new Date(iso).getTime();
export const addMs = (iso: string, d: number) => new Date(ms(iso) + d).toISOString();

/* ---------- Moderation (SV2 note, SV4, SV8, SV9, SC4) ---------- */

export const MASKED_NUMBER = '[Numéro masqué par YA YO]';
export const MASKED_LINK = '[Lien masqué par YA YO]';

const PHONE = /(?:\+|00)?\d[\d\s.\-]{6,}\d/g;
const LINK = /\b(?:https?:\/\/|www\.)\S+|\b\S+\.(?:com|cd|net|org|me|ly|link)\b\S*|\bwa\.me\/\S*/gi;
const OFF_APP_PAYMENT = /(paie|paye|payer|envoie|envoyez|transf[eè]re)[^.]{0,30}(m-?pesa|orange money|airtel money|cash)[^.]{0,20}(avant|direct|d[’']abord)|paiement (direct|hors appli)/i;

export type Violation = 'phone' | 'link' | 'payment';

/** Masks numbers and links; reports what was found. */
export function moderateText(text: string): { text: string; violations: Violation[] } {
  const violations: Violation[] = [];
  let out = text.replace(PHONE, (m) => {
    // Prices and short numbers are fine: 7+ digits looks like a phone number.
    if (m.replace(/\D/g, '').length < 8) return m;
    if (!violations.includes('phone')) violations.push('phone');
    return MASKED_NUMBER;
  });
  out = out.replace(LINK, () => {
    if (!violations.includes('link')) violations.push('link');
    return MASKED_LINK;
  });
  if (OFF_APP_PAYMENT.test(out)) violations.push('payment');
  return { text: out, violations };
}

/* ---------- Status and scheduling ---------- */

/** A scheduled item goes live by itself at its time; a story disappears after 24 h. */
export function statusAt(item: ContentItem, now: string): ContentStatus | 'expired' {
  if (item.kind === 'story' && item.status === 'published' && item.expiresAt && ms(now) >= ms(item.expiresAt)) return 'expired';
  if (item.status === 'scheduled' && item.scheduledAt && ms(now) >= ms(item.scheduledAt)) return 'published';
  return item.status;
}

export function scheduleError(at: string, now: string): string | null {
  const d = ms(at) - ms(now);
  if (!Number.isFinite(d)) return 'Choisis une date et une heure.';
  if (d < SCHEDULE_MIN_MS) return 'Programme au moins 15 minutes à l’avance.';
  if (d > SCHEDULE_MAX_MS) return 'Programme dans les 30 prochains jours.';
  return null;
}

export const emptyStats = (): ContentStats => ({ views: 0, likes: 0, productClicks: 0, sales: 0, salesAmount: 0, shares: 0, saves: 0 });

/* ---------- Drafts (SV2, SV14, SV16) ---------- */

export interface ContentDraft {
  kind: ContentKind;
  caption: string;
  media: Photo[];
  video?: Photo;
  productIds: string[];
  allowComments: boolean;
  allowShare: boolean;
  buyButton: boolean;
  live?: Pick<LiveInfo, 'title' | 'description' | 'startsAt' | 'notify'>;
}

export function newDraft(kind: ContentKind): ContentDraft {
  return { kind, caption: '', media: [], productIds: [], allowComments: true, allowShare: true, buyButton: true };
}

/** What blocks publishing; `linkable` = ids the seller may link (online, in stock). */
export function draftError(d: ContentDraft, linkable: string[]): string | null {
  if (d.kind === 'video' && !d.video) return 'Ajoute une vidéo.';
  if (d.kind === 'photos' && d.media.length === 0) return 'Ajoute au moins une photo.';
  if (d.kind === 'photos' && d.media.length > MAX_CAROUSEL_PHOTOS) return `${MAX_CAROUSEL_PHOTOS} photos au maximum.`;
  if (d.kind === 'story' && d.media.length === 0) return 'Ajoute une photo pour ta story.';
  if (d.caption.length > MAX_CAPTION) return `La légende fait ${MAX_CAPTION} caractères au maximum.`;
  if (d.productIds.length > MAX_LINKED_PRODUCTS) return `${MAX_LINKED_PRODUCTS} produits liés au maximum.`;
  if (d.productIds.some((id) => !linkable.includes(id))) return 'Un produit lié n’est plus en ligne ou en stock.';
  if (d.kind !== 'story' && d.kind !== 'live' && d.productIds.length === 0) return 'Lie au moins un produit : c’est lui que les acheteurs commandent.';
  if (d.kind === 'live') {
    if (!d.live || d.live.title.trim().length < 3) return 'Donne un titre à ton live.';
    if (d.productIds.length === 0) return 'Ajoute les produits que tu présentes.';
  }
  return null;
}

/* ---------- Collections (SV12–SV13) ---------- */

export function collectionError(c: Pick<Collection, 'name' | 'productIds'>): string | null {
  if (c.name.trim().length < 2) return 'Donne un nom à ta collection.';
  if (c.productIds.length < COLLECTION_MIN) return `Ajoute au moins ${COLLECTION_MIN} produits.`;
  if (c.productIds.length > COLLECTION_MAX) return `${COLLECTION_MAX} produits au maximum.`;
  return null;
}

/* ---------- Performance (SV11) ---------- */

export type Period = 'today' | '7d' | '30d' | 'all';
const PERIOD_MS: Record<Exclude<Period, 'all'>, number> = { today: 24 * 3_600_000, '7d': 7 * 24 * 3_600_000, '30d': 30 * 24 * 3_600_000 };

export interface Performance {
  views: number;
  productClicks: number;
  sales: number;
  salesAmount: FC;
  conversion: number;
  byKind: Record<ContentKind, FC>;
  /** Previous period of the same length (null for "Depuis le début"). */
  previous: { views: number; productClicks: number; conversion: number } | null;
  top: ContentItem[];
}

/** Stats of the contents published in the period (a content's figures count where it was published). */
export function performance(items: ContentItem[], period: Period, now: string): Performance {
  const live = items.filter((i) => i.publishedAt);
  const inRange = (i: ContentItem, from: number, to: number) => ms(i.publishedAt!) > from && ms(i.publishedAt!) <= to;
  const end = ms(now);
  const span = period === 'all' ? Infinity : PERIOD_MS[period];
  const cur = period === 'all' ? live : live.filter((i) => inRange(i, end - span, end));
  const sum = (list: ContentItem[]) => {
    const views = list.reduce((t, i) => t + i.stats.views, 0);
    const productClicks = list.reduce((t, i) => t + i.stats.productClicks, 0);
    const sales = list.reduce((t, i) => t + i.stats.sales, 0);
    return { views, productClicks, sales, salesAmount: list.reduce((t, i) => t + i.stats.salesAmount, 0), conversion: views ? sales / views : 0 };
  };
  const s = sum(cur);
  const byKind: Record<ContentKind, FC> = { video: 0, photos: 0, story: 0, live: 0 };
  for (const i of cur) byKind[i.kind] += i.stats.salesAmount;
  const prev = period === 'all' ? null : sum(live.filter((i) => inRange(i, end - 2 * span, end - span)));
  return {
    ...s,
    byKind,
    previous: prev ? { views: prev.views, productClicks: prev.productClicks, conversion: prev.conversion } : null,
    top: [...cur].sort((a, b) => b.stats.views - a.stats.views).slice(0, 3),
  };
}

/** "+24 %", or null when there is nothing to compare with. */
export function percentChange(current: number, previous: number): number | null {
  if (!previous) return null;
  return Math.round(((current - previous) / previous) * 100);
}

/* ---------- Buyer feed ---------- */

/** A published video or photo content, as the buyer feed shows it. */
export function toPost(item: ContentItem, commentCount: number): Post {
  return {
    id: item.id,
    kind: item.kind === 'video' ? 'video' : 'photo',
    shopId: item.shopId,
    caption: item.caption,
    video: item.video,
    media: item.media,
    poster: item.poster,
    // Only products the buyer app can open (a product created in the seller demo has no buyer page yet).
    productIds: item.productIds.filter((id) => !!catalog[id]),
    likes: item.stats.likes,
    comments: commentCount,
    saves: item.stats.saves,
    reposts: item.stats.shares,
    createdAt: item.publishedAt ?? item.createdAt,
  };
}

/** Static demo posts not managed by a seller space, plus every published content. Newest first. */
export function feedPosts(content: ContentState, now: string): Post[] {
  const managed = new Set(Object.keys(content.items));
  const own = Object.values(content.items)
    .filter((i) => (i.kind === 'video' || i.kind === 'photos') && statusAt(i, now) === 'published')
    .map((i) => toPost(i, commentCount(content, i.id)));
  return [...staticPosts.filter((p) => !managed.has(p.id)), ...own].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Count shown on a post: the demo count (which includes the seeded comments) plus the ones written in the app. */
export function commentCount(content: ContentState, postId: string): number {
  const list = (content.comments[postId] ?? []).filter((x) => x.status !== 'blocked');
  const base = staticPosts.find((p) => p.id === postId)?.comments;
  if (base === undefined) return list.length;
  return base + Math.max(0, list.length - (SEED_COMMENT_IDS.get(postId) ?? 0));
}

/** Comments a buyer sees: visible ones, pinned first, then newest. */
export function visibleComments(content: ContentState, postId: string): Comment[] {
  const list = (content.comments[postId] ?? []).filter((c) => c.status !== 'blocked');
  return [...list].sort((a, b) => (a.pinned === b.pinned ? b.at.localeCompare(a.at) : a.pinned ? -1 : 1));
}

/* ---------- Seed (JBL Store Kin, after SV1, SV4, SV8, SV9, SV12) ---------- */

const SEED_COMMENT_IDS = new Map<string, number>([
  ['P-pulse', 4],
  ['P-go3', 4],
]);

export function seedContent(now: string): ContentState {
  const ago = (h: number) => new Date(ms(now) - h * 3_600_000).toISOString();
  const go3 = staticPosts.find((p) => p.id === 'P-go3')!;
  const base = { allowComments: true, allowShare: true, buyButton: true };
  const item = (i: Omit<ContentItem, 'allowComments' | 'allowShare' | 'buyButton' | 'updatedAt'> & Partial<ContentItem>): ContentItem => ({
    ...base,
    updatedAt: i.createdAt,
    ...i,
  });
  const items: ContentItem[] = [
    item({
      id: 'P-go3',
      shopId: 'jbl-store-kin',
      kind: 'video',
      status: 'published',
      caption: go3.caption,
      video: go3.video,
      poster: go3.poster,
      media: go3.media,
      productIds: ['jbl-go-3', 'jbl-charge-5'],
      createdAt: go3.createdAt,
      publishedAt: go3.createdAt,
      stats: { views: 12_100, likes: go3.likes, productClicks: 980, sales: 9, salesAmount: 855_000, shares: go3.reposts, saves: go3.saves },
      perProduct: { 'jbl-go-3': { clicks: 740, sales: 6 }, 'jbl-charge-5': { clicks: 240, sales: 3 } },
    }),
    item({
      id: 'C-tune',
      shopId: 'jbl-store-kin',
      kind: 'photos',
      status: 'published',
      caption: 'Tune 520BT en 30 secondes : pliable, 57 h d’autonomie, livré en 24 h.',
      media: staticPosts.find((p) => p.id === 'P-tune')!.media,
      productIds: ['P-3'],
      createdAt: ago(30),
      publishedAt: ago(30),
      stats: { views: 4_300, likes: 860, productClicks: 310, sales: 4, salesAmount: 500_000, shares: 22, saves: 140 },
      perProduct: { 'P-3': { clicks: 310, sales: 4 } },
    }),
    item({
      id: 'C-buds',
      shopId: 'jbl-store-kin',
      kind: 'photos',
      status: 'published',
      caption: 'Wave Buds : 32 h d’autonomie avec le boîtier. Noir ou blanc.',
      media: [staticPosts.find((p) => p.id === 'P-pulse')!.media[0]!],
      productIds: ['P-4'],
      createdAt: ago(80),
      publishedAt: ago(80),
      stats: { views: 3_900, likes: 540, productClicks: 260, sales: 3, salesAmount: 246_000, shares: 11, saves: 95 },
    }),
    item({
      id: 'C-sched',
      shopId: 'jbl-store-kin',
      kind: 'photos',
      status: 'scheduled',
      caption: 'Arrivage samedi : la Go 3 en rouge 🔴',
      media: go3.media,
      productIds: ['jbl-go-3'],
      createdAt: ago(2),
      scheduledAt: new Date(ms(now) + 30 * 3_600_000).toISOString(),
      stats: emptyStats(),
    }),
    item({
      id: 'C-draft',
      shopId: 'jbl-store-kin',
      kind: 'photos',
      status: 'draft',
      caption: 'Charge 5 : la batterie qui recharge aussi ton téléphone.',
      media: [staticPosts.find((p) => p.id === 'P-go3')!.poster!],
      productIds: ['jbl-charge-5'],
      createdAt: ago(5),
      stats: emptyStats(),
    }),
    item({
      id: 'C-hidden',
      shopId: 'jbl-store-kin',
      kind: 'photos',
      status: 'hidden',
      caption: 'Go 3 à prix cassé, appelez-moi au 81 555 0101 !',
      media: go3.media,
      productIds: ['jbl-go-3'],
      createdAt: ago(170),
      publishedAt: ago(170),
      stats: { views: 3_100, likes: 120, productClicks: 40, sales: 0, salesAmount: 0, shares: 2, saves: 8 },
      moderation: {
        reason: 'Coordonnées dans la légende',
        detail: 'Un numéro de téléphone a été détecté. Les échanges et les paiements doivent rester dans YA YO pour que l’acheteur soit protégé par le séquestre.',
        at: ago(160),
      },
    }),
    item({
      id: 'C-live',
      shopId: 'jbl-store-kin',
      kind: 'live',
      status: 'scheduled',
      caption: 'Soirée enceintes en direct',
      media: [go3.poster ?? go3.media[0]!],
      productIds: ['jbl-go-3', 'jbl-charge-5'],
      createdAt: ago(6),
      scheduledAt: new Date(ms(now) + 26 * 3_600_000).toISOString(),
      live: {
        title: 'Soirée enceintes en direct',
        description: 'On teste le son des Go 3 et Charge 5 en direct, questions et commandes pendant le live.',
        startsAt: new Date(ms(now) + 26 * 3_600_000).toISOString(),
        notify: true,
        state: 'scheduled',
      },
      stats: emptyStats(),
    }),
  ];
  const c = (id: string, postId: string, author: string, text: string, h: number, extra: Partial<Comment> = {}): Comment => ({
    id,
    postId,
    author,
    text,
    at: ago(h),
    likes: 0,
    status: 'visible',
    ...extra,
  });
  const comments: Record<string, Comment[]> = {
    'P-pulse': [
      c('CM-1', 'P-pulse', 'Grâce M.', 'Elle existe en bleu ? Livraison possible à Lemba ?', 2, { likes: 12 }),
      c('CM-2', 'P-pulse', 'Bilokos2Kin', 'Oui en bleu et noir 👍 Livraison partout à Kinshasa, commande directement depuis la vidéo.', 1, { likes: 30, seller: true }),
      c('CM-3', 'P-pulse', 'Junior K.', 'Reçue hier, le son est top. Paiement protégé, aucun souci.', 0.75, { likes: 8 }),
      c('CM-4', 'P-pulse', 'Utilisateur', `${MASKED_NUMBER} — contactez-moi`, 0.1, { status: 'masked', autoMasked: true }),
    ],
    'P-go3': [
      c('CM-5', 'P-go3', 'Patrick K.', 'Livré en 24 h à Ngaliema, conforme à la vidéo. Merci !', 24, { likes: 34, pinned: true }),
      c('CM-6', 'P-go3', 'JBL Store Kin', 'Merci Patrick ! Le Go 3 bleu revient en stock vendredi.', 23, { likes: 8, seller: true, replyTo: 'CM-5' }),
      c('CM-7', 'P-go3', 'Grâce M.', 'Elle existe en bleu ? Livraison possible à Lemba ?', 2, { review: true }),
      c('CM-8', 'P-go3', 'Utilisateur', `${MASKED_NUMBER} — contactez-moi`, 0.1, { status: 'masked', autoMasked: true, review: true }),
    ],
  };
  const collections: Collection[] = [
    { id: 'COL-1', shopId: 'jbl-store-kin', name: 'Sono de fête', description: 'Tout pour animer tes soirées, livré à Kinshasa', productIds: ['jbl-go-3', 'jbl-charge-5', 'P-3'], status: 'published', position: 0 },
    { id: 'COL-2', shopId: 'jbl-store-kin', name: 'Casques et écouteurs', description: 'Pour la route et le bureau', productIds: ['P-3', 'P-4'], status: 'published', position: 1 },
    { id: 'COL-3', shopId: 'jbl-store-kin', name: 'Noël', description: '', productIds: ['jbl-go-3'], status: 'draft', position: 2 },
  ];
  return {
    items: Object.fromEntries(items.map((i) => [i.id, i])),
    collections: Object.fromEntries(collections.map((x) => [x.id, x])),
    comments,
    seq: 1,
  };
}

/* ---------- Reducer ---------- */

export type ContentAction =
  | { type: 'content/save'; id?: string; draft: ContentDraft; mode: 'draft' | 'publish' | 'schedule'; scheduledAt?: string; at: string }
  | { type: 'content/duplicate'; id: string; at: string }
  | { type: 'content/unpublish'; id: string; at: string }
  | { type: 'content/delete'; id: string; at: string }
  | { type: 'content/replaceProduct'; id: string; from: string; to: string; at: string }
  | { type: 'content/appeal'; id: string; message: string; at: string }
  | { type: 'content/resubmit'; id: string; caption: string; at: string }
  /** Demo only: plays the YA YO admin answering an appeal. */
  | { type: 'content/demoReview'; id: string; accept: boolean; at: string }
  | { type: 'content/liveStart'; id: string; at: string }
  | { type: 'content/livePin'; id: string; productId: string; at: string }
  | { type: 'content/liveEnd'; id: string; peak: number; viewers: number; orders: number; salesAmount: FC; at: string }
  | { type: 'content/publishReplay'; id: string; at: string }
  | { type: 'collection/save'; id?: string; name: string; description: string; cover?: Photo; productIds: string[]; status: 'published' | 'draft'; at: string }
  | { type: 'collection/delete'; id: string; at: string }
  | { type: 'collection/move'; id: string; by: -1 | 1; at: string }
  | { type: 'comment/add'; postId: string; text: string; replyTo?: string; at: string }
  | { type: 'comment/moderate'; postId: string; commentId: string; action: 'hide' | 'show' | 'pin' | 'unpin' | 'block' | 'keep'; at: string }
  /** SC4 « Signaler »: the comment goes to the seller's moderation queue (SV8). */
  | { type: 'comment/report'; postId: string; commentId: string; at: string }
  | { type: 'content/track'; postId: string; metric: 'view' | 'click' | 'share'; productId?: string; at: string };

export interface ContentCtx {
  /** Shop of the signed-in seller, verified or not. */
  shopId?: string;
  verified: boolean;
  /** Seller products that may be linked (online and in stock). */
  linkable: string[];
  /** Signed-in account, for comments. */
  account?: { id: string; name: string };
  /** Shop name, when the signed-in account owns the post's shop. */
  ownerShopName?: string;
}

export type ContentResult = { ok: true; content: ContentState; event?: string; id?: string } | { ok: false; code: string; message: string };

const okC = (content: ContentState, event?: string, id?: string): ContentResult => ({ ok: true, content, event, id });
const failC = (code: string, message: string): ContentResult => ({ ok: false, code, message });

/** "Grâce Mbuyi" → "Grâce M." (as on SC4). */
export const shortName = (name: string) => {
  const [first = '', last = ''] = name.trim().split(/\s+/);
  return last ? `${first} ${last[0]}.` : first;
};

export function contentReduce(c: ContentState, a: ContentAction, ctx: ContentCtx): ContentResult {
  const put = (item: ContentItem, event: string) => okC({ ...c, items: { ...c.items, [item.id]: item } }, event, item.id);
  const mine = (id: string) => {
    const it = c.items[id];
    return it && ctx.shopId && it.shopId === ctx.shopId ? it : undefined;
  };

  switch (a.type) {
    case 'content/track': {
      const it = c.items[a.postId];
      if (!it) return okC(c);
      const s = { ...it.stats };
      let perProduct = it.perProduct;
      if (a.metric === 'view') s.views += 1;
      if (a.metric === 'share') s.shares += 1;
      if (a.metric === 'click') {
        s.productClicks += 1;
        if (a.productId) {
          const p = perProduct?.[a.productId] ?? { clicks: 0, sales: 0 };
          perProduct = { ...perProduct, [a.productId]: { ...p, clicks: p.clicks + 1 } };
        }
      }
      return okC({ ...c, items: { ...c.items, [it.id]: { ...it, stats: s, perProduct } } });
    }

    case 'comment/add': {
      if (!ctx.account) return failC('NOT_SIGNED_IN', 'Connecte-toi pour commenter.');
      const text = a.text.trim();
      if (!text) return failC('EMPTY', 'Écris ton commentaire.');
      if (text.length > MAX_COMMENT) return failC('TOO_LONG', `${MAX_COMMENT} caractères au maximum.`);
      const it = c.items[a.postId];
      if (it && !it.allowComments) return failC('COMMENTS_OFF', 'Les commentaires sont fermés sur cette publication.');
      const list = c.comments[a.postId] ?? [];
      if (list.some((x) => x.authorId === ctx.account!.id && x.status === 'blocked')) return failC('BLOCKED', 'Tu ne peux plus commenter les publications de cette boutique.');
      const m = moderateText(text);
      const seller = !!ctx.ownerShopName;
      const comment: Comment = {
        id: `CM-${c.seq + 100}`,
        postId: a.postId,
        author: seller ? ctx.ownerShopName! : shortName(ctx.account.name),
        authorId: ctx.account.id,
        seller,
        text: m.text,
        at: a.at,
        likes: 0,
        status: m.violations.length ? 'masked' : 'visible',
        autoMasked: m.violations.length > 0 || undefined,
        review: !seller || undefined,
        replyTo: a.replyTo,
      };
      // A seller's reply settles the comment it answers.
      const updated = seller && a.replyTo ? list.map((x) => (x.id === a.replyTo ? { ...x, review: undefined } : x)) : list;
      return okC({ ...c, seq: c.seq + 1, comments: { ...c.comments, [a.postId]: [...updated, comment] } }, m.violations.length ? 'comment.masked' : 'comment.added', comment.id);
    }

    case 'comment/report': {
      if (!ctx.account) return failC('NOT_SIGNED_IN', 'Connecte-toi pour signaler un commentaire.');
      const list = c.comments[a.postId] ?? [];
      const target = list.find((x) => x.id === a.commentId);
      if (!target || target.status === 'blocked') return failC('NOT_FOUND', 'Commentaire introuvable.');
      if (target.authorId === ctx.account.id) return failC('OWN_COMMENT', 'Tu ne peux pas signaler ton propre commentaire.');
      const next = list.map((x) => (x.id === a.commentId ? { ...x, review: true } : x));
      return okC({ ...c, comments: { ...c.comments, [a.postId]: next } }, 'comment.reported');
    }

    case 'comment/moderate': {
      const it = mine(a.postId);
      const isStaticOwn = !it && ctx.shopId && staticPosts.some((p) => p.id === a.postId && p.shopId === ctx.shopId);
      if (!it && !isStaticOwn) return failC('NOT_OWNER', 'Seule la boutique peut modérer ces commentaires.');
      const list = c.comments[a.postId] ?? [];
      const target = list.find((x) => x.id === a.commentId);
      if (!target) return failC('NOT_FOUND', 'Commentaire introuvable.');
      const next = list.map((x) => {
        if (a.action === 'block' && target.authorId && x.authorId === target.authorId) return { ...x, status: 'blocked' as const, review: undefined, pinned: undefined };
        if (x.id !== a.commentId) return a.action === 'pin' ? { ...x, pinned: undefined } : x;
        switch (a.action) {
          case 'hide':
            return { ...x, status: 'masked' as const, review: undefined, pinned: undefined };
          case 'show':
            return x.autoMasked ? x : { ...x, status: 'visible' as const };
          case 'pin':
            return { ...x, pinned: true, review: undefined };
          case 'unpin':
            return { ...x, pinned: undefined };
          case 'block':
            return { ...x, status: 'blocked' as const, review: undefined, pinned: undefined };
          case 'keep':
            return { ...x, review: undefined };
        }
      });
      if (a.action === 'show' && target.autoMasked) return failC('AUTO_MASKED', 'Un commentaire masqué par YA YO (numéro, lien) ne peut pas être réaffiché.');
      return okC({ ...c, comments: { ...c.comments, [a.postId]: next } }, `comment.${a.action}`);
    }

    case 'collection/save': {
      if (!ctx.shopId) return failC('NOT_SELLER', 'Ouvre ta boutique d’abord.');
      if (a.status === 'published') {
        const err = collectionError(a);
        if (err) return failC('INVALID', err);
      } else if (a.name.trim().length < 2) return failC('INVALID', 'Donne un nom à ta collection.');
      const existing = a.id ? c.collections[a.id] : undefined;
      if (a.id && (!existing || existing.shopId !== ctx.shopId)) return failC('NOT_FOUND', 'Collection introuvable.');
      const own = Object.values(c.collections).filter((x) => x.shopId === ctx.shopId);
      const col: Collection = {
        id: existing?.id ?? `COL-${c.seq + 100}`,
        shopId: ctx.shopId,
        name: a.name.trim(),
        description: a.description.trim(),
        cover: a.cover,
        productIds: a.productIds,
        status: a.status,
        position: existing?.position ?? own.length,
      };
      return okC({ ...c, seq: existing ? c.seq : c.seq + 1, collections: { ...c.collections, [col.id]: col } }, existing ? 'collection.updated' : 'collection.created', col.id);
    }
    case 'collection/delete': {
      const col = c.collections[a.id];
      if (!col || col.shopId !== ctx.shopId) return failC('NOT_FOUND', 'Collection introuvable.');
      const next = { ...c.collections };
      delete next[a.id];
      return okC({ ...c, collections: next }, 'collection.deleted');
    }
    case 'collection/move': {
      const own = Object.values(c.collections)
        .filter((x) => x.shopId === ctx.shopId)
        .sort((x, y) => x.position - y.position);
      const i = own.findIndex((x) => x.id === a.id);
      const j = i + a.by;
      if (i < 0 || j < 0 || j >= own.length) return okC(c);
      const order = [...own];
      [order[i], order[j]] = [order[j]!, order[i]!];
      const collections = { ...c.collections };
      order.forEach((x, k) => (collections[x.id] = { ...x, position: k }));
      return okC({ ...c, collections }, 'collection.moved');
    }
  }

  // Everything below is the seller managing their own contents.
  if (!ctx.shopId) return failC('NOT_SELLER', 'Ouvre ta boutique d’abord.');

  switch (a.type) {
    case 'content/save': {
      const existing = a.id ? mine(a.id) : undefined;
      if (a.id && !existing) return failC('NOT_FOUND', 'Publication introuvable.');
      if (a.mode !== 'draft') {
        // SV0b: only verified shops publish.
        if (!ctx.verified) return failC('NOT_VERIFIED', 'Termine ta vérification pour publier.');
        const err = draftError(a.draft, [...ctx.linkable, ...(existing?.productIds ?? [])]);
        if (err) return failC('INVALID', err);
      }
      if (a.mode === 'schedule') {
        const err = a.scheduledAt ? scheduleError(a.scheduledAt, a.at) : 'Choisis une date et une heure.';
        if (err) return failC('INVALID_SCHEDULE', err);
      }
      // SV2: numbers and payment links are masked in the caption.
      const caption = a.mode === 'draft' ? a.draft.caption : moderateText(a.draft.caption).text;
      const d = a.draft;
      const isLive = d.kind === 'live';
      const status: ContentStatus = a.mode === 'draft' ? 'draft' : a.mode === 'schedule' || isLive ? 'scheduled' : 'published';
      const item: ContentItem = {
        id: existing?.id ?? `C-${c.seq + 100}`,
        shopId: ctx.shopId,
        kind: d.kind,
        status,
        caption: isLive && d.live ? d.live.description : caption,
        media: d.media,
        video: d.video,
        poster: existing?.poster,
        productIds: d.productIds,
        allowComments: d.allowComments,
        allowShare: d.allowShare,
        buyButton: d.buyButton,
        createdAt: existing?.createdAt ?? a.at,
        updatedAt: a.at,
        publishedAt: status === 'published' ? (existing?.publishedAt ?? a.at) : undefined,
        scheduledAt: isLive ? d.live?.startsAt : a.mode === 'schedule' ? a.scheduledAt : undefined,
        expiresAt: d.kind === 'story' && status === 'published' ? addMs(a.at, STORY_TTL_MS) : undefined,
        live: isLive && d.live ? { ...d.live, title: d.live.title.trim(), state: 'scheduled' } : undefined,
        stats: existing?.stats ?? emptyStats(),
        perProduct: existing?.perProduct,
      };
      if (isLive && a.mode !== 'draft') {
        const err = d.live ? scheduleError(d.live.startsAt, a.at) : 'Choisis la date du live.';
        if (err) return failC('INVALID_SCHEDULE', err);
      }
      const next = put(item, `content.${status}`);
      return next.ok ? { ...next, content: { ...next.content, seq: existing ? c.seq : c.seq + 1 } } : next;
    }
    case 'content/duplicate': {
      const it = mine(a.id);
      if (!it) return failC('NOT_FOUND', 'Publication introuvable.');
      const copy: ContentItem = {
        ...it,
        id: `C-${c.seq + 100}`,
        status: 'draft',
        createdAt: a.at,
        updatedAt: a.at,
        publishedAt: undefined,
        scheduledAt: undefined,
        expiresAt: undefined,
        moderation: undefined,
        stats: emptyStats(),
        perProduct: undefined,
      };
      return okC({ ...c, seq: c.seq + 1, items: { ...c.items, [copy.id]: copy } }, 'content.duplicated', copy.id);
    }
    case 'content/unpublish': {
      const it = mine(a.id);
      if (!it) return failC('NOT_FOUND', 'Publication introuvable.');
      if (it.status === 'hidden') return failC('HIDDEN', 'Ce contenu est masqué par YA YO : modifie-le ou conteste.');
      return put({ ...it, status: 'draft', scheduledAt: undefined, updatedAt: a.at }, 'content.unpublished');
    }
    case 'content/delete': {
      const it = mine(a.id);
      if (!it) return failC('NOT_FOUND', 'Publication introuvable.');
      const items = { ...c.items };
      delete items[a.id];
      // Orders already placed from it are untouched (SV7).
      return okC({ ...c, items }, 'content.deleted');
    }
    case 'content/replaceProduct': {
      const it = mine(a.id);
      if (!it) return failC('NOT_FOUND', 'Publication introuvable.');
      if (!ctx.linkable.includes(a.to)) return failC('INVALID', 'Choisis un produit en ligne et en stock.');
      if (it.productIds.includes(a.to)) return failC('INVALID', 'Ce produit est déjà lié.');
      return put({ ...it, productIds: it.productIds.map((p) => (p === a.from ? a.to : p)), updatedAt: a.at }, 'content.product_replaced');
    }
    case 'content/appeal': {
      const it = mine(a.id);
      if (!it || it.status !== 'hidden' || !it.moderation) return failC('NOT_FOUND', 'Aucune modération à contester.');
      if (it.moderation.appeal?.status === 'pending') return failC('PENDING', 'Ta contestation est déjà en cours d’examen.');
      const message = a.message.trim();
      if (message.length < 10) return failC('INVALID', 'Explique en quelques mots pourquoi ce contenu respecte les règles.');
      if (message.length > MAX_APPEAL) return failC('INVALID', `${MAX_APPEAL} caractères au maximum.`);
      return put({ ...it, moderation: { ...it.moderation, appeal: { message, at: a.at, status: 'pending' } } }, 'content.appealed');
    }
    case 'content/demoReview': {
      const it = mine(a.id);
      if (!it?.moderation?.appeal || it.moderation.appeal.status !== 'pending') return failC('NOT_FOUND', 'Aucune contestation en cours.');
      const moderation = { ...it.moderation, appeal: { ...it.moderation.appeal, status: a.accept ? ('accepted' as const) : ('rejected' as const) } };
      // Accepted: back online with its statistics (SV9b).
      return put({ ...it, status: a.accept ? 'published' : 'hidden', moderation: a.accept ? undefined : moderation, updatedAt: a.at }, a.accept ? 'content.appeal_accepted' : 'content.appeal_rejected');
    }
    case 'content/resubmit': {
      const it = mine(a.id);
      if (!it || it.status !== 'hidden') return failC('NOT_FOUND', 'Publication introuvable.');
      const m = moderateText(a.caption);
      if (m.violations.length) return failC('STILL_INVALID', 'La légende contient encore un numéro, un lien ou un paiement hors YA YO.');
      return put({ ...it, caption: a.caption.trim(), status: 'published', moderation: undefined, updatedAt: a.at }, 'content.resubmitted');
    }
    case 'content/liveStart': {
      const it = mine(a.id);
      if (!it?.live || it.live.state !== 'scheduled') return failC('INVALID', 'Ce live ne peut pas démarrer.');
      if (!ctx.verified) return failC('NOT_VERIFIED', 'Termine ta vérification pour faire un live.');
      return put({ ...it, status: 'published', publishedAt: a.at, live: { ...it.live, state: 'live', startedAt: a.at, pinnedProductId: it.productIds[0] } }, 'live.started');
    }
    case 'content/livePin': {
      const it = mine(a.id);
      if (!it?.live || it.live.state !== 'live' || !it.productIds.includes(a.productId)) return failC('INVALID', 'Produit non présenté dans ce live.');
      return put({ ...it, live: { ...it.live, pinnedProductId: a.productId } }, 'live.pinned');
    }
    case 'content/liveEnd': {
      const it = mine(a.id);
      if (!it?.live || it.live.state !== 'live') return failC('INVALID', 'Ce live n’est pas en cours.');
      return put(
        {
          ...it,
          live: { ...it.live, state: 'ended', endedAt: a.at, peak: a.peak, viewers: a.viewers, orders: a.orders, salesAmount: a.salesAmount },
          stats: { ...it.stats, views: a.viewers, sales: a.orders, salesAmount: a.salesAmount },
        },
        'live.ended',
      );
    }
    case 'content/publishReplay': {
      const it = mine(a.id);
      if (!it?.live || it.live.state !== 'ended') return failC('INVALID', 'Le replay est disponible après le live.');
      const replay: ContentItem = {
        ...it,
        id: `C-${c.seq + 100}`,
        kind: 'video',
        status: 'published',
        caption: `Replay · ${it.live.title}`,
        live: undefined,
        publishedAt: a.at,
        createdAt: a.at,
        updatedAt: a.at,
      };
      return { ok: true, content: { ...c, seq: c.seq + 1, items: { ...c.items, [replay.id]: replay } }, event: 'live.replay_published', id: replay.id };
    }
  }
  return okC(c);
}
