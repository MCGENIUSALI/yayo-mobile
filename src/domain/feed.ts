import type { Post } from './types';

/**
 * Demo social-commerce content (Figma SC1 · Fil vidéo « Pour toi », SC3 · Fil
 * photos des boutiques suivies, B1 · Fil des boutiques). Clips are short,
 * silent loops generated from the catalogue visuals (see scripts/feed-videos).
 */
export const posts: Post[] = [
  {
    id: 'P-pulse',
    kind: 'video',
    shopId: 'bilokos2kin',
    caption: 'Le son 360° de la JBL Pulse en vrai 🔊 Livrée en 24 h à Kinshasa, paiement protégé YA YO.',
    video: require('../../assets/feed/pulse.mp4') as number,
    media: [require('../../assets/feed/pulse.jpg') as number],
    poster: require('../../assets/feed/pulse-poster.jpg') as number,
    productIds: ['jbl-pulse-5'],
    likes: 12_400,
    comments: 328,
    saves: 1_100,
    reposts: 86,
    createdAt: '2026-11-02T08:30:00.000Z',
  },
  {
    id: 'P-go3',
    kind: 'video',
    shopId: 'jbl-store-kin',
    caption: 'La Go 3 tient dans la poche et résiste à l’eau. Jaune, bleu ou noir, -19 % cette semaine.',
    video: require('../../assets/feed/go-3.mp4') as number,
    media: [require('../../assets/products/jbl-go-3.jpg') as number],
    poster: require('../../assets/feed/go-3-poster.jpg') as number,
    productIds: ['jbl-go-3', 'jbl-charge-5'],
    likes: 5_630,
    comments: 142,
    saves: 610,
    reposts: 37,
    createdAt: '2026-11-01T17:10:00.000Z',
  },
  {
    id: 'P-tune',
    kind: 'video',
    shopId: 'audio-plus-gombe',
    caption: '40 h d’autonomie pour le trajet Gombe–Ndjili et retour. Le Tune 510 est de retour en stock.',
    video: require('../../assets/feed/tune-510.mp4') as number,
    media: [require('../../assets/products/jbl-tune-510.jpg') as number],
    poster: require('../../assets/feed/tune-510-poster.jpg') as number,
    productIds: ['jbl-tune-510'],
    likes: 2_210,
    comments: 61,
    saves: 304,
    reposts: 12,
    createdAt: '2026-10-31T12:45:00.000Z',
  },
  {
    id: 'P-veste',
    kind: 'photo',
    shopId: 'mama-luka-mode',
    caption: 'Nouvel arrivage : veste en jean brut, col velours. Pièces uniques, essayage à la livraison.',
    media: [require('../../assets/feed/veste-jean.jpg') as number],
    productIds: ['veste-jean-brut'],
    likes: 12_400,
    comments: 2_100,
    saves: 5_600,
    reposts: 210,
    createdAt: '2026-11-02T10:05:00.000Z',
  },
];

export const videoPosts = posts.filter((p) => p.kind === 'video');

export function getPost(id: string): Post | undefined {
  return posts.find((p) => p.id === id);
}

/** "Abonnements" tab: only shops the buyer follows, newest first. */
export function followingFeed(all: Post[], following: readonly string[]): Post[] {
  return all.filter((p) => following.includes(p.shopId)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Social counter as in Figma: 86, 1,1 k, 12,4 k, 1,2 M. */
export function formatCount(n: number): string {
  const fmt = (v: number) => (Math.round(v * 10) / 10).toString().replace('.', ',');
  if (n >= 1_000_000) return `${fmt(n / 1_000_000)} M`;
  if (n >= 1_000) return `${fmt(n / 1_000)} k`;
  return String(n);
}
