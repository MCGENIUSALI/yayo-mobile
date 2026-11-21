import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react';
import { AppState as RNAppState } from 'react-native';
import { decidePayment } from '@/domain/paymentProvider';
import { supabase } from '@/lib/supabase';
import { replaceCatalog } from '@/domain/catalog';
import { fetchCatalog } from './serverCatalog';
import { loadSellerSpace } from './serverSeller';
import { loadAddresses, loadOrders } from './serverOrders';
import { loadAccount, signOutServer } from './serverAuth';
import { loadContent } from './serverContent';
import { isContentAction, planContentSync } from './contentSync';
import { useToast } from '@/ui/Feedback';
import { createInitialState, reducer, restoreState, type Action, type AppState } from '@/domain/state';

const STORAGE_KEY = 'yayo/demo-state';

/** Actions as dispatched by screens: the store stamps the time unless one is given. */
type Timed<A> = A extends { at: string } ? Omit<A, 'at'> & { at?: string } : A;
export type StoreAction = Timed<Action>;

export type CatalogStatus = 'demo' | 'loading' | 'ready' | 'error';

interface Store {
  state: AppState;
  dispatch: (action: StoreAction) => void;
  /** Changes each time the catalogue is replaced (server mode), so screens reading it re-render. */
  catalog: { status: CatalogStatus; version: number; message?: string; reload: () => void };
  /** Server mode: re-reads the account's orders and addresses (after a write, or pull-to-refresh). Demo: no-op. */
  server: { reloadOrders: (activeCheckoutId?: string) => Promise<void>; reloadAddresses: (selectId?: string) => Promise<void> };
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
  const stateRef = useRef(state);
  const toast = useToast();
  const accountId = state.auth.session?.accountId;
  const catalog = useServerCatalog(rawDispatch);
  const reloadContent = useServerContent(accountId, catalog.version, rawDispatch);
  const sync = useRef({ toast, reloadContent });
  // Actions come from taps, after the commit: they always see the state on screen.
  useLayoutEffect(() => {
    stateRef.current = state;
    sync.current = { toast, reloadContent };
  });

  const dispatch = useCallback((action: StoreAction) => {
    // Server mode: leaving the app also closes the Supabase session.
    if (action.type === 'auth/signOut' && supabase) {
      signingOut = true;
      void signOutServer();
    }
    const timed = { ...action, at: (action as { at?: string }).at ?? new Date().toISOString() } as Action;
    if (supabase && isContentAction(timed)) {
      const before = stateRef.current;
      const plan = planContentSync(timed, before);
      // Shown after the screen's own confirmation, which it would otherwise cover.
      const later = (message: string) => setTimeout(() => sync.current.toast(message, 'danger'), 60);
      if (plan.kind === 'closed') return void later(plan.message);
      if (plan.kind === 'write') {
        // The app's rules answer first (same messages as the demo); only an accepted action is written.
        const next = reducer(before, timed);
        if (next.lastError && next.lastError.at === (timed as { at: string }).at && next.lastError !== before.lastError) return rawDispatch(timed);
        rawDispatch(timed);
        void plan.run().then((r) => {
          if (!r.ok) later(r.message);
          void sync.current.reloadContent();
        });
        return;
      }
    }
    rawDispatch(timed);
  }, []);

  usePersistence(state);
  useSessionCheck(rawDispatch);
  useServerSession(rawDispatch);
  usePaymentProvider(state, rawDispatch);
  useRefundProvider(state, rawDispatch);
  useSupportAgent(state, rawDispatch);

