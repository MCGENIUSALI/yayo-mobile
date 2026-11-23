import { describe, expect, it } from '@jest/globals';
import { DEMO_PHONE_EXISTING } from '../auth';
import { getProduct, getShop } from '../catalog';
import { followingFeed, formatCount, posts, videoPosts } from '../feed';
import { createInitialState, reducer, socialCount, type Action, type AppState } from '../state';

const T0 = '2026-11-02T10:00:00.000Z';
/** Jean Mukendi, signed in just before T0 (buying needs an account since A9). */
function buyer(): AppState {
  const t = (s: number) => new Date(new Date(T0).getTime() + s * 1000).toISOString();
  let s = reducer(createInitialState(T0), { type: 'auth/onboarded' });
  s = reducer(s, { type: 'auth/requestCode', kind: 'phone', target: DEMO_PHONE_EXISTING, channel: 'sms', code: '123456', at: t(-20) });
  return reducer(s, { type: 'auth/verifyCode', code: '123456', at: t(-15) });
}

const run = (s: AppState, ...a: Action[]) => a.reduce(reducer, s);
const toggle = (list: 'liked' | 'saved' | 'reposted' | 'following', id: string): Action => ({ type: 'social/toggle', list, id, at: T0 });

describe('feed content', () => {
  it('only references existing shops and products', () => {
    for (const p of posts) {
      expect(getShop(p.shopId).id).toBe(p.shopId);
      expect(p.productIds.length).toBeGreaterThan(0);
      for (const id of p.productIds) expect(getProduct(id).id).toBe(id);
      if (p.kind === 'video') expect(p.video).toBeDefined();
    }
    expect(videoPosts.every((p) => p.kind === 'video')).toBe(true);
  });

  it('formats counters like Figma', () => {
    expect(formatCount(86)).toBe('86');
    expect(formatCount(1_100)).toBe('1,1 k');
    expect(formatCount(12_400)).toBe('12,4 k');
    expect(formatCount(2_000)).toBe('2 k');
    expect(formatCount(1_250_000)).toBe('1,3 M');
  });
});

describe('social state', () => {
  it('toggles like on and off, and the count follows', () => {
    const s0 = buyer();
    const post = posts[0]!;
    const s1 = run(s0, toggle('liked', post.id));
    expect(s1.social.liked).toEqual([post.id]);
    expect(socialCount(post.likes, s1.social.liked.includes(post.id))).toBe(post.likes + 1);
    const s2 = run(s1, toggle('liked', post.id));
    expect(s2.social.liked).toEqual([]);
    expect(socialCount(post.likes, s2.social.liked.includes(post.id))).toBe(post.likes);
  });

  it('keeps lists independent and logs buyer events', () => {
    const s = run(buyer(), toggle('saved', 'P-go3'), toggle('reposted', 'P-go3'));
    expect(s.social.saved).toEqual(['P-go3']);
    expect(s.social.reposted).toEqual(['P-go3']);
    expect(s.social.liked).toEqual([]);
    expect(s.events.at(-1)?.type).toBe('social.reposted.on');
  });

  it('builds the Abonnements tab from followed shops, newest first', () => {
    const s0 = buyer();
    expect(followingFeed(videoPosts, s0.social.following)).toEqual([]);
    const s1 = run(s0, toggle('following', 'audio-plus-gombe'), toggle('following', 'bilokos2kin'));
    expect(followingFeed(videoPosts, s1.social.following).map((p) => p.id)).toEqual(['P-pulse', 'P-tune']);
    const s2 = run(s1, toggle('following', 'bilokos2kin'));
    expect(followingFeed(videoPosts, s2.social.following).map((p) => p.id)).toEqual(['P-tune']);
  });

  it('quick buy from a video goes through the same stock rules as the product page', () => {
    const s0 = buyer();
    const s1 = run(s0, { type: 'cart/add', productId: 'jbl-pulse-5', color: 'Noir', qty: 2, at: T0 });
    expect(s1.cart.find((l) => l.productId === 'jbl-pulse-5')?.qty).toBe(2);
    const s2 = run(s1, { type: 'cart/add', productId: 'jbl-pulse-5', color: 'Noir', qty: 8, at: T0 });
    expect(s2.lastError?.code).toBe('STOCK_LIMIT');
    expect(s2.cart).toBe(s1.cart);
  });
});
