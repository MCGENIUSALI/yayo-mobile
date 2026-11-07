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
import { clearPendingHref, takePendingHref } from '@/store/useRequireAccount';
import { color } from '@/theme/tokens';
import { Splash, SplashFadeOut } from '@/ui/Auth';
import { ToastProvider } from '@/ui/Feedback';
import { useAndroidKeyboardRefocus } from '@/ui/keyboard';

export { ErrorBoundary } from 'expo-router';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold });
  const ready = fontsLoaded || !!fontError;
  useAndroidKeyboardRefocus();

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <ToastProvider>
          {/*
            A1: the native splash (same dark screen and logo, see app.json) stays up until the fonts are
            loaded, then this identical screen covers the stored session being restored, then fades out.
            Nothing waits longer than the app needs.
          */}
          <AppStoreProvider fallback={<Splash />} ready={ready} onFirstFrame={() => SplashScreen.hideAsync().catch(() => undefined)}>
            <StatusBar style="dark" />
            <RootStack />
            <SplashFadeOut />
          </AppStoreProvider>
        </ToastProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/**
 * US-01 gate: onboarding once (first install), then the buyer app, open to
 * guests. Screens that need an account are behind `signedIn`; the sign-in
 * screens are open to guests. The guards switch screens by themselves when the
 * session changes (sign-in, sign-out, expiry, suspension).
 */
function RootStack() {
  const { state } = useStore();
  const gate = authGate(state.auth);
  const mode = effectiveMode(state);
  const signedIn = gate === 'app';
  const browsing = gate === 'app' || gate === 'guest';
  useResumeAfterSignIn(gate, mode === 'buyer', state.auth.signedOutReason);
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
      <Stack.Protected guard={gate === 'app' && mode === 'seller'}>
        <Stack.Screen name="vendeur/(onglets)" />
      </Stack.Protected>
      <Stack.Protected guard={gate === 'app' && mode === 'courier'}>
        <Stack.Screen name="livreur/(onglets)" />
      </Stack.Protected>
      {/* Open to guests: browsing never asks for an account. */}
      <Stack.Protected guard={browsing}>
        <Stack.Screen name="produit/[id]" />
        <Stack.Screen name="panier" />
        <Stack.Screen name="boutique/[id]" />
        <Stack.Screen name="fil" options={{ animation: 'fade', contentStyle: { backgroundColor: '#000' } }} />
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
        <Stack.Screen name="achat/livraison" />
        <Stack.Screen name="achat/paiement" />
        <Stack.Screen name="achat/validation" options={{ gestureEnabled: false }} />
        {/* Terminal states: no swipe-back into a settled payment. */}
        <Stack.Screen name="achat/confirmee" options={{ gestureEnabled: false, animation: 'fade_from_bottom' }} />
        <Stack.Screen name="achat/echec" options={{ gestureEnabled: false, animation: 'fade_from_bottom' }} />
        <Stack.Screen name="suivi/[id]" />
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

/**
 * After a sign-in started from a guest action (Commander, Mes commandes…), go
 * where the visitor was going. An expired or refused session opens the
 * sign-in screen once, which explains why.
 */
const RESUME_DELAY_MS = 350;

function useResumeAfterSignIn(gate: ReturnType<typeof authGate>, buyer: boolean, signedOutReason: string | undefined) {
  const previous = useRef(gate);
  useEffect(() => {
    const from = previous.current;
    previous.current = gate;
    if (from === gate) return;
    if (gate === 'app') {
      const href = takePendingHref();
      // The guards first drop the sign-in screens (the stack goes back to the feed); navigate once that is done.
      if (href && buyer) setTimeout(() => router.push(href), RESUME_DELAY_MS);
    } else if (gate === 'guest' && from === 'app' && (signedOutReason === 'expired' || signedOutReason === 'suspended')) {
      clearPendingHref();
      setTimeout(() => router.push('/auth/connexion'), RESUME_DELAY_MS);
    } else if (gate !== 'role') {
      clearPendingHref();
    }
  }, [gate, buyer, signedOutReason]);
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.bg.canvas },
});
