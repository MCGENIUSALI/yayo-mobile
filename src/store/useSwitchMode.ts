import { router, type Href } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';
import type { AppMode } from '@/domain/state';
import { useStore } from './AppStore';

/**
 * Switches between the buyer and seller apps (V12 "Passer en mode acheteur").
 * The root navigator swaps the tab bar when the mode changes; the target
 * screen is opened once that switch is rendered.
 */
export function useSwitchMode() {
  const { state, dispatch } = useStore();
  const target = useRef<Href | null>(null);

  useEffect(() => {
    if (!target.current) return;
    const href = target.current;
    target.current = null;
    if (router.canDismiss()) router.dismissAll();
    router.replace(href);
  }, [state.mode]);

  return useCallback(
    (mode: AppMode, href: Href) => {
      if (mode === state.mode) {
        if (router.canDismiss()) router.dismissAll();
        router.replace(href);
        return;
      }
      target.current = href;
      dispatch({ type: 'app/setMode', mode });
    },
    [dispatch, state.mode],
  );
}
