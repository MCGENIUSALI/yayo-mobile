import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { CircleCheck, FlaskConical } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { cashToCollect, missionStage } from '@/domain/courier';
import { formatFC } from '@/domain/money';
import { useCourier } from '@/store/useCourier';
import { color, radius, space } from '@/theme/tokens';
import { Checkbox } from '@/ui/Auth';
import { Button } from '@/ui/Button';
import { CodeInput } from '@/ui/Courier';
import { Alert } from '@/ui/Feedback';
import { BottomBar, Content, Screen } from '@/ui/Layout';
import { haptic } from '@/ui/Pressable';
import { Text } from '@/ui/Text';
import { TopAppBar } from '@/ui/TopAppBar';

/** L7 · Confirmer la livraison: buyer's receipt code (+ cash collected) closes the mission and releases the seller's payment. */
export default function ConfirmDelivery() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { missions, dispatch, state } = useCourier();
  const [code, setCode] = useState('');
  const [cashOk, setCashOk] = useState(false);
  const [tried, setTried] = useState<string | null>(null);
  const order = missions.find((o) => o.id === id);

  if (!order) {
    return (
      <Screen>
        <TopAppBar title="Remise du colis" onBack={() => router.navigate('/livreur/missions')} />
        <Content>
          <Text variant="bodyM" color={color.text.secondary}>
            Mission introuvable.
          </Text>
          <Button label="Mes missions" onPress={() => router.navigate('/livreur/missions')} fill />
        </Content>
      </Screen>
    );
  }

  const stage = missionStage(order);
  if (stage === 'delivered') return <Redirect href={{ pathname: '/livreur/livree/[id]', params: { id: order.id } }} />;
  if (stage !== 'handover' && stage !== 'delivery') return <Redirect href={{ pathname: '/livreur/mission/[id]', params: { id: order.id } }} />;

  const cash = cashToCollect(order);
  const error = tried !== null && state.lastError?.at === tried ? state.lastError : undefined;
  const ready = code.length === 4 && (!cash || cashOk);

  const confirm = () => {
    const at = new Date().toISOString();
    setTried(at);
    dispatch({ type: 'courier/orderEvent', orderId: order.id, event: { type: 'courier.confirm_delivery', code, cashCollected: cash ? cashOk : undefined }, at });
    if (code === order.receiptCode) {
      haptic('success');
      router.replace({ pathname: '/livreur/livree/[id]', params: { id: order.id } });
    } else {
      haptic('warning');
    }
  };

  return (
    <Screen>
      <TopAppBar title="Remise du colis" />
      <Content gap={space.xl} top={space.sm}>
        <View style={{ gap: space.xs }}>
          <Text variant="h3" accessibilityRole="header">
            Demande le code de réception au client
          </Text>
          <Text variant="bodyM" color={color.text.secondary}>
            Le client le trouve dans le suivi de sa commande. Sans ce code, la livraison ne peut pas être validée.
          </Text>
        </View>

        <View style={{ gap: space.sm }}>
          <CodeInput length={4} kind="digits" value={code} onChange={setCode} error={!!error} label="Code de réception à 4 chiffres" autoFocus />
          {error ? (
            <Text variant="bodyS" color={color.text.danger} align="center" accessibilityLiveRegion="polite">
              {error.code === 'WRONG_RECEIPT_CODE' ? 'Code incorrect. Vérifie avec le client le code affiché dans son app.' : error.message}
            </Text>
          ) : null}
        </View>

        {cash ? (
          <View style={styles.cash}>
            <Checkbox checked={cashOk} onChange={setCashOk} label={`J’ai encaissé ${formatFC(cash)} en espèces. Montant ajouté à ton cash à reverser.`} />
          </View>
        ) : null}

        <Alert tone="escrow" icon={CircleCheck} title="Ce que déclenche ta confirmation" body="La commande passe en « Livrée » et le paiement du vendeur est programmé par YA YO." />

        <View style={styles.demo}>
          <FlaskConical size={16} color={color.icon.secondary} strokeWidth={2} />
          <Text variant="bodyS" color={color.text.secondary} style={{ flex: 1 }}>
            Mode démo · le client lit ce code dans le suivi de sa commande : {order.receiptCode}.
          </Text>
        </View>
      </Content>
      <BottomBar>
        <Button label="Confirmer la livraison" haptic="medium" disabled={!ready} onPress={confirm} fill />
        <Button label="Impossible de livrer" variant="ghost" size="M" onPress={() => router.push({ pathname: '/livreur/incident/[id]', params: { id: order.id } })} fill />
      </BottomBar>
    </Screen>
  );
}

const styles = StyleSheet.create({
  cash: { backgroundColor: color.bg.surface, borderRadius: radius.lg, padding: space.lg },
  demo: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
});
