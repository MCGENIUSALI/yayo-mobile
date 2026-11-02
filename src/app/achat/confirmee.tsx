import { router, useFocusEffect } from 'expo-router';
import { Check } from 'lucide-react-native';
import { useCallback } from 'react';
import { BackHandler, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { deliverySlots } from '@/domain/catalog';
import { plural } from '@/domain/format';
import { formatFC } from '@/domain/money';
import { useStore } from '@/store/AppStore';
import { color, space } from '@/theme/tokens';
import { Button } from '@/ui/Button';
import { EscrowBanner, SummaryRow } from '@/ui/Commerce';
import { HeroIcon, useEnter } from '@/ui/Feedback';
import { BottomBar, Card, Content, Screen } from '@/ui/Layout';
import { PaymentStatusBadge } from '@/ui/Status';
import { Text } from '@/ui/Text';

const METHOD_LABEL = { mobile_money: 'Mobile Money', card: 'carte bancaire', cash: 'cash à la livraison' } as const;

/** C5 · Commande confirmée. Terminal success state of the checkout. */
export default function OrderConfirmed() {
  const { state, dispatch } = useStore();
  const ck = state.activeCheckoutId ? state.checkouts[state.activeCheckoutId] : undefined;
  const checkoutId = ck?.id;
  const firstId = ck?.orderIds[0];

  const leave = useCallback(
    (to: 'track' | 'home') => {
      if (checkoutId) dispatch({ type: 'checkout/close', checkoutId });
      router.dismissAll();
      if (to === 'track' && firstId) router.push({ pathname: '/suivi/[id]', params: { id: firstId } });
      else router.navigate('/');
    },
    [checkoutId, dispatch, firstId],
  );

  // Android back = "Continuer mes achats" (never back into the payment flow).
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        leave('home');
        return true;
      });
      return () => sub.remove();
    }, [leave]),
  );

  const e = [useEnter(1), useEnter(2), useEnter(3), useEnter(4)];

  const orders = ck?.orderIds.map((id) => state.orders[id]).filter((o) => !!o) ?? [];
  const first = orders[0];

  if (!ck || ck.status !== 'succeeded' || !first) {
    return (
      <Screen>
        <View style={styles.center}>
          <Text variant="bodyM" color={color.text.secondary}>
            Aucune commande à confirmer.
          </Text>
          <Button label="Voir mes commandes" onPress={() => router.navigate('/commandes')} />
        </View>
      </Screen>
    );
  }

  const items = orders.reduce((n, o) => n + o.lines.reduce((m, l) => m + l.qty, 0), 0);
  const slot = deliverySlots.find((s) => s.id === first.slotId)?.label ?? '';
  const isCash = ck.method === 'cash';
  const refs = orders.map((o) => `#${o.id}`).join(', ');

  return (
    <Screen>
      <Content topInset top={56} gap={space.xl} style={styles.content}>
        <HeroIcon icon={Check} bg={color.bg.successSubtle} fg={color.icon.success} />
        <Animated.View entering={e[0]} style={styles.texts}>
          <Text variant="h2" align="center" accessibilityRole="header">
            Commande confirmée !
          </Text>
          <Text variant="bodyM" color={color.text.secondary} align="center">
            {orders.length > 1 ? `Commandes ${refs}` : `Commande ${refs}`} · {plural(items, 'article', 'articles')} chez{' '}
            {plural(orders.length, 'vendeur', 'vendeurs')}. {orders.length > 1 ? 'Les vendeurs préparent tes colis.' : 'Le vendeur prépare ton colis.'}
          </Text>
        </Animated.View>
        <Animated.View entering={e[1]}>
          <PaymentStatusBadge status={first.payment} method={ck.method} />
        </Animated.View>
        <Animated.View entering={e[2]} style={styles.stretch}>
          <EscrowBanner variant="detailed" />
        </Animated.View>
        <Animated.View entering={e[3]} style={styles.stretch}>
          <Card gap={space.sm}>
            <SummaryRow label={isCash ? 'À payer à la livraison' : `Payé via ${ck.operator ?? METHOD_LABEL[ck.method]}`} value={formatFC(ck.amount)} />
            <SummaryRow label="Livraison estimée" value={slot} />
            <SummaryRow label="Codes de réception" value="Dans le suivi" />
          </Card>
        </Animated.View>
      </Content>
      <BottomBar background={color.bg.canvas} bordered={false}>
        <Button label="Suivre ma commande" onPress={() => leave('track')} fill />
        <Button label="Continuer mes achats" variant="outline" onPress={() => leave('home')} fill />
      </BottomBar>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { alignItems: 'center' },
  texts: { gap: space.xl, alignSelf: 'stretch' },
  stretch: { alignSelf: 'stretch' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.lg, padding: space.screen },
});
