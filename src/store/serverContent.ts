import type { SupabaseClient } from '@supabase/supabase-js';
import type { Comment, ContentDraft, ContentItem, ContentState, ContentStatus } from '@/domain/content';
import type { Photo } from '@/domain/seller';
import type { SocialState } from '@/domain/state';
import { supabase } from '@/lib/supabase';
import { mediaPath } from './serverSeller';

/**
 * Contenus et fil social en mode serveur (US-20 à US-27 : SC1 à SC6, SV1 à SV9).
 * Les écrans restent ceux du Figma ; seules les données viennent de Supabase.
 * La base applique les mêmes règles que l'app (RLS, masquage des numéros et
 * des liens, modération réservée à la boutique et à YA YO).
 */

export type ContentFailure = { ok: false; code: string; message: string };
export type ContentWrite = { ok: true } | ContentFailure;
const fail = (code: string, message: string): ContentFailure => ({ ok: false, code, message });
const NETWORK = fail('NETWORK', 'Pas de connexion au serveur YA YO. Vérifie ton réseau puis réessaie.');
const SERVER = fail('SERVER', 'Le serveur YA YO n’a pas pu enregistrer. Réessaie dans un instant.');
const DEMO_MEDIA = fail('DEMO_PHOTO', 'Choisis une photo ou une vidéo depuis ton téléphone (appareil photo ou galerie).');
const UPLOAD = fail('UPLOAD', 'Le fichier n’a pas pu être envoyé. Vérifie ton réseau puis réessaie.');
const OK: ContentWrite = { ok: true };

function client(c?: SupabaseClient | null): SupabaseClient {
  const x = c ?? supabase;
  if (!x) throw new Error('Supabase non configuré');
  return x;
}

/* ---------- Mapping ---------- */

export interface PostRow {
  id: string;
  shop_id: string;
  kind: 'video' | 'photo';
  caption: string;
  media_paths: string[];
  video_path: string | null;
  poster_path: string | null;
  status: 'draft' | 'scheduled' | 'published' | 'masked' | 'archived';
  publish_at: string | null;
  masked_reason: string | null;
  buy_button: boolean;
  comments_enabled: boolean;
  created_at: string;
  post_products: { product_id: string; position: number }[];
}

export interface CountRow {
  post_id: string;
  likes: number;
  comments: number;
  saves: number;
}

export interface CommentRow {
  id: string;
  post_id: string;
  reply_to: string | null;
  text: string;
  status: 'visible' | 'masked';
  auto_masked: boolean;
  pinned: boolean;
  created_at: string;
  mine: boolean;
  seller: boolean;
  author: string | null;
}

const APP_STATUS: Record<PostRow['status'], ContentStatus> = {
  draft: 'draft',
  archived: 'draft',
  scheduled: 'scheduled',
  published: 'published',
  masked: 'hidden',
};

/**
 * A post as the seller space and the feed use it. `mine` = the buyer's own
 * like / save, left out of the counts (the screens add it back, as in the demo).
 */
export function toContentItem(r: PostRow, counts: CountRow | undefined, mine: { liked: boolean; saved: boolean }, publicUrl: (path: string) => string): ContentItem {
  const status = APP_STATUS[r.status];
  const at = r.publish_at ?? r.created_at;
  return {
    id: r.id,
    shopId: r.shop_id,
    kind: r.kind === 'video' ? 'video' : 'photos',
    status,
    caption: r.caption,
    // A video's cover doubles as its image in the home feed card, as the demo clips do.
    media: r.media_paths.length ? r.media_paths.map(publicUrl) : r.poster_path ? [publicUrl(r.poster_path)] : [],
    video: r.video_path ? publicUrl(r.video_path) : undefined,
    poster: r.poster_path ? publicUrl(r.poster_path) : undefined,
    productIds: [...r.post_products].sort((a, b) => a.position - b.position).map((p) => p.product_id),
    allowComments: r.comments_enabled,
    allowShare: true,
    buyButton: r.buy_button,
    createdAt: r.created_at,
    updatedAt: r.created_at,
    publishedAt: status === 'published' ? at : undefined,
    scheduledAt: status === 'scheduled' ? (r.publish_at ?? undefined) : undefined,
    // Views, clicks and sales are not measured by the server yet: shown as 0, never invented.
    stats: {
      views: 0,
      likes: Math.max(0, (counts?.likes ?? 0) - (mine.liked ? 1 : 0)),
      productClicks: 0,
      sales: 0,
      salesAmount: 0,
      shares: 0,
      saves: Math.max(0, (counts?.saves ?? 0) - (mine.saved ? 1 : 0)),
    },
    moderation:
      status === 'hidden'
        ? { reason: r.masked_reason ?? 'Contenu masqué par la modération YA YO', detail: 'Contacte le support YA YO pour en savoir plus.', at: r.created_at }
        : undefined,
  };
}

