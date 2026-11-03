import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from '@expo-google-fonts/inter';
import { SplashScreen, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { authGate } from '@/domain/auth';
import { effectiveMode } from '@/domain/state';
import { AppStoreProvider, useStore } from '@/store/AppStore';
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
            <RootStack />
          </AppStoreProvider>
        </ToastProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/**
 * Every screen is behind the US-01 gate: onboarding once, then sign-in, then
 * the app. The guards switch screens by themselves when the session changes
 * (sign-in, sign-out, expiry, suspension), so no screen navigates "into" the app.
 */
function RootStack() {
  const { state } = useStore();
  const gate = authGate(state.auth);
  const mode = effectiveMode(state);
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
      <Stack.Protected guard={gate === 'app' && mode === 'buyer'}>
        <Stack.Screen name="(tabs)" />
      </Stack.Protected>
      <Stack.Protected guard={gate === 'app' && mode === 'seller'}>
        <Stack.Screen name="vendeur/(onglets)" />
      </Stack.Protected>
      <Stack.Protected guard={gate === 'app'}>
        <Stack.Screen name="vendeur/creer" />
        <Stack.Screen name="vendeur/verification" />
        <Stack.Screen name="vendeur/statut" options={{ gestureEnabled: false }} />
        <Stack.Screen name="vendeur/notifications" />
        <Stack.Screen name="vendeur/commande/[id]" />
        <Stack.Screen name="vendeur/remise/[id]" />
        <Stack.Screen name="vendeur/produit/nouveau" />
        <Stack.Screen name="vendeur/produit/[id]" />
        <Stack.Screen name="produit/[id]" />
        <Stack.Screen name="panier" />
        <Stack.Screen name="achat/livraison" />
        <Stack.Screen name="achat/paiement" />
        <Stack.Screen name="achat/validation" options={{ gestureEnabled: false }} />
        {/* Terminal states: no swipe-back into a settled payment. */}
        <Stack.Screen name="achat/confirmee" options={{ gestureEnabled: false, animation: 'fade_from_bottom' }} />
        <Stack.Screen name="achat/echec" options={{ gestureEnabled: false, animation: 'fade_from_bottom' }} />
        <Stack.Screen name="suivi/[id]" />
        <Stack.Screen name="boutique/[id]" />
        <Stack.Screen name="fil" options={{ animation: 'fade', contentStyle: { backgroundColor: '#000' } }} />
      </Stack.Protected>
      <Stack.Protected guard={gate === 'onboarding'}>
        <Stack.Screen name="auth/bienvenue" options={{ animation: 'fade' }} />
      </Stack.Protected>
      <Stack.Protected guard={gate === 'signin'}>
        <Stack.Screen name="auth/connexion" options={{ animation: 'fade' }} />
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

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.bg.canvas },
});
