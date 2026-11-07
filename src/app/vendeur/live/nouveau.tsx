import { router } from 'expo-router';
import { Link2, ShieldCheck } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { MAX_LINKED_PRODUCTS, newDraft, scheduleError } from '@/domain/content';
import type { Photo } from '@/domain/seller';
import { useSeller } from '@/store/useSeller';
import { pressScale } from '@/theme/motion';
import { color, space } from '@/theme/tokens';
import { Button } from '@/ui/Button';
import { DateTimeFields, LinkedProductRow, ProductPickerSheet, toIso, useSellerCatalog } from '@/ui/Content';
import { Alert, useToast } from '@/ui/Feedback';
import { TextField } from '@/ui/Form';
import { BottomBar, Content, Screen } from '@/ui/Layout';
import { PressableScale } from '@/ui/Pressable';
import { AddPhotoTile, PhotoTile, SwitchRow } from '@/ui/Seller';
import { useRefusal } from '@/ui/SocialSheets';
import { Text } from '@/ui/Text';
import { TopAppBar } from '@/ui/TopAppBar';

/** SV16 · Programmer un live. */
export default function ScheduleLive() {
  const { shop, dispatch } = useSeller();
  const { byId } = useSellerCatalog();
  const toast = useToast();
  const stamp = useRefusal();
  const [cover, setCover] = useState<Photo | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [day, setDay] = useState(1);
  const [time, setTime] = useState('19:00');
  const [productIds, setProductIds] = useState<string[]>([]);
  const [notify, setNotify] = useState(true);
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const startsAt = toIso(day, time);

  const submit = () => {
    if (title.trim().length < 3) return setError('Donne un titre à ton live.');
    if (!startsAt) return setError('Indique l’heure au format 19:00.');
    const err = scheduleError(startsAt, new Date().toISOString());
    if (err) return setError(err);
    if (!productIds.length) return setError('Ajoute les produits que tu présentes.');
    dispatch({
      type: 'content/save',
      draft: { ...newDraft('live'), media: cover ? [cover] : [], productIds, caption: description, live: { title, description, startsAt, notify } },
      mode: 'publish',
      at: stamp(),
    });
    toast('Live programmé.', 'success');
    router.back();
  };

  return (
    <Screen>
      <TopAppBar title="Programmer un live" />
      <Content gap={space.xl}>
        <View style={styles.coverRow}>
          {cover ? <PhotoTile photo={cover} size={96} label="Affiche du live" onRemove={() => setCover(null)} /> : <AddPhotoTile size={96} title="Affiche du live" onPick={setCover} />}
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="labelL">Affiche du live</Text>
            <Text variant="bodyS" color={color.text.secondary}>
              Format 9:16, affichée sur ta boutique
            </Text>
          </View>
        </View>
        <TextField label="Titre du live" placeholder="Soirée JBL : -15 % en direct" value={title} maxLength={60} onChangeText={(t) => { setTitle(t); setError(null); }} />
        <DateTimeFields day={day} time={time} onDay={(d) => { setDay(d); setError(null); }} onTime={(t) => { setTime(t); setError(null); }} />
        <TextField label="Description" placeholder="Nouveautés et offres réservées aux spectateurs" value={description} multiline maxLength={200} onChangeText={setDescription} />
        <View style={{ gap: space.sm }}>
          <View style={styles.between}>
            <Text variant="h4">{`Produits présentés (${productIds.length})`}</Text>
            {productIds.length < MAX_LINKED_PRODUCTS ? (
              <PressableScale accessibilityRole="button" onPress={() => setPicking(true)} scaleTo={pressScale.icon} style={styles.link}>
                <Link2 size={18} color={color.icon.primary} strokeWidth={2} />
                <Text variant="labelM">Ajouter</Text>
              </PressableScale>
            ) : null}
          </View>
          {productIds.map((id) => {
            const p = byId(id);
            return p ? <LinkedProductRow key={id} product={p} onRemove={() => setProductIds(productIds.filter((x) => x !== id))} /> : null;
          })}
        </View>
        <SwitchRow title="Notifier mes abonnés" subtitle="Alerte automatique 15 min avant le début (avec le serveur YA YO)" value={notify} onChange={setNotify} />
        <Alert tone="escrow" icon={ShieldCheck} title="Les commandes du live passent par le séquestre" body="Tu es payé quand l’acheteur confirme la réception, comme pour toute commande." />
        {shop?.status !== 'verified' ? <Alert tone="warning" title="Termine ta vérification" body="Seules les boutiques vérifiées peuvent programmer un live." /> : null}
        {error ? <Alert tone="danger" title="Il manque une information" body={error} /> : null}
      </Content>
      <BottomBar>
        <Button label="Programmer le live" disabled={shop?.status !== 'verified'} onPress={submit} fill />
      </BottomBar>
      <ProductPickerSheet
        visible={picking}
        selected={productIds}
        onClose={() => setPicking(false)}
        onDone={(ids) => {
          setProductIds(ids);
          setPicking(false);
          setError(null);
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  coverRow: { flexDirection: 'row', gap: space.lg, alignItems: 'center' },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  link: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
});