  useServerSellerSpace(accountId, rawDispatch);
  const server = useServerOrders(accountId, accountId ? state.seller[accountId]?.shopId : undefined, rawDispatch);
  const value = useMemo(() => ({ state, dispatch, catalog, server }), [state, dispatch, catalog, server]);
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

/**
 * Server mode: at launch, a Supabase session still open (app reinstalled, local
 * state cleared) signs the account back in; a session ended by the server
 * (refresh refused, account deleted) closes the local one.
 */
let signingOut = false;

function useServerSession(dispatch: (a: Action) => void) {
  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;
    void supabase.auth.getSession().then(async ({ data }) => {
      const userId = data.session?.user.id;
      if (cancelled || !userId) return;
      const account = await loadAccount(userId).catch(() => null);
      if (!cancelled && account) dispatch({ type: 'auth/serverRestored', account, at: new Date().toISOString() });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event !== 'SIGNED_OUT') return;
      // Asked by the user: already handled. Otherwise the server ended the session.
      if (signingOut) signingOut = false;
      else dispatch({ type: 'auth/signOut', reason: 'expired' });
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [dispatch]);
}

/**
 * Server mode: the demo catalogue is never shown. It is emptied before the first
 * render, then filled with the shops and products read from Supabase, at launch
 * and on each return to the foreground.
 */
if (supabase) replaceCatalog({ shops: {}, products: {} });

function useServerCatalog(dispatch: (a: Action) => void): Store['catalog'] {
  const [s, setS] = useState<{ status: CatalogStatus; version: number; message?: string }>({
    status: supabase ? 'loading' : 'demo',
    version: 0,
  });
  const [tick, setTick] = useState(0);
  const reload = useCallback(() => setTick((n) => n + 1), []);

  useEffect(() => {
    if (!supabase) return;
    const sub = RNAppState.addEventListener('change', (st) => {
      if (st === 'active') setTick((n) => n + 1);
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;
    void fetchCatalog().then((res) => {
      if (cancelled) return;
      if (!res.ok) {
        // Keeps what was already loaded; the screens say the catalogue could not be read.
        setS((prev) => ({ ...prev, status: prev.status === 'ready' ? 'ready' : 'error', message: res.message }));
        return;
      }
      const version = replaceCatalog(res);
      setS({ status: 'ready', version });
      dispatch({ type: 'catalog/loaded', at: new Date().toISOString() });
    });
    return () => {
      cancelled = true;
    };
  }, [tick, dispatch]);

  return useMemo(() => ({ ...s, reload }), [s, reload]);
}

/** Server mode: the signed-in account's seller space is read from Supabase (shop, documents sent, products). */
function useServerSellerSpace(accountId: string | undefined, dispatch: (a: Action) => void) {
  useEffect(() => {
    if (!supabase || !accountId) return;
    let cancelled = false;
    loadSellerSpace(accountId)
      .then((space) => {
        if (!cancelled) dispatch({ type: 'sellerServer/loaded', accountId, space, at: new Date().toISOString() });
      })
      // Offline: the space stays as last loaded; the next write reloads it.
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [accountId, dispatch]);
}

/**
 * Server mode: the account's addresses and orders (as buyer and as seller) are
 * read from Supabase once signed in, on each return to the foreground and after
 * each write. Offline, the last loaded copy stays on screen.
 */
function useServerOrders(accountId: string | undefined, shopId: string | undefined, dispatch: (a: Action) => void): Store['server'] {
  const reloadOrders = useCallback(
    async (activeCheckoutId?: string) => {
      if (!supabase || !accountId) return;
      const r = await loadOrders(accountId, shopId).catch(() => null);
      if (r) dispatch({ type: 'ordersServer/loaded', ...r, activeCheckoutId, at: new Date().toISOString() });
    },
    [accountId, shopId, dispatch],
  );
  const reloadAddresses = useCallback(
    async (selectId?: string) => {
      if (!supabase || !accountId) return;
      const book = await loadAddresses(accountId).catch(() => null);
      if (book) dispatch({ type: 'addressServer/loaded', accountId, book, selectId, at: new Date().toISOString() });
    },
    [accountId, dispatch],
  );

  useEffect(() => {
    if (!supabase || !accountId) return;
    void reloadAddresses();
    void reloadOrders();
    const sub = RNAppState.addEventListener('change', (st) => {
      if (st === 'active') void reloadOrders();
    });
    return () => sub.remove();
  }, [accountId, reloadAddresses, reloadOrders]);

  return useMemo(() => ({ reloadOrders, reloadAddresses }), [reloadOrders, reloadAddresses]);
}

/**
 * Server mode: posts, comments and the account's follows, likes and saves, read
 * from Supabase at launch, at sign-in, each time the catalogue is re-read (return
 * to the foreground) and after each write. Offline, the last loaded copy stays.
 */
function useServerContent(accountId: string | undefined, catalogVersion: number, dispatch: (a: Action) => void) {
  const latest = useRef(0);
  const reload = useCallback(async () => {
    if (!supabase) return;
    const ticket = ++latest.current;
    const r = await loadContent(accountId).catch(() => null);
    // An older read finishing late never overwrites a newer one.
    if (r && ticket === latest.current) dispatch({ type: 'contentServer/loaded', ...r, at: new Date().toISOString() });
  }, [accountId, dispatch]);
  useEffect(() => {
    // Products linked to posts come from the catalogue: read once it is there.
    if (supabase && catalogVersion > 0) void reload();
  }, [reload, catalogVersion]);
  return reload;
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
