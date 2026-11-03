import { LogOut, RotateCcw } from 'lucide-react-native';
import { ScrollView, StyleSheet, View } from 'react-native';
import { currentAccount, displayTarget, initialsOf } from '@/domain/auth';
import { confirmedOrders } from '@/domain/state';
import { useStore } from '@/store/AppStore';
import { color, radius, space } from '@/theme/tokens';
import { Button } from '@/ui/Button';
import { Avatar } from '@/ui/Commerce';
import { useToast } from '@/ui/Feedback';
import { Card } from '@/ui/Layout';
import { Badge } from '@/ui/Status';
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
  const account = currentAccount(state.auth);
  const pendingLabel = { seller: 'Vendeur', courier: 'Livreur', buyer: 'Acheteur', admin: 'Admin' } as const;
  return (
    <View style={styles.screen}>
      <LargeTitleBar title="Profil" />
      <ScrollView contentContainerStyle={styles.content}>
        <Card>
          <View style={styles.row}>
            <Avatar initials={initialsOf(account?.name ?? '?')} />
            <View style={{ flex: 1 }}>
              <Text variant="labelL">{account?.name ?? 'Invité'}</Text>
              <Text variant="bodyS" color={color.text.secondary}>
                {account?.phone ? displayTarget('phone', account.phone) : account?.email ? displayTarget('email', account.email) : ''} · {account?.commune},{' '}
                {account?.city}
              </Text>
            </View>
          </View>
          {account?.pendingRoles.length ? (
            <View style={styles.badges}>
              {account.pendingRoles.map((r) => (
                <Badge key={r} label={`${pendingLabel[r]} · en attente de validation`} tone="warning" />
              ))}
            </View>
          ) : null}
          <Text variant="bodyS" color={color.text.secondary}>
            {orders} commande{orders > 1 ? 's' : ''} · {state.events.length} événements enregistrés
          </Text>
        </Card>

        <Card>
          <Text variant="labelL">Connexion (démo)</Text>
          <Text variant="bodyS" color={color.text.secondary}>
            Le code s’affiche sur l’écran de vérification. 81 234 5678 ouvre le compte de Jean Mukendi, 85 000 0000 un compte suspendu ; tout
            autre numéro crée un nouveau compte.
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
        <Button
          label="Se déconnecter"
          variant="outline"
          leadingIcon={LogOut}
          haptic="selection"
          onPress={() => dispatch({ type: 'auth/signOut' })}
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
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  scenario: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.xs,
    borderRadius: radius.sm,
  },
});
