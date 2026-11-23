import { currentAccount } from '@/domain/auth';
import type { Action, AppState } from '@/domain/state';
import * as server from './serverContent';
import type { ContentWrite } from './serverContent';

/**
 * Mode serveur : ce que chaque action de contenu ou du fil social écrit dans
 * Supabase. L'écran applique d'abord l'action comme en démo (mêmes règles,
 * mêmes messages), puis la base enregistre et le fil est relu.
 *
 *  - `local`  : rien à écrire (vue, clic, « Pas intéressé », …).
 *  - `closed` : pas encore ouvert sur le serveur ; l'action n'est pas appliquée,
 *               pour ne rien montrer qui disparaîtrait ensuite.
 *  - `write`  : écrit sur le serveur, puis relit.
 */
export type SyncPlan = { kind: 'local' } | { kind: 'closed'; message: string } | { kind: 'write'; run: () => Promise<ContentWrite> };

const LOCAL: SyncPlan = { kind: 'local' };
const closed = (message: string): SyncPlan => ({ kind: 'closed', message });
const CLOSED_STORY_LIVE = 'Les stories et les lives arrivent bientôt sur YA YO.';
const CLOSED_COLLECTIONS = 'Les collections arrivent bientôt sur YA YO.';
const CLOSED_APPEAL = 'Pour contester, écris au support YA YO depuis Aide (Compte) : la contestation dans l’app arrive bientôt.';

export function isContentAction(a: Action): boolean {
  return a.type.startsWith('content/') || a.type.startsWith('comment/') || a.type.startsWith('collection/') || a.type.startsWith('social/');
}

/** `before` is the state the action is applied to. */
export function planContentSync(a: Action, before: AppState): SyncPlan {
  const acc = currentAccount(before.auth);
  const space = acc ? before.seller[acc.id] : undefined;
  const item = (id: string) => before.content.items[id];

  switch (a.type) {
    case 'content/track':
    case 'social/hidePost':
      return LOCAL;

    case 'collection/save':
    case 'collection/delete':
    case 'collection/move':
      return closed(CLOSED_COLLECTIONS);

    case 'content/liveStart':
    case 'content/livePin':
    case 'content/liveEnd':
    case 'content/publishReplay':
      return closed(CLOSED_STORY_LIVE);

    case 'content/appeal':
    case 'content/resubmit':
    case 'content/demoReview':
      return closed(CLOSED_APPEAL);

    case 'content/save': {
      if (a.draft.kind === 'story' || a.draft.kind === 'live') return closed(CLOSED_STORY_LIVE);
      if (!acc || !space?.shopId) return LOCAL;
      const shopId = space.shopId;
      return { kind: 'write', run: () => server.savePost({ accountId: acc.id, shopId, postId: a.id, draft: a.draft, mode: a.mode, scheduledAt: a.scheduledAt }) };
    }
    case 'content/duplicate': {
      const it = item(a.id);
      if (!it || !space?.shopId) return LOCAL;
      const shopId = space.shopId;
      return { kind: 'write', run: () => server.duplicatePost(it, shopId) };
    }
    case 'content/unpublish':
      return { kind: 'write', run: () => server.unpublishPost(a.id) };
    case 'content/delete': {
      const it = item(a.id);
      if (it && (it.kind === 'story' || it.kind === 'live')) return closed(CLOSED_STORY_LIVE);
      return { kind: 'write', run: () => server.deletePost(a.id) };
    }
    case 'content/replaceProduct': {
      const it = item(a.id);
      return it ? { kind: 'write', run: () => server.replacePostProduct(it, a.from, a.to) } : LOCAL;
    }

    case 'comment/add':
      return acc ? { kind: 'write', run: () => server.addComment(acc.id, a.postId, a.text, a.replyTo) } : LOCAL;
    case 'comment/report':
      return acc ? { kind: 'write', run: () => server.report(acc.id, { commentId: a.commentId }) } : LOCAL;
    case 'comment/moderate': {
      if (a.action === 'keep') return LOCAL;
      if (a.action === 'block') return closed('Bloquer un client arrive bientôt : masque son commentaire en attendant.');
      const action = a.action;
      return { kind: 'write', run: () => server.moderateComment(a.commentId, action) };
    }

    case 'social/toggle': {
      if (!acc || a.list === 'reposted' || a.list === 'wishlist') return LOCAL;
      const on = !before.social[a.list].includes(a.id);
      if (a.list === 'liked') return { kind: 'write', run: () => server.setLike(acc.id, a.id, on) };
      if (a.list === 'saved') return { kind: 'write', run: () => server.setSave(acc.id, a.id, on) };
      return { kind: 'write', run: () => server.setFollow(acc.id, a.id, on) };
    }
    case 'social/folder': {
      if (!acc) return LOCAL;
      const wasSaved = before.social.saved.includes(a.postId);
      const folder = a.folder?.trim() || null;
      return {
        kind: 'write',
        run: async () => {
          if (!wasSaved && folder) {
            const r = await server.setSave(acc.id, a.postId, true);
            if (!r.ok) return r;
          }
          return server.setSaveFolder(acc.id, a.postId, folder);
        },
      };
    }
    case 'social/report':
      return acc && !before.social.reported.includes(a.postId) ? { kind: 'write', run: () => server.report(acc.id, { postId: a.postId }) } : LOCAL;
  }
  return LOCAL;
}
