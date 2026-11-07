import { router, useFocusEffect } from 'expo-router';
import { RefreshCw, X } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, StyleSheet, View } from 'react-native';
import type { PaymentFailureReason } from '@/domain/types';
import { useStore } from '@/store/AppStore';
import { color, space } from '@/theme/tokens';
import { Button } from '@/ui/Button';
import { Alert, HeroIcon, useToast } from '@/ui/Feedback';
import { BottomBar, Content, Screen } from '@/ui/Layout';
import { PaymentStatusBadge } from '@/ui/Status';
import { Text } from '@/ui/Text';

function reasonCopy(reason: PaymentFailureReason | undefined, operator: string) {
  switch (reason) {
    case 'insufficient_funds':
      return {
        title: 'Solde Mobile Money insuffisant',
        body: `Recharge ton compte ${operator} ou choisis le paiement à la livraison.`,
      };
    case 'expired':
      return {
        title: 'La demande a expiré',
        body: 'Tu n’as pas validé la demande à temps. Renvoie-la et saisis ton code PIN sur ton téléphone.',
      };
    default:
      return {
        title: 'Paiement refusé par l’opérateur',
        body: 'Vérifie ton numéro ou choisis un autre moyen de paiement.',
      };
  }
}

/** C6 · Paiement échoué. Nothing was debited; orders are held 30 minutes. */
export default function PaymentFailed() {
  const { state, dispatch } = useStore();
  const toast = useToast();
  const ck = state.activeCheckoutId ? state.checkouts[state.activeCheckoutId] : undefined;
  const [retryAt, setRetryAt] = useState<string | null>(null);
  const navigated = useRef(false);

  // Retry outcome: a new pending request → C4, or an error (e.g. hold expired) → cart.
  useEffect(() => {
    if (!retryAt || navigated.current) return;
    if (ck?.status === 'pending') {
      navigated.current = true;
      router.replace('/achat/validation');
    } else if (state.lastError && state.lastError.at >= retryAt) {
      navigated.current = true;
      toast(state.lastError.message, 'danger');
      router.dismissTo('/panier');
    }
  }, [ck?.status, retryAt, state.lastError, toast]);

  // Android back = choose another method (back to C3), never back into C4.
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        router.back();
        return true;
      });
      return () => sub.remove();
    }, []),
  );

  if (!ck || (ck.status !== 'failed' && ck.status !== 'expired' && ck.status !== 'pending')) {
    return (
      <Screen>
        <View style={styles.center}>
          <Text variant="bodyM" color={color.text.secondary}>
            Aucun paiement à reprendre.
          </Text>
          <Button label="Retour au panier" onPress={() => router.dismissTo('/panier')} />
        </View>
      </Screen>
    );
  }

  const copy = reasonCopy(ck.failureReason, ck.operator ?? 'Mobile Money');
  return (
    <Screen>
      <Content topInset top={56} gap={space.xl} style={styles.content}>
        <HeroIcon icon={X} bg={color.bg.dangerSubtle} fg={color.icon.danger} />
        <Text variant="h2" align="center" accessibilityRole="header">
          Le paiement n’a pas abouti
        </Text>
        <Text variant="bodyM" color={color.text.secondary} align="center">
          Aucun montant n’a été débité. Ta commande est gardée 30 minutes, tu peux réessayer.
        </Text>
        <PaymentStatusBadge status="failed" />
        <Alert tone="danger" title={copy.title} body={copy.body} />
      </Content>
      <BottomBar background={color.bg.canvas} bordered={false}>
        <Button
          label="Réessayer"
          leadingIcon={RefreshCw}
          loading={!!retryAt}
          haptic="medium"
          onPress={() => {
            setRetryAt(new Date().toISOString());
            dispatch({ type: 'checkout/pay' });
          }}
          fill
        />
        <Button label="Choisir un autre moyen" variant="outline" onPress={() => router.back()} fill />
      </BottomBar>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { alignItems: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.lg, padding: space.screen },
});