/** Comments of one post. A buyer comment the shop has not answered yet waits in SV8 « À modérer ». */
export function toComments(rows: CommentRow[], accountId: string | undefined): Comment[] {
  const answered = new Set(rows.filter((r) => r.seller && r.reply_to).map((r) => r.reply_to!));
  return rows.map((r) => ({
    id: r.id,
    postId: r.post_id,
    author: r.author ?? 'Client YA YO',
    authorId: r.mine ? accountId : undefined,
    seller: r.seller || undefined,
    text: r.text,
    at: r.created_at,
    likes: 0,
    status: r.status,
    autoMasked: r.auto_masked || undefined,
    review: (!r.seller && (r.auto_masked || !answered.has(r.id))) || undefined,
    pinned: r.pinned || undefined,
    replyTo: r.reply_to ?? undefined,
  }));
}

export type LoadedContent = { content: Omit<ContentState, 'seq'>; social?: Pick<SocialState, 'following' | 'liked' | 'saved' | 'folders'> };

const POST_COLUMNS =
  'id, shop_id, kind, caption, media_paths, video_path, poster_path, status, publish_at, masked_reason, buy_button, comments_enabled, created_at, post_products(product_id, position)';
const COMMENT_COLUMNS = 'id, post_id, reply_to, text, status, auto_masked, pinned, created_at, mine, seller, author';

/** Every post the account may see (published ones, plus all of its own shop), their counts and comments. */
export async function loadContent(accountId: string | undefined, c?: SupabaseClient | null): Promise<LoadedContent> {
  const db = client(c);
  const [postsRes, likesRes, savesRes, followsRes] = await Promise.all([
    db.from('posts').select(POST_COLUMNS).order('created_at', { ascending: false }).limit(200),
    accountId ? db.from('post_likes').select('post_id').eq('user_id', accountId) : Promise.resolve({ data: [], error: null }),
    accountId ? db.from('post_saves').select('post_id, folder').eq('user_id', accountId) : Promise.resolve({ data: [], error: null }),
    accountId ? db.from('follows').select('shop_id').eq('user_id', accountId) : Promise.resolve({ data: [], error: null }),
  ]);
  for (const r of [postsRes, likesRes, savesRes, followsRes]) if (r.error) throw r.error;
  const rows = (postsRes.data ?? []) as unknown as PostRow[];
  const ids = rows.map((r) => r.id);
  const [countsRes, commentsRes] = ids.length
    ? await Promise.all([
        db.from('post_counts').select('post_id, likes, comments, saves').in('post_id', ids),
        db.from('comment_feed').select(COMMENT_COLUMNS).in('post_id', ids).order('created_at', { ascending: true }),
      ])
    : [
        { data: [], error: null },
        { data: [], error: null },
      ];
  if (countsRes.error) throw countsRes.error;
  if (commentsRes.error) throw commentsRes.error;

  const liked = ((likesRes.data ?? []) as { post_id: string }[]).map((x) => x.post_id);
  const saves = (savesRes.data ?? []) as { post_id: string; folder: string }[];
  const saved = saves.map((x) => x.post_id);
  const counts = new Map(((countsRes.data ?? []) as CountRow[]).map((x) => [x.post_id, x]));
  const publicUrl = (path: string) => db.storage.from('media').getPublicUrl(path).data.publicUrl;

  const items: ContentState['items'] = {};
  for (const r of rows) items[r.id] = toContentItem(r, counts.get(r.id), { liked: liked.includes(r.id), saved: saved.includes(r.id) }, publicUrl);
  const byPost = new Map<string, CommentRow[]>();
  for (const cm of (commentsRes.data ?? []) as CommentRow[]) byPost.set(cm.post_id, [...(byPost.get(cm.post_id) ?? []), cm]);
  const comments: ContentState['comments'] = {};
  for (const [postId, list] of byPost) comments[postId] = toComments(list, accountId);

  const content = { items, collections: {}, comments };
  if (!accountId) return { content };
  const folders: Record<string, string[]> = {};
  for (const s of saves) if (s.folder && s.folder !== 'Tous') folders[s.folder] = [...(folders[s.folder] ?? []), s.post_id];
  const following = ((followsRes.data ?? []) as { shop_id: string }[]).map((x) => x.shop_id);
  return { content, social: { following, liked, saved, folders } };
}

/* ---------- Files ---------- */

function contentType(uri: string, video: boolean): string {
  const ext = uri.split('?')[0]!.split('.').pop()?.toLowerCase();
  if (video) return ext === 'mov' ? 'video/quicktime' : 'video/mp4';
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  return 'image/jpeg';
}
const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'video/mp4': 'mp4', 'video/quicktime': 'mov' };

