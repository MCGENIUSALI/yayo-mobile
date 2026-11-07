import { router } from 'expo-router';
import { Bike, Heart, Languages, LifeBuoy, LogOut, MapPin, RotateCcw, Store, Trash2, UserRound, Wallet } from 'lucide-react-native';
import { ScrollView, StyleSheet, View } from 'react-native';
import { currentAccount, displayTarget, initialsOf } from '@/domain/auth';
import { activeCourierSpace, activeSellerSpace, buyerAddresses, canUseCourierMode, canUseSellerMode, confirmedOrders, type AppState } from '@/domain/state';
import { useSwitchMode } from '@/store/useSwitchMode';
import { useStore } from '@/store/AppStore';
import { color, radius, space } from '@/theme/tokens';
import { Button } from '@/ui/Button';
import { Avatar } from '@/ui/Commerce';
import { useToast } from '@/ui/Feedback';
import { Card } from '@/ui/Layout';
import { MenuGroup, MenuRow } from '@/ui/Seller';
import { Badge } from '@/ui/Status';
import { Text } from '@/ui/Text';
import { LargeTitleBar } from '@/ui/TopAppBar';

const SCENARIOS = [
  ['81 234 5678', 'paiement validé après ~4 s'],
  ['81 234 0000', 'solde insuffisant (C6)'],
  ['81 234 1111', 'refusé par l’opérateur (C6)'],
  ['81 234 9999', 'jamais validé : la demande expire (C4 → C6)'],
] as const;

/** D7 · Profil, or A10 for a guest. Demo tools for QA stay at the bottom. */
export default function ProfileTab() {
  const { state } = useStore();
  return state.auth.session ? <ProfileScreen /> : <GuestProfile />;
}

/** A10 · Tu navigues sans compte. */
function GuestProfile() {
  const toast = useToast();
  return (
    <View style={styles.screen}>
      <LargeTitleBar title="Profil" />
      <ScrollView contentContainerStyle={styles.content}>
        <Card>
          <View style={styles.row}>
            <View style={styles.sellerIcon}>
              <UserRound size={22} color={color.icon.accent} strokeWidth={2} />
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="labelL">Tu navigues sans compte</Text>
              <Text variant="bodyS" color={color.text.secondary}>
                Crée ton compte pour commander, suivre tes colis et payer en toute sécurité.
              </Text>
            </View>
          </View>
          <Button label="Se connecter ou s’inscrire" haptic="medium" onPress={() => router.push('/auth/connexion')} fill />
        </Card>
        <MenuGroup title="Aide et compte">
          <MenuRow icon={LifeBuoy} title="Centre d’aide" onPress={() => router.push('/aide')} />
          <MenuRow icon={Languages} title="Langue" value="Français" onPress={() => toast(LANGUAGE_NOTE)} />
        </MenuGroup>
      </ScrollView>
    </View>
  );
}

const LANGUAGE_NOTE = 'YA YO est disponible en français pour l’instant.';

