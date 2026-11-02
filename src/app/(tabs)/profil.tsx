import { RotateCcw } from 'lucide-react-native';
import { ScrollView, StyleSheet, View } from 'react-native';
import { confirmedOrders } from '@/domain/state';
import { useStore } from '@/store/AppStore';
import { color, radius, space } from '@/theme/tokens';
import { Button } from '@/ui/Button';
import { Avatar } from '@/ui/Commerce';
import { useToast } from '@/ui/Feedback';
import { Card } from '@/ui/Layout';
import { Text } from '@/ui/Text';
import { LargeTitleBar } from '@/ui/TopAppBar';

const SCENARIOS = [
  ['81 234 5678', 'paiement validé après ~4 s'],
  ['81 234 0000', 'solde insuffisant (C6)'],
  ['81 234 1111', 'refusé par l’opérateur (C6)'],
  ['81 234 9999', 'jamais validé : la demande expire (C4 → C6)'],
] as const;

/** Profil (D7 is a later increment) + demo tools for QA. */
export default function ProfileScreen() {
  const { state, dispatch } = useStore();
  const toast = useToast();
  const orders = confirmedOrders(state).length;
  return (
    <View style={styles.screen}>
      <LargeTitleBar title="Profil" />
      <ScrollView contentContainerStyle={styles.content}>
        <Card>
          <View style={styles.row}>
            <Avatar initials="GM" />
            <View style={{ flex: 1 }}>
              <Text variant="labelL">Grâce M.</Text>
              <Text variant="bodyS" color={color.text.secondary}>
                +243 81 234 5678 · Kalamu, Kinshasa
              </Text>
            </View>
          </View>
          <Text variant="bodyS" color={color.text.secondary}>
            {orders} commande{orders > 1 ? 's' : ''} · {state.events.length} événements enregistrés
          </Text>
        </Card>

        <Card>
          <Text variant="labelL">Scénarios de paiement (démo)</Text>
          <Text variant="bodyS" color={color.text.secondary}>
            Le numéro Mobile Money saisi à l’étape Paiement choisit le résultat :
          </Text>
          {SCENARIOS.map(([n, r]) => (
            <View key={n} style={styles.scenario}>
              <Text variant="labelM">{n}</Text>
              <Text variant="bodyS" color={color.text.secondary} style={{ flex: 1, textAlign: 'right' }}>
                {r}
              </Text>
            </View>
          ))}
          <Text variant="bodyS" color={color.text.secondary}>
            Vendeur et livreur se simulent depuis le suivi d’une commande (Mode démo).
          </Text>
        </Card>

        <Button
          label="Réinitialiser la démo"
          variant="danger"
          leadingIcon={RotateCcw}
          haptic="warning"
          onPress={() => {
            dispatch({ type: 'demo/reset' });
            toast('Démo réinitialisée : panier et commandes d’origine restaurés.', 'success');
          }}
          fill
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg.canvas },
  content: { padding: space.screen, gap: space.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  scenario: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.xs,
    borderRadius: radius.sm,
  },
});
