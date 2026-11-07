import { router } from 'expo-router';
import { Check, Lock } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { docsError, requiredDocs, type CourierDocs, type DocKey } from '@/domain/courier';
import type { Photo } from '@/domain/seller';
import { useCourier } from '@/store/useCourier';
import { color, radius, space } from '@/theme/tokens';
import { Button } from '@/ui/Button';
import { Alert, useToast } from '@/ui/Feedback';
import { BottomBar, Content, Screen } from '@/ui/Layout';
import { haptic } from '@/ui/Pressable';
import { AddPhotoTile, PhotoTile, Steps } from '@/ui/Seller';
import { Badge } from '@/ui/Status';
import { Text } from '@/ui/Text';
import { TopAppBar } from '@/ui/TopAppBar';

/** L2 · Documents KYC (étape 2 sur 2). Also replaces a refused document from L3. */
export default function CourierDocuments() {
  const { space: courier, dispatch } = useCourier();
  const toast = useToast();
  const [docs, setDocs] = useState<CourierDocs>(courier?.docs ?? {});
  const [sending, setSending] = useState(false);

  if (!courier) {
    return (
      <Screen>
        <TopAppBar title="Devenir livreur" />
        <Content>
          <Text variant="bodyM" color={color.text.secondary}>
            Parle-nous d’abord de toi et de ton véhicule.
          </Text>
          <Button label="Commencer" onPress={() => router.replace('/livreur/inscription')} fill />
        </Content>
      </Screen>
    );
  }

  const specs = requiredDocs(courier.profile.transport);
  const set = (key: DocKey, photo: Photo | undefined) => setDocs((d) => ({ ...d, [key]: photo }));
  const error = docsError(courier.profile.transport, docs);

  const submit = () => {
    if (error) {
      haptic('warning');
      toast(error, 'danger');
      return;
    }
    setSending(true);
    // Short upload state so the documents never look "instantly" checked.
    setTimeout(() => {
      dispatch({ type: 'courier/submitDocs', docs });
      setSending(false);
      haptic('success');
      router.replace('/livreur/statut');
    }, 700);
  };

  return (
    <Screen>
      <TopAppBar title="Devenir livreur" />
      <Content gap={space.xl} top={space.sm}>
        <Steps count={2} step={2} label="Documents" />
        <View style={{ gap: space.xs }}>
          <Text variant="h2" accessibilityRole="header">
            Vérification d’identité
          </Text>
          <Text variant="bodyM" color={color.text.secondary}>
            Obligatoire : l’équipe YA YO valide chaque livreur avant sa première mission.
          </Text>
        </View>

        <View style={{ gap: space.lg }}>
          {specs.map((d) => {
            const photo = docs[d.key];
            return (
              <View key={d.key} style={styles.doc}>
                {photo ? <PhotoTile photo={photo} label={d.title} onRemove={() => set(d.key, undefined)} /> : <AddPhotoTile title={d.title} onPick={(p) => set(d.key, p)} />}
                <View style={styles.flex}>
                  <Text variant="labelL">{d.title}</Text>
                  <Text variant="bodyS" color={color.text.secondary}>
                    {d.hint}
                  </Text>
                  <View style={{ marginTop: space.xs }}>{photo ? <Badge label="Ajouté" icon={Check} tone="success" /> : <Badge label="À ajouter" />}</View>
                </View>
              </View>
            );
          })}
        </View>

        <Alert tone="info" icon={Lock} title="Données protégées" body="Tes documents servent uniquement à la vérification. Les clients et les vendeurs ne les voient jamais." />
      </Content>
      <BottomBar>
        <Button label={courier.status === 'draft' ? 'Envoyer pour validation' : 'Envoyer les documents'} haptic="medium" loading={sending} onPress={submit} fill />
      </BottomBar>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0, gap: 2 },
  doc: { flexDirection: 'row', alignItems: 'center', gap: space.lg, borderRadius: radius.lg },
});