function ProfileScreen() {
  const { state, dispatch } = useStore();
  const toast = useToast();
  const account = currentAccount(state.auth);
  const pendingLabel = { seller: 'Vendeur', courier: 'Livreur', buyer: 'Acheteur', admin: 'Admin' } as const;
  const switchTo = useSwitchMode();
  const sellerSpace = activeSellerSpace(state);
  const sellerReady = canUseSellerMode(state);
  const courierSpace = activeCourierSpace(state);
  const courierReady = canUseCourierMode(state);
  const addresses = buyerAddresses(state).length;
  const favorites = state.social.wishlist.length;
  const lastOperator = lastPaymentOperator(state);
  const contact = account?.phone ? displayTarget('phone', account.phone) : account?.email ? displayTarget('email', account.email) : '';
  return (
    <View style={styles.screen}>
      <LargeTitleBar title="Profil" />
      <ScrollView contentContainerStyle={styles.content}>
        <Card>
          <View style={styles.row}>
            <Avatar initials={initialsOf(account?.name ?? '?')} />
            <View style={{ flex: 1 }}>
              <Text variant="labelL">{account?.name}</Text>
              <Text variant="bodyS" color={color.text.secondary}>
                {[contact, account?.commune].filter(Boolean).join(' · ')}
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
        </Card>

        <MenuGroup title="Mes achats">
          <MenuRow icon={MapPin} title="Adresses de livraison" value={addresses ? String(addresses) : undefined} onPress={() => router.push('/compte/adresses')} />
          <MenuRow
            icon={Wallet}
            title="Moyens de paiement"
            value={lastOperator}
            onPress={() => toast('Tu choisis ton moyen de paiement à chaque commande. L’enregistrement arrive dans une prochaine version.')}
          />
          <MenuRow
            icon={Heart}
            title="Favoris"
            value={favorites ? String(favorites) : undefined}
            onPress={() => toast('La liste de tes favoris arrive dans une prochaine version.')}
          />
        </MenuGroup>

        <MenuGroup title="Gagner avec YA YO">
          <MenuRow
            icon={Store}
            title={sellerReady ? 'Passer en mode vendeur' : sellerSpace ? sellerSpace.profile.name : 'Vendre sur YA YO'}
            subtitle={
              sellerSpace
                ? sellerSpace.status === 'verified'
                  ? 'Boutique vérifiée'
                  : sellerSpace.status === 'submitted'
                    ? 'Vérification en cours'
                    : 'Vérification d’identité à faire'
                : 'Ouvre ta boutique : paiements sécurisés'
            }
            onPress={() => (sellerReady ? switchTo('seller', '/vendeur/tableau') : router.push('/vendeur/creer'))}
          />
          <MenuRow
            icon={Bike}
            title={courierReady ? 'Passer en mode livreur' : 'Livrer avec YA YO'}
            subtitle={
              courierSpace
                ? courierSpace.status === 'verified'
                  ? 'Compte livreur validé'
                  : courierSpace.status === 'submitted'
                    ? 'Dossier en cours de validation'
                    : 'Documents à envoyer'
                : 'Payé à chaque mission'
            }
            onPress={() => (courierReady ? switchTo('courier', '/livreur/accueil') : router.push('/livreur/inscription'))}
          />
        </MenuGroup>

        <MenuGroup title="Aide et compte">
          <MenuRow icon={LifeBuoy} title="Centre d’aide et litiges" onPress={() => router.push('/aide')} />
          <MenuRow icon={Languages} title="Langue" value="Français" onPress={() => toast(LANGUAGE_NOTE)} />
          <MenuRow icon={LogOut} title="Se déconnecter" onPress={() => dispatch({ type: 'auth/signOut' })} />
          <MenuRow icon={Trash2} title="Supprimer mon compte" tone="danger" onPress={() => router.push('/compte/supprimer')} />
        </MenuGroup>

        <Card>
          <Text variant="labelL">Connexion (démo)</Text>
          <Text variant="bodyS" color={color.text.secondary}>
            Le code s’affiche sur l’écran de vérification. 81 234 5678 ouvre le compte de Jean Mukendi, 89 765 4321 la vendeuse de JBL Store
            Kin, 99 876 5432 le livreur Patrick, 85 000 0000 un compte suspendu ; tout autre numéro crée un nouveau compte.
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
            Vendeur et livreur se jouent avec leurs comptes, ou se simulent depuis le suivi d’une commande (Mode démo).
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
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  sellerIcon: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: color.bg.accentSubtle, alignItems: 'center', justifyContent: 'center' },
  scenario: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.xs,
    borderRadius: radius.sm,
  },
});

/** Operator of the account's latest Mobile Money payment (D7 "Moyens de paiement"). */
function lastPaymentOperator(state: AppState): string | undefined {
  const orders = confirmedOrders(state);
  for (const o of orders) {
    const op = state.checkouts[o.checkoutId]?.operator;
    if (op) return op;
  }
  return undefined;
}
