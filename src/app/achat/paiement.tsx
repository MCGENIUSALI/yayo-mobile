import { Redirect, router, useFocusEffect } from 'expo-router';
import { CreditCard, Lock, Smartphone } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { formatFC, formatUSD } from '@/domain/money';
import { detectOperator, formatLocalMsisdn } from '@/domain/paymentProvider';
import { plural } from '@/domain/format';
import { summarizeCart } from '@/domain/pricing';
import type { PaymentMethod } from '@/domain/types';
import { useStore } from '@/store/AppStore';
import { color, space } from '@/theme/tokens';
import { Button } from '@/ui/Button';
import { EscrowBanner, SummaryRow } from '@/ui/Commerce';
import { useToast } from '@/ui/Feedback';
import { CheckoutSteps, Section, SelectCard, TextField } from '@/ui/Form';
import { BottomBar, Card, Content, Divider, Screen } from '@/ui/Layout';
import { haptic } from '@/ui/Pressable';
import { Text } from '@/ui/Text';
import { TopAppBar } from '@/ui/TopAppBar';

const METHODS: { id: PaymentMethod; title: string; subtitle: string; icon: typeof Smartphone }[] = [
  { id: 'mobile_money', title: 'Mobile Money', subtitle: 'M-Pesa, Orange Money, Airtel Money', icon: Smartphone },
  { id: 'card', title: 'Carte bancaire', subtitle: 'Visa, Mastercard', icon: CreditCard },
];

/** C3 · Paiement — étape 2 sur 3 : moyen de paiement. */
export default function PaymentStep() {
  const { state, dispatch } = useStore();
  const toast = useToast();
  const { draft } = state;
  const summary = useMemo(() => summarizeCart(state.cart, state.promoCode), [state.cart, state.promoCode]);
  const [submittedAt, setSubmittedAt] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const handled = useRef<string | null>(null);

  // Coming back from C4 / C6 re-enables the form.
  useFocusEffect(
    useCallback(() => {
      setSubmittedAt(null);
    }, []),
  );

  const active = state.activeCheckoutId ? state.checkouts[state.activeCheckoutId] : undefined;
  const digits = draft.msisdn.replace(/\D/g, '');
  const operator = detectOperator(digits);
  const localError =
    draft.method !== 'mobile_money' || !touched
      ? undefined
      : digits.length !== 9
        ? 'Saisis un numéro à 9 chiffres.'
        : !operator
          ? 'Ce numéro n’est ni M-Pesa, ni Orange Money, ni Airtel Money.'
          : undefined;

  const submitError = submittedAt && state.lastError && state.lastError.at >= submittedAt ? state.lastError : undefined;
  const submitting = !!submittedAt && !submitError;

  // React to the outcome of *this* submission only, once per error / attempt.
  useEffect(() => {
    if (!submittedAt) return;
    if (submitError) {
      if (handled.current === submitError.at) return;
      handled.current = submitError.at;
      haptic('warning');
      if (submitError.code === 'HOLD_EXPIRED' || submitError.code === 'EMPTY_CART') {
        toast(submitError.message, 'danger');
        router.dismissTo('/panier');
      } else if (submitError.code !== 'INVALID_MSISDN' && submitError.code !== 'UNKNOWN_OPERATOR') {
        toast(submitError.message, 'danger');
      }
      return;
    }
    if (!active) return;
    // Keyed by attempt: C4 owns everything that happens to an attempt after the push.
    const key = `${active.id}#${active.attempt}`;
    if (handled.current === key) return;
    if (active.status === 'pending') {
      handled.current = key;
      router.push('/achat/validation');
    } else if (active.status === 'succeeded') {
      handled.current = key;
      router.replace('/achat/confirmee');
    }
  }, [active, submitError, submittedAt, toast]);

  const canReuse = active && active.status !== 'succeeded';
  if (state.cart.length === 0 && !canReuse) return <Redirect href="/panier" />;

  const pay = () => {
    setTouched(true);
    if (draft.method === 'mobile_money' && (digits.length !== 9 || !operator)) {
      haptic('warning');
      return;
    }
    setSubmittedAt(new Date().toISOString());
    dispatch({ type: 'checkout/pay' });
  };

  const serverError =
    state.lastError && (state.lastError.code === 'INVALID_MSISDN' || state.lastError.code === 'UNKNOWN_OPERATOR')
      ? state.lastError.message
      : undefined;

  return (
    <Screen>
      <TopAppBar title="Paiement" />
      <Content gap={space.xl}>
        <CheckoutSteps step={2} label="Moyen de paiement" />
        <Section title="Comment veux-tu payer ?">
          <View style={{ gap: space.md }} accessibilityRole="radiogroup">
            {METHODS.map((m) => (
              <SelectCard
                key={m.id}
                icon={m.icon}
                title={m.title}
                lines={[{ text: m.subtitle }]}
                selected={draft.method === m.id}
                onPress={() => dispatch({ type: 'draft/update', patch: { method: m.id } })}
              />
            ))}
          </View>
        </Section>

        {draft.method === 'mobile_money' ? (
          <TextField
            label="Numéro Mobile Money"
            prefix="phone-cd"
            keyboardType="phone-pad"
            textContentType="telephoneNumber"
            autoComplete="tel"
            placeholder="81 234 5678"
            value={draft.msisdn}
            maxLength={11}
            error={localError ?? serverError}
            onBlur={() => setTouched(true)}
            onChangeText={(v) => dispatch({ type: 'draft/update', patch: { msisdn: formatLocalMsisdn(v) } })}
          />
        ) : null}

        <Card gap={space.sm}>
          <SummaryRow label={`Articles (${summary.itemsCount})`} value={formatFC(summary.itemsTotal)} />
          <SummaryRow label={`Livraison (${plural(summary.groups.length, 'vendeur', 'vendeurs')})`} value={formatFC(summary.deliveryTotal)} />
          {summary.promo && summary.discount > 0 ? (
            <SummaryRow label={`Code promo ${summary.promo.code}`} value={formatFC(-summary.discount)} type="discount" />
          ) : null}
          <Divider />
          <SummaryRow label="Total" value={formatFC(summary.total)} type="total" />
          <Text variant="caption" color={color.text.secondary} align="right">
            {formatUSD(summary.total)} · taux indicatif
          </Text>
        </Card>
        <EscrowBanner variant="detailed" />
      </Content>
      <BottomBar>
        <Button
          label={`Payer ${formatFC(summary.total)}`}
          leadingIcon={Lock}
          loading={submitting}
          onPress={pay}
          haptic="medium"
          fill
          testID="pay-button"
        />
      </BottomBar>
    </Screen>
  );
}
