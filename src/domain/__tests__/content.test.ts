import { describe, expect, it } from '@jest/globals';
import { DEMO_PHONE_EXISTING, DEMO_PHONE_SELLER } from '../auth';
import { commentCount, feedPosts, MASKED_NUMBER, moderateText, newDraft, performance, scheduleError, statusAt, type ContentDraft } from '../content';
import { createInitialState, reducer, restoreState, STATE_VERSION, type Action, type AppState } from '../state';

const T0 = '2026-11-02T10:00:00.000Z';
const at = (s: number) => new Date(new Date(T0).getTime() + s * 1000).toISOString();
const run = (s: AppState, ...a: Action[]) => a.reduce(reducer, s);

function signIn(state: AppState, phone: string, t = 0): AppState {
  const s = run(state, { type: 'auth/onboarded' }, { type: 'auth/requestCode', kind: 'phone', target: phone, channel: 'sms', code: '123456', at: at(t) });
  return reducer(s, { type: 'auth/verifyCode', code: '123456', at: at(t + 5) });
}
/** Grâce, JBL Store Kin, in her seller app. */
const seller = () => reducer(signIn(createInitialState(T0), DEMO_PHONE_SELLER), { type: 'app/setMode', mode: 'seller', at: at(6) });

const video = (patch: Partial<ContentDraft> = {}): ContentDraft => ({ ...newDraft('video'), video: 'file:///clip.mp4', media: ['file:///cover.jpg'], caption: 'Le son en vrai', productIds: ['jbl-go-3'], ...patch });

describe('moderation', () => {
  it('masks phone numbers and links but keeps prices', () => {
    const m = moderateText('Appelle le 81 555 0101 ou va sur wa.me/24381 — 95 000 FC');
    expect(m.text).toContain(MASKED_NUMBER);
    expect(m.text).toContain('95 000 FC');
    expect(m.text).not.toContain('wa.me');
    expect(m.violations).toEqual(expect.arrayContaining(['phone', 'link']));
    expect(moderateText('Paye sur M-Pesa avant la livraison').violations).toContain('payment');
    expect(moderateText('Livré en 24 h à Ngaliema').violations).toEqual([]);
  });
});

describe('publishing (SV0–SV7)', () => {
  it('publishes a video with linked products into the buyer feed, caption masked', () => {
    let s = seller();
    s = reducer(s, { type: 'content/save', draft: video({ caption: 'Promo ! 0812345678' }), mode: 'publish', at: at(10) });
    expect(s.lastError).toBeUndefined();
    const item = Object.values(s.content.items).find((i) => i.createdAt === at(10))!;
    expect(item.status).toBe('published');
    expect(item.caption).toBe(`Promo ! ${MASKED_NUMBER}`);
    expect(feedPosts(s.content, at(11)).some((p) => p.id === item.id)).toBe(true);
  });

  it('only links online products in stock, 5 at most, and needs one', () => {
    const s = seller();
    const pub = (d: ContentDraft) => reducer(s, { type: 'content/save', draft: d, mode: 'publish', at: at(10) }).lastError?.message;
    expect(pub(video({ productIds: ['P-4'] }))).toMatch(/stock/); // Wave Buds: out of stock
    expect(pub(video({ productIds: ['P-5'] }))).toMatch(/stock/); // draft product
    expect(pub(video({ productIds: [] }))).toMatch(/Lie au moins/);
    expect(pub(video({ video: undefined }))).toMatch(/vidéo/);
  });

  it('refuses publishing from an unverified shop but keeps drafts', () => {
    let s = seller();
    const id = s.auth.session!.accountId;
    s = { ...s, seller: { ...s.seller, [id]: { ...s.seller[id]!, status: 'submitted' } } };
    expect(reducer(s, { type: 'content/save', draft: video(), mode: 'publish', at: at(10) }).lastError?.code).toBe('NOT_VERIFIED');
    expect(reducer(s, { type: 'content/save', draft: video(), mode: 'draft', at: at(10) }).lastError).toBeUndefined();
  });

  it('schedules between 15 minutes and 30 days, then goes live by itself', () => {
    expect(scheduleError(at(600), T0)).toMatch(/15 minutes/);
    expect(scheduleError(at(31 * 86400), T0)).toMatch(/30/);
    const s = reducer(seller(), { type: 'content/save', draft: video(), mode: 'schedule', scheduledAt: at(3600), at: at(10) });
    const item = Object.values(s.content.items).find((i) => i.createdAt === at(10))!;
    expect(item.status).toBe('scheduled');
    expect(feedPosts(s.content, at(20)).some((p) => p.id === item.id)).toBe(false);
    expect(statusAt(item, at(3601))).toBe('published');
  });

  it('duplicates, unpublishes, replaces an out-of-stock product and deletes', () => {
    let s = seller();
    s = reducer(s, { type: 'content/duplicate', id: 'P-go3', at: at(10) });
    const copy = Object.values(s.content.items).find((i) => i.createdAt === at(10))!;
    expect(copy).toMatchObject({ status: 'draft', stats: { views: 0 } });
    s = reducer(s, { type: 'content/replaceProduct', id: 'C-buds', from: 'P-4', to: 'P-3', at: at(11) });
    expect(s.content.items['C-buds']!.productIds).toEqual(['P-3']);
    s = reducer(s, { type: 'content/unpublish', id: 'P-go3', at: at(12) });
    expect(s.content.items['P-go3']!.status).toBe('draft');
    expect(feedPosts(s.content, at(13)).some((p) => p.id === 'P-go3')).toBe(false);
    s = reducer(s, { type: 'content/delete', id: copy.id, at: at(14) });
    expect(s.content.items[copy.id]).toBeUndefined();
  });

  it('never lets a seller touch another shop’s content', () => {
    const buyer = signIn(createInitialState(T0), DEMO_PHONE_EXISTING);
    expect(reducer(buyer, { type: 'content/delete', id: 'P-go3', at: at(10) }).lastError?.code).toBe('NOT_SELLER');
  });
});

