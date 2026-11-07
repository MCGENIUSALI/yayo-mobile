import { router } from 'expo-router';
import { CircleHelp, Clock, Eye, LogOut, MapPin, ReceiptText, ShieldCheck, ShoppingBag, Store, Wallet } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { shops } from '@/domain/catalog';
import { formatDay } from '@/domain/format';
import { detectOperator } from '@/domain/paymentProvider';
import { maskPhone, shopArea } from '@/domain/seller';
import { useSeller } from '@/store/useSeller';
import { useSwitchMode } from '@/store/useSwitchMode';
import { color, radius, space } from '@/theme/tokens';
import { Button } from '@/ui/Button';
import { Avatar, Rating } from '@/ui/Commerce';
import { useToast } from '@/ui/Feedback';
import { TextField } from '@/ui/Form';
import { haptic } from '@/ui/Pressable';
import { EmptyState, MenuGroup, MenuRow } from '@/ui/Seller';
import { Sheet } from '@/ui/Sheet';
import { Badge } from '@/ui/Status';
import { Text } from '@/ui/Text';


const validatedLabel = (iso: string) => {
  const d = formatDay(iso);
  return d === 'Aujourd’hui' || d === 'Hier' ? `Validée ${d.toLowerCase()}` : `Validée le ${d}`;
};

