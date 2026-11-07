import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { CITIES } from '@/domain/auth';
import { docsError, isMotorised, normalizePlate, profileError, TRANSPORTS, type CourierProfile, type Transport } from '@/domain/courier';
import { useCourier } from '@/store/useCourier';
import { color, space } from '@/theme/tokens';
import { Button } from '@/ui/Button';
import { MultiSelectField } from '@/ui/Courier';
import { useToast } from '@/ui/Feedback';
import { Chip, TextField } from '@/ui/Form';
import { BottomBar, Content, Screen } from '@/ui/Layout';
import { haptic } from '@/ui/Pressable';
import { Steps } from '@/ui/Seller';
import { Text } from '@/ui/Text';
import { TopAppBar } from '@/ui/TopAppBar';

const local = (e164?: string) => (e164 ? e164.replace(/^\+243/, '').replace(/^(\d{2})(\d{3})(\d{4})$/, '$1 $2 $3') : '');

/** L1 · Devenir livreur, étape 1 sur 2 (profil et véhicule). Also edits them from L14 (`?edition=1`). */
export default function BecomeCourier() {
  const { edition } = useLocalSearchParams<{ edition?: string }>();
  const editing = edition === '1';
  const { account, space: courier, dispatch } = useCourier();
  const toast = useToast();
  const p = courier?.profile;
  const [transport, setTransport] = useState<Transport>(p?.transport ?? 'Moto');
  const [plate, setPlate] = useState(p?.plate ?? '');
  const [zones, setZones] = useState<string[]>(p?.zones ?? (account?.commune ? [account.commune] : []));
  const [phone, setPhone] = useState(local(p?.payoutPhone ?? account?.phone));
  const [touched, setTouched] = useState(false);

  const profile: CourierProfile = { transport, plate, zones, payoutPhone: phone };
  const error = profileError(profile);
  const communes = CITIES[account?.city ?? 'Kinshasa'] ?? CITIES.Kinshasa!;
  const plateError = touched && isMotorised(transport) && error?.includes('plaque') ? error : undefined;
  const phoneError = touched && error && /numéro|M-Pesa/.test(error) ? error : undefined;

  const submit = () => {
    setTouched(true);
    if (error) {
      haptic('warning');
      toast(error, 'danger');
      return;
    }
    // Same rule as the domain: a validated courier cannot switch to a vehicle whose documents were never checked.
    if (courier && courier.status !== 'draft' && docsError(transport, courier.docs)) {
      haptic('warning');
      toast('Ce véhicule demande un permis et une carte grise validés : contacte le centre d’aide livreur pour changer de véhicule.', 'danger');
      return;
    }
    dispatch({ type: 'courier/saveProfile', profile });
    haptic('success');
    if (editing) {
      router.back();
      toast('Profil livreur mis à jour.', 'success');
      return;
    }
    if (courier && courier.status !== 'draft') router.replace('/livreur/statut');
    else router.push('/livreur/documents');
  };

  return (
    <Screen>
      <TopAppBar title={editing ? 'Véhicule et zone' : 'Devenir livreur'} />
      <Content gap={space.xl} top={space.sm}>
        {!editing ? <Steps count={2} step={1} label="Profil et véhicule" /> : null}
        <View style={{ gap: space.xs }}>
          <Text variant="h2" accessibilityRole="header">
            Parle-nous de toi
          </Text>
          <Text variant="bodyM" color={color.text.secondary}>
            Ces informations servent à te proposer des missions près de chez toi.
          </Text>
        </View>

        <View style={{ gap: space.sm }}>
          <Text variant="labelM">Moyen de transport</Text>
          <View style={styles.chips} accessibilityRole="radiogroup">
            {TRANSPORTS.map((t) => (
              <Chip key={t} label={t} selected={t === transport} onPress={() => setTransport(t)} />
            ))}
          </View>
        </View>

        {isMotorised(transport) ? (
          <TextField
            label="Plaque d’immatriculation"
            value={plate}
            onChangeText={setPlate}
            onBlur={() => setPlate(normalizePlate(plate))}
            placeholder="KN 4521 BB"
            autoCapitalize="characters"
            autoCorrect={false}
            muted
            error={plateError}
          />
        ) : null}

        <MultiSelectField label="Zone de travail" values={zones} options={communes} onChange={setZones} error={touched && zones.length === 0 ? 'Choisis au moins une commune.' : undefined} />

        <TextField
          label="Numéro Mobile Money pour tes gains"
          prefix="phone-cd"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          inputMode="tel"
          placeholder="99 876 5432"
          maxLength={12}
          muted
          error={phoneError}
        />
      </Content>
      <BottomBar>
        <Button label={editing ? 'Enregistrer' : 'Continuer'} haptic="medium" onPress={submit} fill />
      </BottomBar>
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