describe('moderation by YA YO (SV9)', () => {
  it('lets the seller appeal or fix and resend a hidden content', () => {
    let s = seller();
    expect(reducer(s, { type: 'content/resubmit', id: 'C-hidden', caption: 'Appelez le 81 555 0101', at: at(10) }).lastError?.code).toBe('STILL_INVALID');
    const appealed = reducer(s, { type: 'content/appeal', id: 'C-hidden', message: 'C’est le numéro du service client JBL.', at: at(10) });
    expect(appealed.content.items['C-hidden']!.moderation?.appeal?.status).toBe('pending');
    const accepted = reducer(appealed, { type: 'content/demoReview', id: 'C-hidden', accept: true, at: at(20) });
    expect(accepted.content.items['C-hidden']).toMatchObject({ status: 'published', stats: { views: 3_100 } });
    s = reducer(s, { type: 'content/resubmit', id: 'C-hidden', caption: 'Go 3 à prix cassé, commande ici !', at: at(10) });
    expect(s.content.items['C-hidden']!.status).toBe('published');
  });
});

describe('comments (SC4, SV4, SV8)', () => {
  it('masks a number in a buyer comment and lets the seller moderate', () => {
    let s = signIn(createInitialState(T0), DEMO_PHONE_EXISTING);
    const before = commentCount(s.content, 'P-go3');
    s = run(s, { type: 'comment/add', postId: 'P-go3', text: 'Elle tient combien d’heures ?', at: at(10) }, { type: 'comment/add', postId: 'P-go3', text: 'Écris-moi au 0812345678', at: at(11) });
    const list = s.content.comments['P-go3']!;
    expect(list.at(-2)).toMatchObject({ author: 'Jean M.', status: 'visible', review: true });
    expect(list.at(-1)).toMatchObject({ status: 'masked', autoMasked: true, text: `Écris-moi au ${MASKED_NUMBER}` });
    expect(commentCount(s.content, 'P-go3')).toBe(before + 2);

    const question = list.at(-2)!.id;
    let g = signIn(run(s, { type: 'auth/signOut' } as Action), DEMO_PHONE_SELLER, 100);
    g = reducer(g, { type: 'app/setMode', mode: 'seller', at: at(110) });
    g = reducer(g, { type: 'comment/add', postId: 'P-go3', text: 'Jusqu’à 5 h.', replyTo: question, at: at(120) });
    const reply = g.content.comments['P-go3']!.at(-1)!;
    expect(reply).toMatchObject({ seller: true, author: 'JBL Store Kin' });
    expect(g.content.comments['P-go3']!.find((c) => c.id === question)!.review).toBeUndefined();
    const masked = list.at(-1)!.id;
    expect(reducer(g, { type: 'comment/moderate', postId: 'P-go3', commentId: masked, action: 'show', at: at(121) }).lastError?.code).toBe('AUTO_MASKED');
    g = reducer(g, { type: 'comment/moderate', postId: 'P-go3', commentId: masked, action: 'block', at: at(122) });
    expect(g.content.comments['P-go3']!.filter((c) => c.authorId === 'U-1').every((c) => c.status === 'blocked')).toBe(true);
    // The blocked buyer can no longer comment on this post.
    const back = signIn(run(g, { type: 'auth/signOut' } as Action), DEMO_PHONE_EXISTING, 200);
    expect(reducer(back, { type: 'comment/add', postId: 'P-go3', text: 'Bonjour', at: at(210) }).lastError?.code).toBe('BLOCKED');
  });

  it('sends a reported comment to the seller queue, never one’s own', () => {
    let s = signIn(createInitialState(T0), DEMO_PHONE_EXISTING);
    s = reducer(s, { type: 'comment/report', postId: 'P-pulse', commentId: 'CM-3', at: at(10) });
    expect(s.content.comments['P-pulse']!.find((c) => c.id === 'CM-3')!.review).toBe(true);
    s = reducer(s, { type: 'comment/add', postId: 'P-pulse', text: 'Super', at: at(11) });
    const mine = s.content.comments['P-pulse']!.at(-1)!.id;
    expect(reducer(s, { type: 'comment/report', postId: 'P-pulse', commentId: mine, at: at(12) }).lastError?.code).toBe('OWN_COMMENT');
    expect(reducer(createInitialState(T0), { type: 'comment/report', postId: 'P-pulse', commentId: 'CM-3', at: T0 }).lastError?.code).toBe('NOT_SIGNED_IN');
  });

  it('needs an account', () => {
    expect(reducer(createInitialState(T0), { type: 'comment/add', postId: 'P-go3', text: 'Bonjour', at: T0 }).lastError?.code).toBe('NOT_SIGNED_IN');
  });
});

