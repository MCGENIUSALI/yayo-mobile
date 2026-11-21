import { describe, expect, it, jest } from '@jest/globals';
import { createInitialState, reducer } from '@/domain/state';
import { planContentSync } from '../contentSync';
import { savePost, toComments, toContentItem, type CommentRow, type PostRow } from '../serverContent';

jest.mock('@/lib/supabase', () => ({ supabase: null, isServerMode: () => false }));

const AT = '2026-11-21T10:00:00.000Z';
const url = (p: string) => `https://x.supabase.co/storage/v1/object/public/media/${p}`;

const row: PostRow = {
  id: 'p1',
  shop_id: 's1',
  kind: 'photo',
  caption: 'Nouvelle robe wax',
  media_paths: ['u1/posts/a-0.jpg', 'u1/posts/a-1.jpg'],
  video_path: null,
  poster_path: null,
  status: 'published',
  publish_at: null,
  masked_reason: null,
  buy_button: true,
  comments_enabled: true,
  created_at: AT,
  post_products: [
    { product_id: 'pr2', position: 1 },
    { product_id: 'pr1', position: 0 },
  ],
};

describe('serverContent mapping', () => {
  it('a photo post becomes a carousel content with its products in order', () => {
    const it = toContentItem(row, { post_id: 'p1', likes: 3, comments: 1, saves: 2 }, { liked: true, saved: false }, url);
    expect(it).toMatchObject({ id: 'p1', shopId: 's1', kind: 'photos', status: 'published', publishedAt: AT, productIds: ['pr1', 'pr2'] });
    expect(it.media).toEqual([url('u1/posts/a-0.jpg'), url('u1/posts/a-1.jpg')]);
    // The buyer's own like is added back by the screens.
    expect(it.stats).toMatchObject({ likes: 2, saves: 2, views: 0, sales: 0 });
  });

  it('a post masked by YA YO is « Masqué » for its shop, archived is a draft', () => {
    expect(toContentItem({ ...row, status: 'masked', masked_reason: 'Coordonnées dans la légende' }, undefined, { liked: false, saved: false }, url)).toMatchObject({
      status: 'hidden',
      moderation: { reason: 'Coordonnées dans la légende' },
    });
    expect(toContentItem({ ...row, status: 'archived' }, undefined, { liked: false, saved: false }, url).status).toBe('draft');
    expect(toContentItem({ ...row, status: 'scheduled', publish_at: '2026-11-22T08:00:00.000Z' }, undefined, { liked: false, saved: false }, url).scheduledAt).toBe('2026-11-22T08:00:00.000Z');
  });

  it('comments: shop replies carry the badge, unanswered buyer comments wait for moderation', () => {
    const base: CommentRow = { id: 'c1', post_id: 'p1', reply_to: null, text: 'Il reste du M ?', status: 'visible', auto_masked: false, pinned: false, created_at: AT, mine: false, seller: false, author: 'Jean M.' };
    const list = toComments(
      [base, { ...base, id: 'c2', reply_to: 'c1', text: 'Oui !', seller: true, author: 'Maison Lisanga' }, { ...base, id: 'c3', mine: true, author: null }],
      'me',
    );
    expect(list[0]).toMatchObject({ author: 'Jean M.', review: undefined });
    expect(list[1]).toMatchObject({ seller: true, author: 'Maison Lisanga', replyTo: 'c1' });
    expect(list[2]).toMatchObject({ authorId: 'me', author: 'Client YA YO', review: true });
  });
});

describe('savePost', () => {
  it('stories and lives are not written to the server', async () => {
    const r = await savePost({ accountId: 'u1', shopId: 's1', draft: { kind: 'story', caption: '', media: ['file:///a.jpg'], productIds: [], allowComments: true, allowShare: true, buyButton: true }, mode: 'publish' }, {} as never);
    expect(r).toMatchObject({ ok: false, code: 'NOT_OPEN' });
  });

  it('a demo picture (bundled image) is refused before anything is written', async () => {
    const from = jest.fn();
    const r = await savePost({ accountId: 'u1', shopId: 's1', draft: { kind: 'photos', caption: 'x', media: [12], productIds: ['pr1'], allowComments: true, allowShare: true, buyButton: true }, mode: 'publish' }, { from } as never);
    expect(r).toMatchObject({ ok: false, code: 'DEMO_PHOTO' });
    expect(from).not.toHaveBeenCalled();
  });

  it('photos already online keep their path, products are linked in order', async () => {
    const inserts: unknown[] = [];
    const db = {
      from: (table: string) => ({
        insert: (v: unknown) => {
          inserts.push([table, v]);
          return table === 'posts' ? { select: () => ({ single: async () => ({ data: { id: 'p9' }, error: null }) }) } : Promise.resolve({ error: null });
        },
      }),
    } as never;
    const r = await savePost(
      { accountId: 'u1', shopId: 's1', draft: { kind: 'photos', caption: ' Robe ', media: [url('u1/posts/a-0.jpg')], productIds: ['pr2', 'pr1'], allowComments: false, allowShare: true, buyButton: true }, mode: 'publish' },
      db,
    );
    expect(r).toEqual({ ok: true });
    expect(inserts[0]).toEqual(['posts', expect.objectContaining({ shop_id: 's1', kind: 'photo', caption: 'Robe', media_paths: ['u1/posts/a-0.jpg'], status: 'published', comments_enabled: false })]);
    expect(inserts[1]).toEqual([
      'post_products',
      [
        { post_id: 'p9', product_id: 'pr2', position: 0 },
        { post_id: 'p9', product_id: 'pr1', position: 1 },
      ],
    ]);
  });
});

describe('content sync plan', () => {
  const s = createInitialState(AT);

  it('views and « Pas intéressé » stay on the phone; collections and lives are not open yet', () => {
    expect(planContentSync({ type: 'content/track', postId: 'p1', metric: 'view', at: AT }, s).kind).toBe('local');
    expect(planContentSync({ type: 'social/hidePost', postId: 'p1' }, s).kind).toBe('local');
    expect(planContentSync({ type: 'collection/delete', id: 'x', at: AT }, s).kind).toBe('closed');
    expect(planContentSync({ type: 'content/liveStart', id: 'x', at: AT }, s).kind).toBe('closed');
  });

  it('without an account nothing is written', () => {
    expect(planContentSync({ type: 'social/toggle', list: 'liked', id: 'p1', at: AT }, s).kind).toBe('local');
    expect(planContentSync({ type: 'comment/add', postId: 'p1', text: 'Bonjour', at: AT }, s).kind).toBe('local');
  });
});

describe('contentServer/loaded', () => {
  it('replaces posts, comments and the account follows, likes and saves', () => {
    const s = createInitialState(AT);
    const item = toContentItem(row, undefined, { liked: false, saved: false }, url);
    const next = reducer(s, {
      type: 'contentServer/loaded',
      content: { items: { p1: item }, collections: {}, comments: {} },
      social: { following: ['s1'], liked: ['p1'], saved: [], folders: {} },
      at: AT,
    });
    expect(Object.keys(next.content.items)).toEqual(['p1']);
    expect(next.content.seq).toBe(s.content.seq);
    expect(next.social).toMatchObject({ following: ['s1'], liked: ['p1'], saved: [], hiddenPosts: s.social.hiddenPosts });
    // A guest: nothing followed or liked.
    const guest = reducer(next, { type: 'contentServer/loaded', content: { items: {}, collections: {}, comments: {} }, at: AT });
    expect(guest.social.following).toEqual([]);
  });
});
