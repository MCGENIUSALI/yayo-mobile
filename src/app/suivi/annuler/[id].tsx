import { router, useLocalSearchParams } from 'expo-router';
import { Ban, Undo2 } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';
import { CANCEL_REASONS } from '@/domain/account';
import { formatFC } from '@/domain/money';
import { canCancel } from '@/domain/orderMachine';
import type { CancelReason } from '@/domain/types';
import { useStore } from '@/store/AppStore';
import { color, space } from '@/theme/tokens';
import { Button } from '@/ui/Button';
import { Alert, useToast } from '@/ui/Feedback';
import { Section, SelectCard, TextField } from '@/ui/Form';
import { BottomBar, Content, Screen } from '@/ui/Layout';
import { Text } from '@/ui/Text';
import { TopAppBar } from '@/ui/TopAppBar';

/** D18 · Annuler la commande: allowed until the seller hands the parcel to the courier. */
export default function CancelOrderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state, dispatch } = useStore();
  const toast = useToast();
  const order = id ? state.orders[id] : undefined;
  const [reason, setReason] = useState<CancelReason | null>(null);
  const [note, setNote] = useState('');

  if (!order || !canCancel(order)) {
    return (
      <Screen>
        <TopAppBar title="Annuler la commande" />
        <Content>
          <Alert
            tone="warning"
            icon={Ban}
            title="Annulation impossible"
            body={
              order?.cancellation
                ? 'Cette commande est déjà annulée.'
                : 'Le colis est déjà parti chez le livreur. Si quelque chose ne va pas à la réception, signale un problème depuis le suivi.'
            }
          />
          <Button label="Retour au suivi" variant="outline" onPress={() => router.back()} fill />
        </Content>
      </Screen>
    );
  }

  const prepaid = order.method !== 'cash';
  const checkout = state.checkouts[order.checkoutId];
  const destination = order.method === 'card' ? 'ta carte bancaire' : checkout?.operator ? `ton compte ${checkout.operator}` : 'ton compte Mobile Money';

  const confirm = () => {
    if (!reason) return;
    const at = new Date().toISOString();
    dispatch({ type: 'order/cancel', orderId: order.id, reason, note: reason === 'other' ? note : undefined, at });
    toast('Commande annulée.', 'success');
    router.back();
  };

  return (
    <Screen>
      <TopAppBar title="Annuler la commande" />
      <Content gap={space.xl}>
        <Text variant="bodyM" color={color.text.secondary}>
          {`Commande #${order.id} · ${formatFC(order.total)}. Le vendeur n’a pas encore remis ton colis au livreur : tu peux encore annuler.`}
        </Text>
        <Section title="Pourquoi annules-tu ?">
          <View style={{ gap: space.md }} accessibilityRole="radiogroup">
            {CANCEL_REASONS.map((r) => (
              <SelectCard key={r.id} icon={Ban} align="start" title={r.label} lines={[]} selected={reason === r.id} onPress={() => setReason(r.id)} />
            ))}
          </View>
          {reason === 'other' ? (
            <TextField
              label="Précise (facultatif)"
              placeholder="Dis-nous ce qui s’est passé"
              value={note}
              maxLength={280}
              multiline
              onChangeText={setNote}
            />
          ) : null}
        </Section>
        <Alert
          tone="info"
          icon={Undo2}
          title={prepaid ? `${formatFC(order.total)} remboursés` : 'Rien à rembourser'}
          body={
            prepaid
              ? `Le montant revient en entier sur ${destination}. Le vendeur est prévenu et ne reçoit rien.`
              : 'Tu devais payer à la livraison : rien n’a été débité. Le vendeur est prévenu.'
          }
        />
      </Content>
      <BottomBar>
        <Button label="Annuler la commande" variant="destructive" haptic="warning" disabled={!reason} onPress={confirm} fill />
        <Button label="Garder ma commande" variant="ghost" onPress={() => router.back()} fill />
      </BottomBar>
    </Screen>
  );
}
