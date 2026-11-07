import { router, useLocalSearchParams } from 'expo-router';
import { Info } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { INCIDENT_REASONS, missionStage } from '@/domain/courier';
import type { Photo } from '@/domain/seller';
import type { IncidentReason } from '@/domain/types';
import { useCourier } from '@/store/useCourier';
import { pressScale } from '@/theme/motion';
import { color, radius, space } from '@/theme/tokens';
import { Button } from '@/ui/Button';
import { Alert, useToast } from '@/ui/Feedback';
import { Radio } from '@/ui/Form';
import { BottomBar, Content, Screen } from '@/ui/Layout';
import { haptic, PressableScale } from '@/ui/Pressable';
import { AddPhotoTile, PhotoTile } from '@/ui/Seller';
import { Text } from '@/ui/Text';
import { TopAppBar } from '@/ui/TopAppBar';

/** L9 · Incident de livraison: client absent, refus, adresse, colis endommagé. */
export default function DeliveryIncident() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { missions, dispatch } = useCourier();
  const toast = useToast();
  const [reason, setReason] = useState<IncidentReason>('absent');
  const [photo, setPhoto] = useState<Photo | undefined>(undefined);
  const order = missions.find((o) => o.id === id);
  const stage = order ? missionStage(order) : undefined;

  if (!order || (stage !== 'delivery' && stage !== 'handover')) {
    return (
      <Screen>
        <TopAppBar title="Impossible de livrer" onBack={() => router.navigate('/livreur/missions')} />
        <Content>
          <Text variant="bodyM" color={color.text.secondary}>
            Un incident se déclare pendant la livraison.
          </Text>
          <Button label="Mes missions" onPress={() => router.navigate('/livreur/missions')} fill />
        </Content>
      </Screen>
    );
  }

  const submit = () => {
    if (!photo) {
      haptic('warning');
      toast('Ajoute une photo du lieu comme preuve de passage.', 'danger');
      return;
    }
    dispatch({ type: 'courier/orderEvent', orderId: order.id, event: { type: 'courier.report_incident', reason, photo } });
    haptic('warning');
    toast('Échec déclaré. YA YO prévient le client.', 'success');
    if (router.canDismiss()) router.dismissAll();
    router.navigate('/livreur/accueil');
  };

  return (
    <Screen>
      <TopAppBar title="Impossible de livrer" />
      <Content gap={space.xl} top={space.sm}>
        <View style={{ gap: space.md }} accessibilityRole="radiogroup">
          <Text variant="h4" accessibilityRole="header">
            Que s’est-il passé ?
          </Text>
          {INCIDENT_REASONS.map((r) => {
            const on = r.value === reason;
            return (
              <PressableScale
                key={r.value}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                onPress={() => setReason(r.value)}
                haptic="selection"
                scaleTo={pressScale.card}
                style={[styles.option, on ? styles.optionOn : null]}
              >
                <Radio checked={on} />
                <Text variant="labelL" style={{ flex: 1 }}>
                  {r.label}
                </Text>
              </PressableScale>
            );
          })}
        </View>

        <View style={{ gap: space.sm }}>
          <Text variant="labelM">Preuve de passage (photo du lieu)</Text>
          {photo ? <PhotoTile photo={photo} label="Photo du lieu" onRemove={() => setPhoto(undefined)} /> : <AddPhotoTile title="Photo du lieu" onPick={setPhoto} />}
        </View>

        <Alert tone="info" icon={Info} title="Et ensuite ?" body="YA YO prévient le client. Selon le cas : nouvelle tentative, retour au vendeur ou remboursement. Garde le colis jusqu’à la consigne de YA YO." />
      </Content>
      <BottomBar>
        <Button label="Déclarer l’échec" variant="destructive" haptic="warning" onPress={submit} fill />
      </BottomBar>
    </Screen>
  );
}

const styles = StyleSheet.create({
  option: { flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: color.bg.surface, borderRadius: radius.md, borderWidth: 1, borderColor: color.border.subtle, padding: space.lg },
  optionOn: { borderWidth: 2, borderColor: color.border.focus, padding: space.lg - 1 },
});
