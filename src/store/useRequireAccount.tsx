import { router, type Href } from 'expo-router';
import { Globe, Smartphone } from 'lucide-react-native';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { getProduct } from '@/domain/catalog';
import { color, space } from '@/theme/tokens';
import { Button } from '@/ui/Button';
import { useToast } from '@/ui/Feedback';
import { Sheet } from '@/ui/Sheet';
import { Text } from '@/ui/Text';
import { useStore } from './AppStore';

/**
 * Guest browsing (US-01, A9–A10). A visitor without an account browses freely;
 * an action that needs one opens A9 « Connecte-toi pour… ». Once signed in, the
 * app resumes the interrupted action (the product is added, the screen opens).
 * The intent is kept in memory only: an app killed during sign-in starts over.
 */
export type Intent =
  | { kind: 'open'; href: Href; title?: string }
  | { kind: 'addToCart'; productId: string; color: string; qty: number; then: 'stay' | 'cart' };

let pending: Intent | undefined;

/** The action left before signing in, read once. */
export function takePendingIntent(): Intent | undefined {
  const i = pending;
  pending = undefined;
  return i;
}

export function clearPendingIntent() {
  pending = undefined;
}

type Ask = (intent: Intent) => void;
const GateContext = createContext<Ask | null>(null);

/** Hosts the A9 sheet for every screen. */
export function AccountGateProvider({ children }: { children: ReactNode }) {
  const [asking, setAsking] = useState<Intent | null>(null);
  const toast = useToast();
  const ask = useCallback<Ask>((intent) => {
    pending = intent;
    setAsking(intent);
  }, []);

  const close = () => {
    pending = undefined;
    setAsking(null);
  };
  const signIn = () => {
    setAsking(null);
    router.push('/auth/connexion');
  };

  const copy = asking ? sheetCopy(asking) : null;
  return (
    <GateContext.Provider value={ask}>
      {children}
      <Sheet
        visible={!!asking}
        onClose={close}
        title={copy?.title ?? ''}
        footer={
          <View style={{ flex: 1, gap: space.md }}>
            <Button label="Continuer avec mon numéro" leadingIcon={Smartphone} haptic="medium" onPress={signIn} fill />
            <Button
              label="Continuer avec Google"
              variant="outline"
              leadingIcon={Globe}
              onPress={() => toast('La connexion Google arrive avec le serveur YA YO. Utilise ton numéro ou ton e-mail.')}
              fill
            />
            <Button label="Plus tard" variant="ghost" onPress={close} fill />
          </View>
        }
      >
        <Text variant="bodyM" color={color.text.secondary}>
          {copy?.body}
        </Text>
      </Sheet>
    </GateContext.Provider>
  );
}

function sheetCopy(i: Intent): { title: string; body: string } {
  if (i.kind === 'addToCart') {
    let what = 'ton article';
    try {
      what = `${getProduct(i.productId).shortName}, ${i.color}, quantité ${i.qty}`;
    } catch {
      // Unknown product: generic wording.
    }
    return {
      title: 'Connecte-toi pour commander',
      body: `Ton choix est gardé. Après la connexion, tu reprends exactement où tu en étais : ${what}.`,
    };
  }
  return { title: i.title ?? 'Connecte-toi pour continuer', body: 'Après la connexion, tu reprends exactement où tu en étais.' };
}

/**
 * `require(intent)`: runs the intent now when signed in, otherwise asks to sign
 * in first (A9) and resumes it afterwards.
 */
export function useRequireAccount() {
  const ask = useContext(GateContext);
  const { state, dispatch } = useStore();
  const signedIn = !!state.auth.session;
  return useCallback(
    (intent: Intent) => {
      if (signedIn) {
        runIntent(intent, dispatch);
        return;
      }
      if (ask) ask(intent);
      else {
        pending = intent;
        router.push('/auth/connexion');
      }
    },
    [signedIn, ask, dispatch],
  );
}

/** Same for a plain screen opening. */
export function useOpenWithAccount() {
  const require = useRequireAccount();
  return useMemo(() => (href: Href, title?: string) => require({ kind: 'open', href, title }), [require]);
}

export function runIntent(intent: Intent, dispatch: ReturnType<typeof useStore>['dispatch'], resumed = false) {
  if (intent.kind === 'open') {
    router.push(intent.href);
    return;
  }
  dispatch({ type: 'cart/add', productId: intent.productId, color: intent.color, qty: intent.qty });
  if (intent.then === 'cart') router.push('/panier');
  else if (resumed) router.push({ pathname: '/produit/[id]', params: { id: intent.productId, added: '1' } });
}