/** A file already on the server keeps its path; one picked on the phone is uploaded; demo files are refused. */
async function place(db: SupabaseClient, base: string, photo: Photo, video = false): Promise<string | ContentFailure> {
  const existing = mediaPath(photo);
  if (existing) return existing;
  if (typeof photo !== 'string') return DEMO_MEDIA;
  try {
    const res = await fetch(photo);
    const blobType = res.headers.get('content-type') ?? '';
    const type = blobType.startsWith(video ? 'video/' : 'image/') && EXT[blobType] ? blobType : contentType(photo, video);
    const body = await res.arrayBuffer();
    const path = `${base}.${EXT[type]}`;
    const { error } = await db.storage.from('media').upload(path, body, { contentType: type, upsert: true });
    return error ? UPLOAD : path;
  } catch {
    return UPLOAD;
  }
}

const isFailure = (x: unknown): x is ContentFailure => typeof x === 'object' && x !== null && (x as { ok?: boolean }).ok === false;
const stamp = () => Date.now().toString(36);

function rpcFailure(error: { code?: string; message?: string; hint?: string } | null): ContentFailure {
  if (!error) return SERVER;
  if (error.code === 'P0001' && error.message) return fail(error.hint || 'RULE', error.message);
  if (/fetch|network/i.test(error.message ?? '')) return NETWORK;
  return SERVER;
}

/* ---------- SV2, SV3, SV5 · Publier ---------- */

export interface SavePostInput {
  accountId: string;
  shopId: string;
  /** The post being edited (server id), if any. */
  postId?: string;
  draft: ContentDraft;
  mode: 'draft' | 'publish' | 'schedule';
  scheduledAt?: string;
  /** Video cover maker (tests); by default an image taken from the clip. */
  makeCover?: (videoUri: string) => Promise<string | null>;
}

const defaultCover = async (uri: string) => (await import('@/ui/videoCover')).videoCover(uri);

/** Photos (carousel) or a video, with their linked products in order. Stories and lives are not on the server yet. */
export async function savePost(input: SavePostInput, c?: SupabaseClient | null): Promise<ContentWrite> {
  const { draft: d } = input;
  if (d.kind !== 'video' && d.kind !== 'photos') return fail('NOT_OPEN', 'Les stories et les lives ne sont pas encore ouverts sur le serveur YA YO.');
  try {
    const db = client(c);
    const base = `${input.accountId}/posts/${stamp()}`;
    const media: string[] = [];
    for (const [i, m] of d.media.entries()) {
      const p = await place(db, `${base}-${i}`, m);
      if (isFailure(p)) return p;
      media.push(p);
    }
    let video: string | null = null;
    let poster: string | null | undefined;
    if (d.kind === 'video' && d.video !== undefined) {
      const v = await place(db, `${base}-video`, d.video, true);
      if (isFailure(v)) return v;
      video = v;
      // The home feed card (B1) shows a cover: taken from the clip when the seller gave none.
      // An edit keeps the cover already online; a cover that cannot be made never blocks the post.
      if (!d.media.length && typeof d.video === 'string' && !mediaPath(d.video)) {
        const cover = await (input.makeCover ?? defaultCover)(d.video);
        const up = cover ? await place(db, `${base}-cover`, cover) : null;
        poster = up && !isFailure(up) ? up : null;
      }
    }
    const status = input.mode === 'draft' ? 'draft' : input.mode === 'schedule' ? 'scheduled' : 'published';
    const row = {
      kind: d.kind === 'video' ? 'video' : 'photo',
      caption: d.caption.trim(),
      media_paths: media,
      video_path: video,
      status,
      publish_at: status === 'scheduled' ? (input.scheduledAt ?? null) : null,
      buy_button: d.buyButton,
      comments_enabled: d.allowComments,
      ...(poster !== undefined ? { poster_path: poster } : {}),
    };
    let postId = input.postId;
    if (postId) {
      const { error } = await db.from('posts').update(row).eq('id', postId);
      if (error) return rpcFailure(error);
      const del = await db.from('post_products').delete().eq('post_id', postId);
      if (del.error) return rpcFailure(del.error);
    } else {
      const { data, error } = await db.from('posts').insert({ ...row, shop_id: input.shopId }).select('id').single();
      if (error || !data) return rpcFailure(error);
      postId = (data as { id: string }).id;
    }
    if (d.productIds.length) {
      const { error } = await db.from('post_products').insert(d.productIds.map((product_id, position) => ({ post_id: postId, product_id, position })));
      if (error) return rpcFailure(error);
    }
    return OK;
  } catch {
    return NETWORK;
  }
}

/* ---------- SV1 · Actions sur une publication ---------- */

