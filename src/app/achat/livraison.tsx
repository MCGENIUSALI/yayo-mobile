import { Redirect, router } from 'expo-router';
import { MapPin, Package, Plus } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { deliverySlots } from '@/domain/catalog';
import { BUNDLED_GEO, completePlace, placeError, type Place } from '@/domain/geo';
import { buyerAddresses } from '@/domain/state';
import { currentAccount } from '@/domain/auth';
import { summarizeCart } from '@/domain/pricing';
import { useStore } from '@/store/AppStore';
import { color, space } from '@/theme/tokens';
import { Button } from '@/ui/Button';
import { Alert, useToast } from '@/ui/Feedback';
import { CheckoutSteps, Chip, Section, SelectCard, TextField } from '@/ui/Form';
import { BottomBar, Content, Screen } from '@/ui/Layout';
import { LocationFields } from '@/ui/Location';
import { haptic } from '@/ui/Pressable';
import { Sheet } from '@/ui/Sheet';
import { Text } from '@/ui/Text';
import { TopAppBar } from '@/ui/TopAppBar';

/** C2 · Livraison — étape 1 sur 3 : adresse et créneau. Inputs are kept in the store draft. */
export default function DeliveryStep() {
  const { state, dispatch } = useStore();
  const toast = useToast();
  const { draft } = state;
  const parcels = useMemo(() => summarizeCart(state.cart, state.promoCode).groups.length, [state.cart, state.promoCode]);
  const addresses = buyerAddresses(state);
  const [adding, setAdding] = useState(false);
  const selected = addresses.find((a) => a.id === draft.addressId);

  // A new account starts without an address, an old draft may point to another account's: select the first one.
  useEffect(() => {
    if (!selected && addresses[0]) dispatch({ type: 'draft/update', patch: { addressId: addresses[0].id } });
  }, [selected, addresses, dispatch]);

  if (state.cart.length === 0) return <Redirect href="/panier" />;

  return (
    <Screen>
      <TopAppBar title="Livraison" />
      <Content gap={space.xl}>
        <CheckoutSteps step={1} label="Adresse et créneau" />

        <Section title="Adresse de livraison">
          <View style={{ gap: space.md }} accessibilityRole="radiogroup">
            {addresses.map((a) => (
              <SelectCard
                key={a.id}
                align="start"
                icon={MapPin}
                title={a.label}
                lines={[{ text: a.line }, { text: a.phone, tone: 'tertiary' }]}
                selected={draft.addressId === a.id}
                onPress={() => dispatch({ type: 'draft/update', patch: { addressId: a.id } })}
              />
            ))}
          </View>
          <Button
            label="Ajouter une adresse"
            variant="ghost"
            size="M"
            leadingIcon={Plus}
            style={styles.addBtn}
            onPress={() => setAdding(true)}
          />
        </Section>

        <Section title="Créneau de livraison">
          <View style={styles.chips} accessibilityRole="radiogroup">
            {deliverySlots.map((s) => (
              <Chip
                key={s.id}
                label={s.label}
                selected={draft.slotId === s.id}
                onPress={() => dispatch({ type: 'draft/update', patch: { slotId: s.id } })}
              />
            ))}
          </View>
        </Section>

        <TextField
          label="Indication pour le livreur (facultatif)"
          placeholder="Portail bleu, face à la pharmacie"
          value={draft.note}
          muted
          maxLength={140}
          returnKeyType="done"
          onChangeText={(note) => dispatch({ type: 'draft/update', patch: { note } })}
        />

        <Alert
          tone="info"
          icon={Package}
          title={parcels > 1 ? `${parcels} colis, ${parcels} livraisons` : '1 colis, 1 livraison'}
          body={
            parcels > 1
              ? 'Chaque vendeur expédie séparément. Tu recevras un code de réception par colis.'
              : 'Tu recevras un code de réception à donner au livreur.'
          }
        />
      </Content>
      <BottomBar>
        <Button
          label="Continuer vers le paiement"
          onPress={() => {
            if (!selected) {
              haptic('warning');
              toast('Ajoute une adresse de livraison.', 'danger');
              setAdding(true);
              return;
            }
            router.push('/achat/paiement');
          }}
          fill
        />
      </BottomBar>
      <AddAddressSheet visible={adding} onClose={() => setAdding(false)} />
    </Screen>
  );
}

/** C2 · Nouvelle adresse: dependent fields, saved to the account and selected. */
function AddAddressSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { state, dispatch } = useStore();
  const toast = useToast();
  const account = currentAccount(state.auth);
  const [label, setLabel] = useState('');
  const [place, setPlace] = useState<Partial<Place>>(() =>
    completePlace({ country: account?.country, province: account?.province, city: account?.city, commune: account?.commune || undefined }),
  );
  const [touched, setTouched] = useState(false);
  const full = completePlace(place);
  const issue = placeError(BUNDLED_GEO[full.country], full);
  const streetError = (place.street?.trim().length ?? 0) < 5 ? 'Indique l’avenue et le numéro, ou un repère.' : undefined;

  const save = () => {
    setTouched(true);
    if (issue || streetError) {
      haptic('warning');
      return;
    }
    dispatch({ type: 'address/add', label, place });
    haptic('success');
    toast('Adresse enregistrée.', 'success');
    setLabel('');
    setPlace((p) => ({ country: p.country, province: p.province, city: p.city }));
    setTouched(false);
    onClose();
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Nouvelle adresse"
      // A half-filled form is kept: only the close button or Back closes it.
      dismissible={false}
      footer={<Button label="Enregistrer l’adresse" onPress={save} style={{ flex: 1 }} />}
    >
      <ScrollView style={styles.form} contentContainerStyle={{ gap: space.lg }} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        <TextField label="Nom de l’adresse (optionnel)" value={label} onChangeText={setLabel} placeholder="Maison, Bureau, Chez maman…" autoCapitalize="sentences" />
        <LocationFields value={place} onChange={setPlace} street error={touched ? issue : null} />
        {touched && !issue && streetError ? (
          <Text variant="bodyS" color={color.text.danger}>
            {streetError}
          </Text>
        ) : null}
      </ScrollView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  addBtn: { alignSelf: 'flex-start', paddingHorizontal: 0 },
  form: { maxHeight: 520 },
});
