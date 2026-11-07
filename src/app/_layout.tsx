import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from '@expo-google-fonts/inter';
import { router, SplashScreen, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { authGate } from '@/domain/auth';
import { effectiveMode } from '@/domain/state';
import { AppStoreProvider, useStore } from '@/store/AppStore';
import { AccountGateProvider, clearPendingIntent, runIntent, takePendingIntent } from '@/store/useRequireAccount';
import { color } from '@/theme/tokens';
import { Splash } from '@/ui/Auth';
import { ToastProvider } from '@/ui/Feedback';

export { ErrorBoundary } from 'expo-router';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold });
  const ready = fontsLoaded || !!fontError;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => undefined);
  }, [ready]);

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <ToastProvider>
          <AppStoreProvider fallback={<Splash />}>
            <StatusBar style="dark" />
            <AccountGateProvider>
              <RootStack />
            </AccountGateProvider>
          </AppStoreProvider>
        </ToastProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/**
 * US-01 gate: onboarding once, then the buyer app, open to guests (A10).
 * Screens that need an account are behind `signedIn`; an action that needs one
 * asks to sign in (A9) and resumes afterwards. The guards switch screens by
 * themselves when the session changes (sign-in, sign-out, expiry, suspension,
 * deletion), so no screen navigates "into" the app.
 */
function RootStack() {
  const { state } = useStore();
  const gate = authGate(state.auth);
  const mode = effectiveMode(state);
  const signedIn = gate === 'app';
  const browsing = gate === 'app' || gate === 'guest';
  useResumeAfterSignIn(gate, state.auth.signedOutReason);
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: color.bg.canvas },
        animation: 'default',
        gestureEnabled: true,
      }}
    >
      {/* The account's current app decides which tab bar is the root (V12 "Passer en mode acheteur"). */}
      <Stack.Protected guard={browsing && mode === 'buyer'}>
        <Stack.Screen name="(tabs)" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && mode === 'seller'}>
        <Stack.Screen name="vendeur/(onglets)" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && mode === 'courier'}>
        <Stack.Screen name="livreur/(onglets)" />
      </Stack.Protected>
      {/* Open to guests: discovering never asks for an account. */}
      <Stack.Protected guard={browsing}>
        <Stack.Screen name="produit/[id]" />
        <Stack.Screen name="boutique/[id]" />
        <Stack.Screen name="fil" options={{ animation: 'fade', contentStyle: { backgroundColor: '#000' } }} />
        <Stack.Screen name="aide/index" />
        <Stack.Screen name="compte/supprime" options={{ gestureEnabled: false, animation: 'fade' }} />
      </Stack.Protected>
      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="vendeur/creer" />
        <Stack.Screen name="vendeur/verification" />
        <Stack.Screen name="vendeur/statut" options={{ gestureEnabled: false }} />
        <Stack.Screen name="vendeur/notifications" />
        <Stack.Screen name="vendeur/commande/[id]" />
        <Stack.Screen name="vendeur/remise/[id]" />
        <Stack.Screen name="vendeur/produit/nouveau" />
        <Stack.Screen name="vendeur/produit/[id]" />
        <Stack.Screen name="livreur/inscription" />
        <Stack.Screen name="livreur/documents" />
        <Stack.Screen name="livreur/statut" options={{ gestureEnabled: false }} />
        <Stack.Screen name="livreur/mission/[id]" />
        <Stack.Screen name="livreur/remise/[id]" />
        <Stack.Screen name="livreur/livree/[id]" options={{ gestureEnabled: false, animation: 'fade_from_bottom' }} />
        <Stack.Screen name="livreur/incident/[id]" />
        <Stack.Screen name="livreur/cash" />
        <Stack.Screen name="panier" />
        <Stack.Screen name="achat/livraison" />
        <Stack.Screen name="achat/paiement" />
        <Stack.Screen name="achat/validation" options={{ gestureEnabled: false }} />
        {/* Terminal states: no swipe-back into a settled payment. */}
        <Stack.Screen name="achat/confirmee" options={{ gestureEnabled: false, animation: 'fade_from_bottom' }} />
        <Stack.Screen name="achat/echec" options={{ gestureEnabled: false, animation: 'fade_from_bottom' }} />
        <Stack.Screen name="suivi/[id]" />
        <Stack.Screen name="suivi/annuler/[id]" />
        <Stack.Screen name="suivi/litige/[id]" />
        <Stack.Screen name="compte/adresses" />
        <Stack.Screen name="compte/adresse" />
        <Stack.Screen name="compte/supprimer" />
        <Stack.Screen name="compte/confirmer-suppression" />
        <Stack.Screen name="aide/discussion" />
      </Stack.Protected>
      <Stack.Protected guard={gate === 'onboarding'}>
        <Stack.Screen name="auth/bienvenue" options={{ animation: 'fade' }} />
      </Stack.Protected>
      <Stack.Protected guard={gate === 'guest'}>
        <Stack.Screen name="auth/connexion" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="auth/code" />
        <Stack.Screen name="auth/profil" options={{ gestureEnabled: false }} />
      </Stack.Protected>
      <Stack.Protected guard={gate === 'role'}>
        <Stack.Screen name="auth/role" options={{ gestureEnabled: false, animation: 'fade' }} />
      </Stack.Protected>
      <Stack.Protected guard={gate === 'blocked'}>
        <Stack.Screen name="auth/suspendu" options={{ gestureEnabled: false, animation: 'fade' }} />
      </Stack.Protected>
    </Stack>
  );
}

/** The protected-screen swap resets the stack: the next screen is pushed once it has settled. */
const RESUME_DELAY_MS = 350;

/**
 * - Signed in (guest → app, after A6/A7/A8): resumes the action that asked for an account.
 * - Session ended by expiry or suspension: back to A5, which says why.
 * - Account deleted (D11): D12 · Compte supprimé.
 */
function useResumeAfterSignIn(gate: ReturnType<typeof authGate>, reason: 'expired' | 'suspended' | 'deleted' | undefined) {
  const { dispatch } = useStore();
  const previous = useRef(gate);
  useEffect(() => {
    const from = previous.current;
    previous.current = gate;
    if (from === gate) return;
    if (gate === 'app') {
      const intent = takePendingIntent();
      if (!intent) return;
      const t = setTimeout(() => runIntent(intent, dispatch, true), RESUME_DELAY_MS);
      return () => clearTimeout(t);
    }
    if (gate === 'guest' && from === 'app') {
      clearPendingIntent();
      const target = reason === 'deleted' ? '/compte/supprime' : reason ? '/auth/connexion' : null;
      if (!target) return;
      const t = setTimeout(() => router.push(target), RESUME_DELAY_MS);
      return () => clearTimeout(t);
    }
  }, [gate, reason, dispatch]);
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.bg.canvas },
});