async function run(p: PromiseLike<{ error: { code?: string; message?: string; hint?: string } | null }>): Promise<ContentWrite> {
  try {
    const { error } = await p;
    return error ? rpcFailure(error) : OK;
  } catch {
    return NETWORK;
  }
}

export const deletePost = (postId: string, c?: SupabaseClient | null) => run(client(c).from('posts').delete().eq('id', postId));

export const unpublishPost = (postId: string, c?: SupabaseClient | null) =>
  run(client(c).from('posts').update({ status: 'draft', publish_at: null }).eq('id', postId));

/** Same photos or video, same products, as a new draft. */
export async function duplicatePost(item: ContentItem, shopId: string, c?: SupabaseClient | null): Promise<ContentWrite> {
  try {
    const db = client(c);
    const media = item.media.map(mediaPath);
    const video = item.video !== undefined ? mediaPath(item.video) : null;
    if (media.some((m) => !m)) return DEMO_MEDIA;
    const { data, error } = await db
      .from('posts')
      .insert({
        shop_id: shopId,
        kind: item.kind === 'video' ? 'video' : 'photo',
        caption: item.caption,
        media_paths: media,
        video_path: video,
        status: 'draft',
        buy_button: item.buyButton,
        comments_enabled: item.allowComments,
      })
      .select('id')
      .single();
    if (error || !data) return rpcFailure(error);
    const id = (data as { id: string }).id;
    if (!item.productIds.length) return OK;
    return run(db.from('post_products').insert(item.productIds.map((product_id, position) => ({ post_id: id, product_id, position }))));
  } catch {
    return NETWORK;
  }
}

/** SV7: a linked product out of stock is replaced by another, at the same place. */
export async function replacePostProduct(item: ContentItem, from: string, to: string, c?: SupabaseClient | null): Promise<ContentWrite> {
  try {
    const db = client(c);
    const position = Math.max(0, item.productIds.indexOf(from));
    const del = await db.from('post_products').delete().eq('post_id', item.id).eq('product_id', from);
    if (del.error) return rpcFailure(del.error);
    return run(db.from('post_products').insert({ post_id: item.id, product_id: to, position }));
  } catch {
    return NETWORK;
  }
}

/* ---------- SC3 à SC6 · Réactions des acheteurs ---------- */

export function setLike(accountId: string, postId: string, on: boolean, c?: SupabaseClient | null) {
  const t = client(c).from('post_likes');
  return run(on ? t.insert({ post_id: postId, user_id: accountId }) : t.delete().eq('post_id', postId).eq('user_id', accountId));
}

export function setSave(accountId: string, postId: string, on: boolean, c?: SupabaseClient | null) {
  const t = client(c).from('post_saves');
  return run(on ? t.insert({ post_id: postId, user_id: accountId }) : t.delete().eq('post_id', postId).eq('user_id', accountId));
}

/** SC6: a saved post moved to a folder (null = back to « Tous »). */
export const setSaveFolder = (accountId: string, postId: string, folder: string | null, c?: SupabaseClient | null) =>
  run(client(c).from('post_saves').update({ folder: folder ?? 'Tous' }).eq('post_id', postId).eq('user_id', accountId));

export function setFollow(accountId: string, shopId: string, on: boolean, c?: SupabaseClient | null) {
  const t = client(c).from('follows');
  return run(on ? t.insert({ user_id: accountId, shop_id: shopId }) : t.delete().eq('user_id', accountId).eq('shop_id', shopId));
}

/** SC4: written by the buyer or by the shop (reply). The base masks numbers and links. */
export const addComment = (accountId: string, postId: string, text: string, replyTo?: string, c?: SupabaseClient | null) =>
  run(client(c).from('comments').insert({ post_id: postId, author_id: accountId, text: text.trim(), reply_to: replyTo ?? null }));

/** SV4, SV8: hide, show, pin or unpin, checked by the base (only the shop, one pinned comment). */
export const moderateComment = (commentId: string, action: 'hide' | 'show' | 'pin' | 'unpin', c?: SupabaseClient | null) =>
  run(client(c).rpc('moderate_comment', { p_comment: commentId, p_action: action }));

/** SC4 « Signaler » (comment) and SC5 « Signaler la publication »: sent to the YA YO moderators. */
export const report = (accountId: string, target: { postId: string } | { commentId: string }, c?: SupabaseClient | null) =>
  run(
    client(c)
      .from('reports')
      .insert({
        reporter_id: accountId,
        post_id: 'postId' in target ? target.postId : null,
        comment_id: 'commentId' in target ? target.commentId : null,
        reason: 'postId' in target ? 'Publication signalée depuis le fil' : 'Commentaire signalé depuis le fil',
      }),
  );
