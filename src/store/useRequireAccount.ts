import { router, type Href } from 'expo-router';
import { useCallback } from 'react';
import { useStore } from './AppStore';

/**
 * Guest browsing (no session): an action that needs an account opens the
 * sign-in, then resumes where the visitor was going once signed in.
 * Kept in memory only: an app killed during sign-in starts again from the feed.
 */
let pending: Href | undefined;

export function useRequireAccount() {
  const { state } = useStore();
  const signedIn = !!state.auth.session;
  return useCallback(
    (href: Href) => {
      if (signedIn) {
        router.push(href);
        return;
      }
      pending = href;
      router.push('/auth/connexion');
    },
    [signedIn],
  );
}

/** The destination left before signing in, read once. */
export function takePendingHref(): Href | undefined {
  const href = pending;
  pending = undefined;
  return href;
}

export function clearPendingHref() {
  pending = undefined;
}
