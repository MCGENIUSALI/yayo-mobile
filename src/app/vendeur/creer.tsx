import { router, useLocalSearchParams } from 'expo-router';
import { MapPin, Navigation, Store, Tag } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { CITIES } from '@/domain/auth';
import { profileError, SHOP_CATEGORIES, type ShopProfile } from '@/domain/seller';
import { useSeller } from '@/store/useSeller';
import { color, space } from '@/theme/tokens';
import { SelectField } from '@/ui/Auth';
import { Button } from '@/ui/Button';
import { useToast } from '@/ui/Feedback';
import { TextField } from '@/ui/Form';
import { BottomBar, Content, Screen } from '@/ui/Layout';
import { haptic } from '@/ui/Pressable';
import { AddPhotoTile, PhotoTile, Steps } from '@/ui/Seller';
import { Text } from '@/ui/Text';
import { TopAppBar } from '@/ui/TopAppBar';

/** V1 · Créer ma boutique (étape 1 sur 3). Also edits the shop from V12 (`?edition=1`). */
export default function CreateShop() {
  const { edition } = useLocalSearchParams<{ edition?: string }>();
  const editing = edition === '1';
  const { account, shop, dispatch, state } = useSeller();
  const toast = useToast();
  const p = shop?.profile;
  const [logo, setLogo] = useState(p?.logo);
  const [name, setName] = useState(p?.name ?? '');
  const [category, setCategory] = useState<string | undefined>(p?.category);
  const [commune, setCommune] = useState<string | undefined>(p?.commune ?? account?.commune);
  const [address, setAddress] = useState(p?.pickupAddress ?? '');
  const [touched, setTouched] = useState(false);

  const profile: ShopProfile = { name, category: category ?? '', commune: commune ?? '', pickupAddress: address, logo, hours: p?.hours ?? 'Lun–Sam, 8h–18h' };
  const error = profileError(profile);
  const communes = CITIES[account?.city ?? 'Kinshasa'] ?? CITIES.Kinshasa!;

  const submit = () => {
    setTouched(true);
    if (error) {
      haptic('warning');
      toast(error, 'danger');
      return;
    }
    dispatch({ type: 'seller/saveProfile', profile });
    haptic('success');
    if (editing) {
      toast('Boutique mise à jour.', 'success');
      router.back();
      return;
    }
    // Shop already verified or sent: no need to send the documents again.
    if (shop && shop.status !== 'draft') router.replace('/vendeur/statut');
    else router.push('/vendeur/verification');
  };

  return (
    <Screen>
      <TopAppBar title={editing ? 'Informations et logo' : 'Ouvrir ma boutique'} background={color.bg.canvas} />
      <Content gap={space.xl} top={space.sm}>
        {!editing ? <Steps count={3} step={1} label="Boutique" /> : null}
        <View style={{ gap: space.xs }}>
          <Text variant="h2" accessibilityRole="header">
            Présente ta boutique
          </Text>
          <Text variant="bodyM" color={color.text.secondary}>
            Ces informations sont visibles par les acheteurs.
          </Text>
        </View>

        <View style={styles.logoRow}>
          {logo ? <PhotoTile photo={logo} label="Logo de la boutique" onRemove={() => setLogo(undefined)} /> : <AddPhotoTile title="Logo de la boutique" onPick={setLogo} />}
          <View style={{ flex: 1 }}>
            <Text variant="labelL">Logo de la boutique</Text>
            <Text variant="bodyS" color={color.text.secondary}>
              Carré, 500 × 500 px minimum · optionnel
            </Text>
          </View>
        </View>

        <TextField
          label="Nom de la boutique"
          value={name}
          onChangeText={setName}
          placeholder="Ex. JBL Store Kin"
          autoCapitalize="words"
          error={touched && name.trim().length < 2 ? 'Indique le nom de ta boutique.' : undefined}
        />
        <View style={{ gap: space.xs }}>
          <SelectField label="Catégorie principale" value={category} placeholder="Choisis une catégorie" options={SHOP_CATEGORIES} onChange={setCategory} />
          {touched && !category ? <FieldError icon={Tag}>Choisis la catégorie principale.</FieldError> : null}
        </View>
        <View style={{ gap: space.xs }}>
          <SelectField label="Commune" value={commune} placeholder="Choisis ta commune" options={communes} onChange={setCommune} />
          {touched && !commune ? <FieldError icon={MapPin}>Choisis ta commune.</FieldError> : null}
        </View>
        <View style={{ gap: space.xs }}>
          <TextField
            label="Adresse de collecte"
            value={address}
            onChangeText={setAddress}
            placeholder="Avenue, numéro, quartier"
            error={touched && address.trim().length < 5 ? 'Indique l’adresse où le livreur récupère les colis.' : undefined}
          />
          <View style={styles.hint}>
            <Navigation size={14} color={color.icon.secondary} strokeWidth={2} />
            <Text variant="bodyS" color={color.text.secondary}>
              Le livreur récupère les colis à cette adresse.
            </Text>
          </View>
        </View>
        {state.lastError?.code === 'INVALID_PROFILE' ? <Text variant="bodyS" color={color.text.danger}>{state.lastError.message}</Text> : null}
      </Content>
      <BottomBar>
        <Button label={editing ? 'Enregistrer' : 'Continuer'} leadingIcon={editing ? Store : undefined} haptic="medium" onPress={submit} fill />
      </BottomBar>
    </Screen>
  );
}

function FieldError({ children, icon: Icon }: { children: string; icon: typeof Tag }) {
  return (
    <View style={styles.hint}>
      <Icon size={14} color={color.icon.danger} strokeWidth={2} />
      <Text variant="bodyS" color={color.text.danger}>
        {children}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  hint: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
});
