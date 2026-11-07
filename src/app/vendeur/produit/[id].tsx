import { router, useLocalSearchParams } from 'expo-router';
import { Info, Trash2, TriangleAlert } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { LOW_STOCK, parseAmount, productInfoError, productPriceError, type ProductDraft } from '@/domain/seller';
import { useSeller } from '@/store/useSeller';
import { color, radius, space } from '@/theme/tokens';
import { Button } from '@/ui/Button';
import { useToast } from '@/ui/Feedback';
import { TextField } from '@/ui/Form';
import { BottomBar, Content, Screen } from '@/ui/Layout';
import { draftOf, groupDigits, PhotoStrip } from '@/ui/ProductForm';
import { haptic } from '@/ui/Pressable';
import { SwitchRow } from '@/ui/Seller';
import { Sheet } from '@/ui/Sheet';
import { Text } from '@/ui/Text';
import { TopAppBar } from '@/ui/TopAppBar';

/** V14 · Modifier un produit + V15 · Supprimer un produit. */
export default function EditProduct() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { shop, dispatch } = useSeller();
  const toast = useToast();
  const product = shop?.products.find((p) => p.id === id);
  const [draft, setDraft] = useState<ProductDraft>(() => draftOf(product));
  const [online, setOnline] = useState(product ? product.status === 'online' : false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const set = (p: Partial<ProductDraft>) => setDraft((d) => ({ ...d, ...p }));

  if (!product) {
    return (
      <Screen>
        <TopAppBar title="Modifier le produit" background={color.bg.canvas} />
        <Content>
          <Text variant="bodyM" color={color.text.secondary}>
            Ce produit n’existe plus.
          </Text>
          <Button label="Mes produits" onPress={() => router.navigate('/vendeur/produits')} fill />
        </Content>
      </Screen>
    );
  }

  const stock = parseAmount(draft.stock);
  const low = stock >= 0 && stock <= LOW_STOCK;

  const save = () => {
    const status = product.status === 'draft' && !online ? 'draft' : online ? 'online' : 'offline';
    const err = productInfoError(draft) ?? (status === 'draft' && !draft.price.trim() ? null : productPriceError(draft));
    if (err) {
      haptic('warning');
      toast(err, 'danger');
      return;
    }
    dispatch({ type: 'seller/saveProduct', id: product.id, draft, status });
    haptic('success');
    toast('Modifications enregistrées.', 'success');
    router.back();
  };

  return (
    <Screen>
      <TopAppBar title="Modifier le produit" background={color.bg.canvas} />
      <Content gap={space.lg} top={space.sm}>
        <SwitchRow
          title="Produit en ligne"
          subtitle={online ? (shop?.status === 'verified' ? 'Visible par les acheteurs' : 'Publié à la validation de ta boutique') : product.status === 'draft' ? 'Brouillon, invisible' : 'Masqué aux acheteurs'}
          value={online}
          onChange={setOnline}
        />
        <PhotoStrip photos={draft.photos} onChange={(photos) => set({ photos })} />
        <TextField label="Nom du produit" value={draft.name} onChangeText={(name) => set({ name })} muted />
        <View style={styles.two}>
          <View style={{ flex: 1 }}>
            <TextField label="Prix (FC)" value={draft.price} onChangeText={(v) => set({ price: groupDigits(v) })} keyboardType="number-pad" inputMode="numeric" muted />
          </View>
          <View style={{ flex: 1 }}>
            <TextField label="Stock" value={draft.stock} onChangeText={(v) => set({ stock: v.replace(/\D/g, '') })} keyboardType="number-pad" inputMode="numeric" />
          </View>
        </View>
        {low ? (
          <View style={styles.warn} accessibilityRole="alert">
            <TriangleAlert size={18} color={color.icon.warning} strokeWidth={2} />
            <View style={{ flex: 1 }}>
              <Text variant="labelM" color={color.text.warning}>
                {stock === 0 ? 'Rupture de stock' : 'Stock faible'}
              </Text>
              <Text variant="bodyS" color={color.text.secondary}>
                {stock === 0 ? 'Le produit reste en ligne mais ne peut plus être acheté.' : 'À 0, le produit passe automatiquement en rupture.'}
              </Text>
            </View>
          </View>
        ) : null}
      </Content>
      <BottomBar>
        <Button label="Enregistrer les modifications" haptic="medium" onPress={save} fill />
        <Button label="Supprimer le produit" variant="ghost" leadingIcon={Trash2} onPress={() => setConfirmDelete(true)} fill />
      </BottomBar>

      <Sheet
        visible={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Supprimer ce produit ?"
        footer={
          <>
            <View style={{ flex: 1 }}>
              <Button label="Annuler" variant="outline" onPress={() => setConfirmDelete(false)} fill />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                label="Supprimer"
                variant="danger"
                haptic="warning"
                onPress={() => {
                  dispatch({ type: 'seller/deleteProduct', id: product.id });
                  setConfirmDelete(false);
                  toast('Produit supprimé.', 'success');
                  router.back();
                }}
                fill
              />
            </View>
          </>
        }
      >
        <Text variant="bodyM" color={color.text.secondary}>
          « {product.name} » sera retiré du catalogue. Les commandes en cours ne sont pas annulées et restent à préparer.
        </Text>
        <View style={styles.alt}>
          <Info size={18} color={color.icon.info} strokeWidth={2} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="labelM" color={color.text.info}>
              Alternative
            </Text>
            <Text variant="bodyS" color={color.text.secondary}>
              Tu peux aussi le mettre hors ligne pour le republier plus tard.
            </Text>
          </View>
        </View>
        {product.status === 'online' ? (
          <Button
            label="Mettre hors ligne"
            variant="outline"
            size="M"
            onPress={() => {
              dispatch({ type: 'seller/setOnline', id: product.id, online: false });
              setOnline(false);
              setConfirmDelete(false);
              toast('Produit mis hors ligne.', 'success');
            }}
            fill
          />
        ) : null}
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  two: { flexDirection: 'row', gap: space.md },
  warn: { flexDirection: 'row', gap: space.md, backgroundColor: color.bg.warningSubtle, borderRadius: radius.md, padding: space.md },
  alt: { flexDirection: 'row', gap: space.md, backgroundColor: color.bg.infoSubtle, borderRadius: radius.md, padding: space.md },
});
