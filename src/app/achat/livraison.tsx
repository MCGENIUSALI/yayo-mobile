import { Redirect, router } from 'expo-router';
import { MapPin, Package, Plus } from 'lucide-react-native';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { addresses, deliverySlots } from '@/domain/catalog';
import { summarizeCart } from '@/domain/pricing';
import { useStore } from '@/store/AppStore';
import { space } from '@/theme/tokens';
import { Button } from '@/ui/Button';
import { Alert, useToast } from '@/ui/Feedback';
import { CheckoutSteps, Chip, Section, SelectCard, TextField } from '@/ui/Form';
import { BottomBar, Content, Screen } from '@/ui/Layout';
import { TopAppBar } from '@/ui/TopAppBar';

/** C2 · Livraison — étape 1 sur 3 : adresse et créneau. Inputs are kept in the store draft. */
export default function DeliveryStep() {
  const { state, dispatch } = useStore();
  const toast = useToast();
  const { draft } = state;
  const parcels = useMemo(() => summarizeCart(state.cart, state.promoCode).groups.length, [state.cart, state.promoCode]);

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
            onPress={() => toast('L’ajout d’adresse arrive dans la prochaine version.')}
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
        <Button label="Continuer vers le paiement" onPress={() => router.push('/achat/paiement')} fill />
      </BottomBar>
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  addBtn: { alignSelf: 'flex-start', paddingHorizontal: 0 },
});
