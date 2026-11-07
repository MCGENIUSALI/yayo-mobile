import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useState, type ReactNode } from 'react';
import { AppState as RNAppState } from 'react-native';
import { decidePayment } from '@/domain/paymentProvider';
import { createInitialState, reducer, restoreState, type Action, type AppState } from '@/domain/state';

const STORAGE_KEY = 'yayo/demo-state';

/** Actions as dispatched by screens: the store stamps the time unless one is given. */
type Timed<A> = A extends { at: string } ? Omit<A, 'at'> & { at?: string } : A;
export type StoreAction = Timed<Action>;

interface Store {
  state: AppState;
  dispatch: (action: StoreAction) => void;
}

const StoreContext = createContext<Store | null>(null);

type Boot = { phase: 'loading' } | { phase: 'ready'; initial: AppState };

/** Loads the persisted demo session, then renders the app. */
export function AppStoreProvider({ children, fallback }: { children: ReactNode; fallback: ReactNode }) {
  const [boot, setBoot] = useState<Boot>({ phase: 'loading' });
  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        const initial = restoreState(raw ? JSON.parse(raw) : null, new Date().toISOString());
        if (!cancelled) setBoot({ phase: 'ready', initial });
      })
      .catch(() => {
        // Corrupted storage must never block the app: start a clean demo session.
        if (!cancelled) setBoot({ phase: 'ready', initial: createInitialState(new Date().toISOString()) });
      });
    return () => {
      cancelled = true;
    };
  }, []);
  if (boot.phase === 'loading') return <>{fallback}</>;
  return <StoreRuntime initial={boot.initial}>{children}</StoreRuntime>;
}

function StoreRuntime({ initial, children }: { initial: AppState; children: ReactNode }) {
  const [state, rawDispatch] = useReducer(reducer, initial);

  const dispatch = useCallback((action: StoreAction) => {
    rawDispatch({ ...action, at: (action as { at?: string }).at ?? new Date().toISOString() } as Action);
  }, []);

  usePersistence(state);
  useSessionCheck(rawDispatch);
  usePaymentProvider(state, rawDispatch);
  useRefundProvider(state, rawDispatch);
  useSupportAgent(state, rawDispatch);

  const value = useMemo(() => ({ state, dispatch }), [state, dispatch]);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

function usePersistence(state: AppState) {
  useEffect(() => {
    // Debounced: a burst of actions results in one write.
    const t = setTimeout(() => {
      const { lastError: _ignored, ...persisted } = state;
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(persisted)).catch(() => undefined);
    }, 250);
    return () => clearTimeout(t);
  }, [state]);
}

/**
 * Simulated payment provider, owned by the store (not by a screen) so that
 * leaving C4, backgrounding or restarting the app never loses a payment.
 * On restore, an overdue result is applied immediately.
 */
function usePaymentProvider(state: AppState, dispatch: (a: Action) => void) {
  const ck = state.activeCheckoutId ? state.checkouts[state.activeCheckoutId] : undefined;
  const pendingKey = ck?.status === 'pending' ? `${ck.id}#${ck.attempt}` : null;
  const [foregroundTick, setForegroundTick] = useState(0);

  useEffect(() => {
    const sub = RNAppState.addEventListener('change', (s) => {
      if (s === 'active') setForegroundTick((n) => n + 1);
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!ck || ck.status !== 'pending' || !ck.requestedAt || !ck.expiresAt) return;
    const { id, attempt } = ck;
    const decision = decidePayment(ck.method, ck.msisdn);
    const now = Date.now();
    const timers: ReturnType<typeof setTimeout>[] = [];

    const expireIn = new Date(ck.expiresAt).getTime() - now;
    timers.push(
      setTimeout(
        () => dispatch({ type: 'checkout/providerResult', checkoutId: id, attempt, outcome: 'expired', at: new Date().toISOString() }),
        Math.max(0, expireIn),
      ),
    );
    if (decision.outcome !== 'no_answer') {
      const outcome = decision.outcome;
      const dueIn = new Date(ck.requestedAt).getTime() + decision.delayMs - now;
      timers.push(
        setTimeout(
          () => dispatch({ type: 'checkout/providerResult', checkoutId: id, attempt, outcome, at: new Date().toISOString() }),
          Math.max(0, Math.min(dueIn, expireIn)),
        ),
      );
    }
    return () => timers.forEach(clearTimeout);
    // pendingKey captures id + attempt + status; the reducer also drops stale results.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingKey, foregroundTick, dispatch]);
}

/** Simulated operator: a refund sent by YA YO (D19) reaches the buyer's account a few seconds later. */
export const DEMO_REFUND_DELAY_MS = 6_000;

function useRefundProvider(state: AppState, dispatch: (a: Action) => void) {
  const pending = Object.values(state.orders)
    .filter((o) => o.cancellation?.refund === 'sent')
    .map((o) => `${o.id}@${o.cancellation!.at}`)
    .join(',');
  useEffect(() => {
    if (!pending) return;
    const timers = pending.split(',').map((key) => {
      const [orderId = '', at = ''] = key.split('@');
      const dueIn = new Date(at).getTime() + DEMO_REFUND_DELAY_MS - Date.now();
      return setTimeout(() => dispatch({ type: 'order/refundReceived', orderId, at: new Date().toISOString() }), Math.max(0, dueIn));
    });
    return () => timers.forEach(clearTimeout);
  }, [pending, dispatch]);
}

/** Demo only: the support agent acknowledges each new message (D17). A real agent answers from the support back-office. */
function useSupportAgent(state: AppState, dispatch: (a: Action) => void) {
  const me = state.auth.session?.accountId;
  const thread = me ? state.support[me] : undefined;
  const last = thread?.at(-1);
  const waiting = last?.from === 'me' ? last.id : null;
  useEffect(() => {
    if (!waiting) return;
    const t = setTimeout(
      () =>
        dispatch({
          type: 'support/agentReply',
          text: 'Bien reçu, merci. Je regarde ta demande et je te réponds ici. Tu recevras aussi une notification.',
          at: new Date().toISOString(),
        }),
      2_500,
    );
    return () => clearTimeout(t);
  }, [waiting, dispatch]);
}

/** Re-checks the session (idle/absolute expiry, suspension) at launch and on each return to the foreground. */
function useSessionCheck(dispatch: (a: Action) => void) {
  useEffect(() => {
    dispatch({ type: 'auth/touch', at: new Date().toISOString() });
    const sub = RNAppState.addEventListener('change', (s) => {
      if (s === 'active') dispatch({ type: 'auth/touch', at: new Date().toISOString() });
    });
    return () => sub.remove();
  }, [dispatch]);
}

export function useStore(): Store {
  const s = useContext(StoreContext);
  if (!s) throw new Error('useStore must be used inside <AppStoreProvider>');
  return s;
}