/** V12 · Ma boutique. */
export default function MyShop() {
  const { shop, dispatch, state } = useSeller();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const switchTo = useSwitchMode();
  const [payout, setPayout] = useState<string | null>(null);
  const [hours, setHours] = useState(false);
  const publicShop = shop && shop.status === 'verified' ? shops[shop.shopId] : undefined;

  const header = (
    <View style={[styles.header, { paddingTop: insets.top + space.lg }]}>
      <Text variant="bodyM" color={color.text.secondary}>
        Vendeur
      </Text>
      <Text variant="h1" accessibilityRole="header">
        Ma boutique
      </Text>
    </View>
  );

  const account = (
    <MenuGroup title="Compte">
      {shop && shop.status !== 'draft' ? (
        <MenuRow
          icon={ShieldCheck}
          title="Vérification d’identité"
          subtitle={shop.status === 'verified' && shop.verifiedAt ? validatedLabel(shop.verifiedAt) : 'En cours de validation'}
          onPress={() => router.push('/vendeur/statut')}
        />
      ) : null}
      <MenuRow icon={CircleHelp} title="Centre d’aide vendeur" onPress={() => toast('Le centre d’aide sera branché avec le serveur YA YO.')} />
      <MenuRow icon={ShoppingBag} title="Passer en mode acheteur" onPress={() => switchTo('buyer', '/')} />
      <MenuRow icon={LogOut} title="Se déconnecter" onPress={() => dispatch({ type: 'auth/signOut' })} />
    </MenuGroup>
  );

  if (!shop) {
    return (
      <View style={styles.screen}>
        {header}
        <ScrollView contentContainerStyle={styles.content}>
          <EmptyState icon={Store} title="Pas encore de boutique" body="Ouvre ta boutique pour vendre sur YA YO." action={<Button label="Ouvrir ma boutique" onPress={() => router.push('/vendeur/creer')} />} />
          {account}
        </ScrollView>
      </View>
    );
  }

  const operator = shop.kyc ? detectOperator(shop.kyc.payoutPhone.slice(4)) : null;
  const p = shop.profile;

  return (
    <View style={styles.screen}>
      {header}
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <View style={styles.row}>
            <Avatar initials={(publicShop?.initials ?? p.name.slice(0, 2)).toUpperCase()} verified={shop.status === 'verified'} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="h4" numberOfLines={1}>
                {p.name}
              </Text>
              {publicShop?.rating ? <Rating value={publicShop.rating} count={publicShop.reviews} /> : <Text variant="bodyS" color={color.text.secondary}>{p.category}</Text>}
            </View>
          </View>
          <View style={styles.badges}>
            {shop.status === 'verified' ? <Badge label="Identité vérifiée" icon={ShieldCheck} tone="success" /> : <Badge label={shop.status === 'submitted' ? 'Vérification en cours' : 'Vérification à faire'} icon={Clock} tone="warning" />}
            <Badge label={shopArea(p)} icon={MapPin} />
          </View>
          <Button
            label="Voir ma boutique comme un client"
            variant="outline"
            size="M"
            leadingIcon={Eye}
            onPress={() =>
              publicShop
                ? router.push({ pathname: '/boutique/[id]', params: { id: publicShop.id } })
                : toast(shop.status === 'verified' ? 'Ta page boutique sera en ligne avec le serveur YA YO.' : 'Ta page boutique sera visible après la validation.')
            }
            fill
          />
        </View>

        <MenuGroup title="Boutique">
          <MenuRow icon={Store} title="Informations et logo" subtitle="Nom, catégorie, logo" onPress={() => router.push({ pathname: '/vendeur/creer', params: { edition: '1' } })} />
          <MenuRow icon={MapPin} title="Adresse de collecte" subtitle={p.pickupAddress} onPress={() => router.push({ pathname: '/vendeur/creer', params: { edition: '1' } })} />
          <MenuRow icon={Clock} title="Horaires de préparation" subtitle={p.hours} onPress={() => setHours(true)} />
        </MenuGroup>

        <MenuGroup title="Paiements">
          <MenuRow
            icon={Wallet}
            title="Compte de virement"
            subtitle={shop.kyc ? `${operator ?? 'Mobile Money'} · ${maskPhone(shop.kyc.payoutPhone)}` : 'À renseigner avec la vérification'}
            onPress={() => (shop.kyc ? setPayout('') : router.push('/vendeur/verification'))}
          />
          <MenuRow icon={ReceiptText} title="Factures et relevés" onPress={() => toast('Les relevés mensuels arriveront avec le serveur YA YO.')} />
        </MenuGroup>

        {account}
      </ScrollView>

      <Sheet
        visible={payout !== null}
        onClose={() => setPayout(null)}
        title="Compte de virement"
        footer={
          <Button
            label="Enregistrer"
            haptic="medium"
            onPress={() => {
              dispatch({ type: 'seller/setPayout', phone: payout ?? '' });
              haptic('success');
              setPayout(null);
              toast('Compte de virement mis à jour.', 'success');
            }}
            disabled={(payout ?? '').replace(/\D/g, '').length !== 9 || !detectOperator((payout ?? '').replace(/\D/g, ''))}
            fill
          />
        }
      >
        <Text variant="bodyM" color={color.text.secondary}>
          Actuel : {shop.kyc ? `${operator} · ${maskPhone(shop.kyc.payoutPhone)}` : '—'}
        </Text>
        <TextField label="Nouveau numéro Mobile Money" prefix="phone-cd" value={payout ?? ''} onChangeText={setPayout} keyboardType="phone-pad" inputMode="tel" placeholder="81 234 5678" maxLength={12} />
        {state.lastError?.code === 'INVALID_PHONE' ? (
          <Text variant="bodyS" color={color.text.danger}>
            {state.lastError.message}
          </Text>
        ) : null}
      </Sheet>

      <Sheet visible={hours} onClose={() => setHours(false)} title="Horaires de préparation">
        <Text variant="bodyM" color={color.text.secondary}>
          {p.hours}. Les livreurs passent collecter pendant ces horaires. La modification des horaires arrive avec le serveur YA YO.
        </Text>
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg.canvas },
  header: { backgroundColor: color.bg.surface, paddingHorizontal: space.screen, paddingBottom: space.md, gap: space.xs },
  content: { padding: space.screen, paddingTop: space.sm, gap: space.xl },
  card: { backgroundColor: color.bg.surface, borderRadius: radius.lg, padding: space.lg, gap: space.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  badges: { flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' },
});
