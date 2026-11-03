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
import { StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppStoreProvider } from '@/store/AppStore';
import { color } from '@/theme/tokens';
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
          <AppStoreProvider fallback={<View style={styles.boot} />}>
            <StatusBar style="dark" />
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: color.bg.canvas },
                animation: 'default',
                gestureEnabled: true,
              }}
            >
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="produit/[id]" />
              <Stack.Screen name="panier" />
              <Stack.Screen name="achat/livraison" />
              <Stack.Screen name="achat/paiement" />
              <Stack.Screen name="achat/validation" options={{ gestureEnabled: false }} />
              {/* Terminal states: no swipe-back into a settled payment. */}
              <Stack.Screen name="achat/confirmee" options={{ gestureEnabled: false, animation: 'fade_from_bottom' }} />
              <Stack.Screen name="achat/echec" options={{ gestureEnabled: false, animation: 'fade_from_bottom' }} />
              <Stack.Screen name="suivi/[id]" />
              <Stack.Screen name="fil" options={{ animation: 'fade', contentStyle: { backgroundColor: '#000' } }} />
            </Stack>
          </AppStoreProvider>
        </ToastProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.bg.canvas },
  boot: { flex: 1, backgroundColor: color.bg.canvas },
});
