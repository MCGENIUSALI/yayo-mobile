import { router, useLocalSearchParams } from 'expo-router';
import { Plus, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { COLLECTION_MAX, COLLECTION_MIN, collectionError } from '@/domain/content';
import type { Photo } from '@/domain/seller';
import { useSeller } from '@/store/useSeller';
import { pressScale } from '@/theme/motion';
import { color, space } from '@/theme/tokens';
import { Button } from '@/ui/Button';
import { LinkedProductRow, ProductPickerSheet, useSellerCatalog } from '@/ui/Content';
import { Alert, useToast } from '@/ui/Feedback';
import { TextField } from '@/ui/Form';
import { BottomBar, Content, Screen } from '@/ui/Layout';
import { PressableScale } from '@/ui/Pressable';
import { AddPhotoTile, PhotoTile } from '@/ui/Seller';
import { useRefusal } from '@/ui/SocialSheets';
import { Text } from '@/ui/Text';
import { TopAppBar } from '@/ui/TopAppBar';

/** SV13 · Créer (ou modifier) une collection. */
export default function EditCollection() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { state, dispatch } = useSeller();
  const { byId } = useSellerCatalog();
  const toast = useToast();
  const stamp = useRefusal();
  const existing = id ? state.content.collections[id] : undefined;
  const [name, setName] = useState(existing?.name ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [cover, setCover] = useState<Photo | undefined>(existing?.cover);
  const [productIds, setProductIds] = useState<string[]>(existing?.productIds ?? []);
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = (status: 'published' | 'draft') => {
    const err = status === 'published' ? collectionError({ name, productIds }) : name.trim().length < 2 ? 'Donne un nom à ta collection.' : null;
    if (err) return setError(err);
    dispatch({ type: 'collection/save', id: existing?.id, name, description, cover, productIds, status, at: stamp() });
    toast(status === 'draft' ? 'Collection gardée en brouillon.' : existing ? 'Collection mise à jour.' : 'Collection créée.', 'success');
    router.back();
  };
  const move = (i: number, by: -1 | 1) => {
    const next = [...productIds];
    const j = i + by;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j]!, next[i]!];
    setProductIds(next);
  };

  return (
    <Screen>
      <TopAppBar
        title={existing ? 'Modifier la collection' : 'Nouvelle collection'}
        action={
          existing
            ? {
                icon: Trash2,
                label: 'Supprimer la collection',
                onPress: () => {
                  dispatch({ type: 'collection/delete', id: existing.id, at: stamp() });
                  toast('Collection supprimée.', 'success');
                  router.back();
                },
              }
            : undefined
        }
      />
      <Content>
        <View style={styles.coverRow}>
          {cover ? <PhotoTile photo={cover} size={96} label="Couverture" onRemove={() => setCover(undefined)} /> : <AddPhotoTile size={96} title="Couverture de la collection" onPick={setCover} />}
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="labelL">Couverture</Text>
            <Text variant="bodyS" color={color.text.secondary}>
              Format carré, une photo de tes produits ensemble. Sans couverture, la photo du premier produit est utilisée.
            </Text>
          </View>
        </View>
        <TextField label="Nom" placeholder="Sono de fête" value={name} maxLength={40} onChangeText={(t) => { setName(t); setError(null); }} />
        <TextField label="Description" placeholder="Tout pour animer tes soirées, livré à Kinshasa" value={description} maxLength={120} onChangeText={setDescription} />
        <View style={styles.between}>
          <Text variant="h4">{`Produits (${productIds.length})`}</Text>
          {productIds.length < COLLECTION_MAX ? (
            <PressableScale accessibilityRole="button" onPress={() => setPicking(true)} scaleTo={pressScale.icon} style={styles.add}>
              <Plus size={18} color={color.icon.primary} strokeWidth={2} />
              <Text variant="labelM">Ajouter</Text>
            </PressableScale>
          ) : null}
        </View>
        {productIds.map((pid, i) => {
          const p = byId(pid);
          return p ? (
            <View key={pid} style={{ gap: space.xs }}>
              <LinkedProductRow product={p} onRemove={() => setProductIds(productIds.filter((x) => x !== pid))} />
              {productIds.length > 1 ? (
                <View style={styles.order}>
                  <Button label="Monter" size="S" variant="ghost" disabled={i === 0} onPress={() => move(i, -1)} />
                  <Button label="Descendre" size="S" variant="ghost" disabled={i === productIds.length - 1} onPress={() => move(i, 1)} />
                </View>
              ) : null}
            </View>
          ) : null;
        })}
        <Text variant="caption" color={color.text.tertiary}>{`${COLLECTION_MIN} à ${COLLECTION_MAX} produits`}</Text>
        {error ? <Alert tone="danger" title="Il manque une information" body={error} /> : null}
      </Content>
      <BottomBar>
        <View style={styles.footer}>
          <Button label="Brouillon" variant="outline" onPress={() => save('draft')} style={{ flex: 1 }} />
          <Button label={existing ? 'Enregistrer' : 'Créer la collection'} onPress={() => save('published')} style={{ flex: 2 }} />
        </View>
      </BottomBar>
      <ProductPickerSheet
        visible={picking}
        selected={productIds}
        max={COLLECTION_MAX}
        title="Ajouter des produits"
        note={`Tes produits en ligne et en stock (${COLLECTION_MAX} maximum).`}
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
  add: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  order: { flexDirection: 'row', justifyContent: 'flex-end', gap: space.sm },
  footer: { flex: 1, flexDirection: 'row', gap: space.md },
});