describe('collections, stories and lives (SV12–SV18)', () => {
  it('creates, orders and validates collections', () => {
    let s = seller();
    expect(reducer(s, { type: 'collection/save', name: 'Petits prix', description: '', productIds: ['jbl-go-3'], status: 'published', at: at(10) }).lastError?.message).toMatch(/2 produits/);
    s = reducer(s, { type: 'collection/save', name: 'Petits prix', description: '', productIds: ['jbl-go-3', 'P-3'], status: 'published', at: at(10) });
    const created = Object.values(s.content.collections).find((c) => c.name === 'Petits prix')!;
    expect(created.position).toBe(3);
    s = reducer(s, { type: 'collection/move', id: created.id, by: -1, at: at(11) });
    expect(s.content.collections[created.id]!.position).toBe(2);
  });

  it('publishes a story for 24 h', () => {
    const s = reducer(seller(), { type: 'content/save', draft: { ...newDraft('story'), media: ['file:///s.jpg'], productIds: ['jbl-go-3'] }, mode: 'publish', at: at(10) });
    const story = Object.values(s.content.items).find((i) => i.kind === 'story')!;
    expect(statusAt(story, at(10 + 23 * 3600))).toBe('published');
    expect(statusAt(story, at(10 + 24 * 3600))).toBe('expired');
  });

  it('schedules, runs and ends a live, then publishes the replay', () => {
    let s = seller();
    const live = { ...newDraft('live'), productIds: ['jbl-go-3', 'P-3'], live: { title: 'Soirée JBL', description: 'Offres en direct', startsAt: at(7200), notify: true } };
    s = reducer(s, { type: 'content/save', draft: live, mode: 'publish', at: at(10) });
    const id = Object.values(s.content.items).find((i) => i.kind === 'live' && i.createdAt === at(10))!.id;
    expect(s.content.items[id]!.live?.state).toBe('scheduled');
    s = run(
      s,
      { type: 'content/liveStart', id, at: at(7200) },
      { type: 'content/livePin', id, productId: 'P-3', at: at(7300) },
      { type: 'content/liveEnd', id, peak: 312, viewers: 1_204, orders: 14, salesAmount: 1_680_000, at: at(10_000) },
      { type: 'content/publishReplay', id, at: at(10_010) },
    );
    expect(s.content.items[id]!.live).toMatchObject({ state: 'ended', pinnedProductId: 'P-3', orders: 14 });
    expect(Object.values(s.content.items).some((i) => i.caption === 'Replay · Soirée JBL' && i.status === 'published')).toBe(true);
  });
});

describe('performance (SV11) and saves (SC5–SC6)', () => {
  it('sums the contents published in the period', () => {
    const s = createInitialState(T0);
    const items = Object.values(s.content.items).filter((i) => i.shopId === 'jbl-store-kin');
    const all = performance(items, 'all', T0);
    expect(all.views).toBe(12_100 + 4_300 + 3_900 + 3_100);
    expect(performance(items, '7d', T0).top.map((i) => i.id)).toEqual(['P-go3', 'C-tune', 'C-buds']);
  });

  it('sorts saved posts into folders and hides reported posts', () => {
    let s = signIn(createInitialState(T0), DEMO_PHONE_EXISTING);
    s = run(s, { type: 'social/folder', postId: 'P-pulse', folder: 'Audio' }, { type: 'social/folder', postId: 'P-pulse', folder: 'Cadeaux' });
    expect(s.social.folders).toEqual({ Cadeaux: ['P-pulse'] });
    expect(s.social.saved).toContain('P-pulse');
    s = reducer(s, { type: 'social/report', postId: 'P-tune', at: at(10) });
    expect(s.social.hiddenPosts).toContain('P-tune');
  });

  it('migrates a v7 save', () => {
    const { content: _c, ...v7 } = { ...createInitialState(T0), version: 7 };
    const r = restoreState({ ...v7, social: { liked: [], saved: [], reposted: [], following: [], wishlist: [] } }, T0);
    expect(r.version).toBe(STATE_VERSION);
    expect(r.content.items['P-go3']).toBeDefined();
    expect(r.social.folders).toEqual({});
  });
});
