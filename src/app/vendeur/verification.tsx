import { router } from 'expo-router';
import { FileText, Lock } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { kycError, shopArea } from '@/domain/seller';
import { useSeller } from '@/store/useSeller';
import { color, space } from '@/theme/tokens';
import { Button } from '@/ui/Button';
import { Alert, useToast } from '@/ui/Feedback';
import { TextField } from '@/ui/Form';
import { BottomBar, Content, Screen } from '@/ui/Layout';
import { haptic } from '@/ui/Pressable';
import { AddPhotoTile } from '@/ui/PhotoPicker';
import { PhotoTile, Steps } from '@/ui/Seller';
import { Text } from '@/ui/Text';
import { TopAppBar } from '@/ui/TopAppBar';
import type { Photo } from '@/domain/seller';

/** V2 · Vérification d’identité (étape 2 sur 3). */
export default function IdentityCheck() {
  const { account, shop, dispatch } = useSeller();
  const toast = useToast();
  const [idFront, setIdFront] = useState<Photo | undefined>(shop?.kyc?.idDoc);
  const [idBack, setIdBack] = useState<Photo | undefined>(undefined);
  const [selfie, setSelfie] = useState<Photo | undefined>(shop?.kyc?.selfie);
  const [rccm, setRccm] = useState(shop?.kyc?.rccm ?? '');
  const [phone, setPhone] = useState(account?.phone ? account.phone.replace(/^\+243/, '').replace(/^(\d{2})(\d{3})(\d{4})$/, '$1 $2 $3') : '');
  const [sending, setSending] = useState(false);

  if (!shop) {
    return (
      <Screen>
        <TopAppBar title="Ouvrir ma boutique" background={color.bg.canvas} />
        <Content>
          <Text variant="bodyM" color={color.text.secondary}>
            Présente d’abord ta boutique.
          </Text>
          <Button label="Présenter ma boutique" onPress={() => router.replace('/vendeur/creer')} fill />
        </Content>
      </Screen>
    );
  }

  const kyc = { idDoc: idFront, selfie, rccm, payoutPhone: phone };
  const error = kycError(kyc);

  const submit = () => {
    if (error) {
      haptic('warning');
      toast(error, 'danger');
      return;
    }
    setSending(true);
    // Short upload state so the documents never look "instantly" checked.
    setTimeout(() => {
      dispatch({ type: 'seller/submitKyc', kyc });
      setSending(false);
      haptic('success');
      router.replace('/vendeur/statut');
    }, 700);
  };

  return (
    <Screen>
      <TopAppBar title="Ouvrir ma boutique" background={color.bg.canvas} />
      <Content gap={space.xl} top={space.sm}>
        <Steps count={3} step={2} label="Vérification" />
        <View style={{ gap: space.xs }}>
          <Text variant="h2" accessibilityRole="header">
            Vérifie ton identité
          </Text>
          <Text variant="bodyM" color={color.text.secondary}>
            Obligatoire pour vendre sur YA YO et recevoir tes paiements.
          </Text>
        </View>

        <View style={{ gap: space.sm }}>
          <Text variant="labelM">Pièce d’identité (carte d’électeur, passeport)</Text>
          <View style={styles.photos}>
            {idFront ? <PhotoTile photo={idFront} label="Recto de la pièce" onRemove={() => setIdFront(undefined)} /> : <AddPhotoTile title="Recto de la pièce" label="Recto" onPick={setIdFront} />}
            {idBack ? <PhotoTile photo={idBack} label="Verso de la pièce" onRemove={() => setIdBack(undefined)} /> : <AddPhotoTile title="Verso de la pièce" label="Verso" onPick={setIdBack} />}
          </View>
        </View>

        <View style={{ gap: space.sm }}>
          <Text variant="labelM">Selfie avec la pièce</Text>
          {selfie ? <PhotoTile photo={selfie} label="Selfie avec la pièce" onRemove={() => setSelfie(undefined)} /> : <AddPhotoTile title="Selfie avec la pièce" onPick={setSelfie} />}
        </View>

        <TextField label="N° RCCM ou patente (facultatif)" value={rccm} onChangeText={setRccm} placeholder="CD/KIN/RCCM/24-A-01234" autoCapitalize="characters" muted />
        <TextField
          label="Numéro Mobile Money pour les virements"
          prefix="phone-cd"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          inputMode="tel"
          placeholder="81 234 5678"
          maxLength={12}
        />
        <Alert tone="info" icon={Lock} title="Données protégées" body="Tes documents servent uniquement à la vérification. Les acheteurs ne les voient jamais." />
        <View style={styles.note}>
          <FileText size={14} color={color.icon.secondary} strokeWidth={2} />
          <Text variant="bodyS" color={color.text.secondary} style={{ flex: 1 }}>
            Boutique : {shop.profile.name} · {shopArea(shop.profile)}
          </Text>
        </View>
      </Content>
      <BottomBar>
        <Button label="Envoyer pour vérification" haptic="medium" loading={sending} onPress={submit} fill />
      </BottomBar>
    </Screen>
  );
}

const styles = StyleSheet.create({
  photos: { flexDirection: 'row', gap: space.sm },
  note: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
});
