import { router } from 'expo-router';
import { Bike, CircleHelp, LogOut, MapPin, ShieldCheck, ShoppingBag, Star, Store, Wallet } from 'lucide-react-native';
import { ScrollView, StyleSheet, View } from 'react-native';
import { initialsOf } from '@/domain/auth';
import { formatDay } from '@/domain/format';
import { maskPhone } from '@/domain/seller';
import { canUseSellerMode } from '@/domain/state';
import { useCourier } from '@/store/useCourier';
import { useSwitchMode } from '@/store/useSwitchMode';
import { color, radius, space } from '@/theme/tokens';
import { Avatar } from '@/ui/Commerce';
import { useToast } from '@/ui/Feedback';
import { MenuGroup, MenuRow } from '@/ui/Seller';
import { Text } from '@/ui/Text';
import { LargeTitleBar } from '@/ui/TopAppBar';

const validatedLabel = (iso: string) => {
  const d = formatDay(iso);
  return d === 'Aujourd’hui' || d === 'Hier' ? `Validés ${d.toLowerCase()}` : `Validés le ${d}`;
};

/** L14 · Profil livreur. */
export default function CourierProfile() {
  const { account, space: courier, state, dispatch } = useCourier();
  const toast = useToast();
  const switchTo = useSwitchMode();
  const p = courier?.profile;
  const edit = () => router.push({ pathname: '/livreur/inscription', params: { edition: '1' } });

  return (
    <View style={styles.screen}>
      <LargeTitleBar title="Mon profil" subtitle="Livreur" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <Avatar initials={initialsOf(account?.name ?? '?')} verified={courier?.status === 'verified'} />
          <View style={{ flex: 1 }}>
            <Text variant="h4">{account?.name}</Text>
            {courier?.rating ? (
              <View style={styles.rating} accessibilityLabel={`Note ${courier.rating} sur 5, ${courier.ratingCount ?? 0} courses`}>
                {[1, 2, 3, 4, 5].map((i) => (
                  <Star key={i} size={14} strokeWidth={2} color={color.icon.warning} fill={courier.rating! >= i - 0.25 ? color.icon.warning : 'transparent'} />
                ))}
                <Text variant="labelS">{courier.rating.toLocaleString('fr-FR')}</Text>
                <Text variant="bodyS" color={color.text.tertiary}>
                  ({courier.ratingCount ?? 0} courses)
                </Text>
              </View>
            ) : (
              <Text variant="bodyS" color={color.text.secondary}>
                {courier?.status === 'verified' ? 'Nouveau livreur · pas encore de note' : 'Inscription livreur en cours'}
              </Text>
            )}
          </View>
        </View>

        {p ? (
          <MenuGroup title="Activité">
            <MenuRow icon={Bike} title="Véhicule" subtitle={p.plate ? `${p.transport} · ${p.plate}` : p.transport} onPress={edit} />
            <MenuRow icon={MapPin} title="Zone de travail" subtitle={p.zones.join(', ')} onPress={edit} />
            <MenuRow icon={Wallet} title="Compte Mobile Money" subtitle={maskPhone(p.payoutPhone)} onPress={edit} />
          </MenuGroup>
        ) : null}

        <MenuGroup title="Compte">
          {courier && courier.status !== 'draft' ? (
            <MenuRow
              icon={ShieldCheck}
              title="Documents KYC"
              subtitle={courier.status === 'verified' && courier.verifiedAt ? validatedLabel(courier.verifiedAt) : 'En cours de validation'}
              onPress={() => router.push('/livreur/statut')}
            />
          ) : (
            <MenuRow icon={ShieldCheck} title="Terminer mon inscription" subtitle="Profil, véhicule et documents" onPress={() => router.push(courier ? '/livreur/documents' : '/livreur/inscription')} />
          )}
          <MenuRow icon={CircleHelp} title="Centre d’aide livreur" onPress={() => toast('Le centre d’aide sera branché avec le serveur YA YO.')} />
          {canUseSellerMode(state) ? <MenuRow icon={Store} title="Passer en mode vendeur" onPress={() => switchTo('seller', '/vendeur/tableau')} /> : null}
          <MenuRow icon={ShoppingBag} title="Passer en mode acheteur" onPress={() => switchTo('buyer', '/')} />
          <MenuRow icon={LogOut} title="Se déconnecter" onPress={() => dispatch({ type: 'auth/signOut' })} />
        </MenuGroup>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg.canvas },
  content: { padding: space.screen, paddingTop: space.sm, gap: space.xl },
  card: { flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: color.bg.surface, borderRadius: radius.lg, padding: space.lg },
  rating: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
});
