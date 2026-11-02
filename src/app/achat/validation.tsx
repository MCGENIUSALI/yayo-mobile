import { router } from 'expo-router';
import { Info, Smartphone } from 'lucide-react-native';
import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { formatMsisdn } from '@/domain/format';
import { formatFC } from '@/domain/money';
import { useStore } from '@/store/AppStore';
import { color, space } from '@/theme/tokens';
import { Button } from '@/ui/Button';
import { Alert, HeroIcon, TimerPill, useCountdown } from '@/ui/Feedback';
import { BottomBar, Content, Screen } from '@/ui/Layout';
import { haptic } from '@/ui/Pressable';
import { PaymentStatusBadge } from '@/ui/Status';
import { Text } from '@/ui/Text';
import { TopAppBar } from '@/ui/TopAppBar';

/** Gentle "waiting" pulse around the hero icon. Off with reduced motion. */
function Pulse() {
  const reduced = useReducedMotion();
  const p = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    p.set(withRepeat(withTiming(1, { duration: 1400, easing: Easing.out(Easing.quad) }), -1, false));
  }, [p, reduced]);
  const style = useAnimatedStyle(() => ({ opacity: 0.5 * (1 - p.value), transform: [{ scale: 1 + p.value * 0.35 }] }));
  if (reduced) return null;
  return <Animated.View pointerEvents="none" style={[styles.pulse, style]} />;
}

/** C4 · Validation Mobile Money (also used for card processing). */
export default function PaymentValidation() {
  const { state, dispatch } = useStore();
  const ck = state.activeCheckoutId ? state.checkouts[state.activeCheckoutId] : undefined;
  const { label: remaining } = useCountdown(ck?.status === 'pending' ? ck.expiresAt : undefined);
  const settled = useRef(false);

  // Outcome → terminal screen. replace() so back never returns to a settled request.
  useEffect(() => {
    if (!ck || settled.current) return;
    if (ck.status === 'succeeded') {
      settled.current = true;
      haptic('success');
      router.replace('/achat/confirmee');
    } else if (ck.status === 'failed' || ck.status === 'expired') {
      settled.current = true;
      haptic('warning');
      router.replace('/achat/echec');
    }
  }, [ck]);

  // Leaving this screen while the request is pending (back button, swipe) cancels the request.
  const latest = useRef(ck);
  useEffect(() => {
    latest.current = ck;
  }, [ck]);
  useEffect(
    () => () => {
      const current = latest.current;
      if (!settled.current && current?.status === 'pending') dispatch({ type: 'checkout/cancelRequest', checkoutId: current.id });
    },
    [dispatch],
  );

  if (!ck) {
    return (
      <Screen>
        <TopAppBar title="Paiement en cours" />
        <View style={styles.center}>
          <Text variant="bodyM" color={color.text.secondary}>
            Aucun paiement en cours.
          </Text>
          <Button label="Retour au panier" onPress={() => router.dismissTo('/panier')} />
        </View>
      </Screen>
    );
  }

  const isCard = ck.method === 'card';
  const operator = ck.operator ?? 'Mobile Money';
  return (
    <Screen>
      <TopAppBar title="Paiement en cours" />
      <Content top={40} gap={space.xl} style={styles.content}>
        <View>
          <Pulse />
          <HeroIcon icon={Smartphone} bg={color.bg.accentSubtle} fg={color.icon.accent} />
        </View>
        <PaymentStatusBadge status="pending" />
        <Text variant="h2" align="center" accessibilityRole="header">
          {isCard ? 'Paiement par carte en cours' : 'Valide le paiement sur ton téléphone'}
        </Text>
        <Text variant="bodyM" color={color.text.secondary} align="center" accessibilityLiveRegion="polite">
          {isCard
            ? `Nous confirmons ton paiement de ${formatFC(ck.amount)} auprès de ta banque.`
            : `Une demande ${operator} de ${formatFC(ck.amount)} a été envoyée au ${formatMsisdn(ck.msisdn ?? '')}. Saisis ton code PIN pour confirmer.`}
        </Text>
        {!isCard ? <TimerPill label={`La demande expire dans ${remaining}`} /> : null}
        <Alert
          tone="escrow"
          icon={Info}
          title="Ton argent est protégé"
          body="Après validation, YA YO conserve les fonds jusqu’à la livraison. Le vendeur n’est payé qu’après ta réception."
        />
      </Content>
      <BottomBar background={color.bg.canvas} bordered={false}>
        {!isCard ? (
          <Button
            label="Renvoyer la demande"
            variant="outline"
            onPress={() => {
              dispatch({ type: 'checkout/cancelRequest', checkoutId: ck.id });
              dispatch({ type: 'checkout/pay' });
            }}
            fill
          />
        ) : null}
        <Button label="Changer de moyen de paiement" variant="ghost" onPress={() => router.back()} fill />
      </BottomBar>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { alignItems: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.lg, padding: space.screen },
  pulse: {
    position: 'absolute',
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: color.bg.accent,
  },
});
