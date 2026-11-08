import { Image } from 'expo-image';
import { router } from 'expo-router';
import { ArrowDown, ArrowUp, LayoutGrid, ListOrdered, Plus } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSeller } from '@/store/useSeller';
import { pressScale } from '@/theme/motion';
import { color, radius, space } from '@/theme/tokens';
import { Button } from '@/ui/Button';
import { useSellerCatalog } from '@/ui/Content';
import { BottomBar, Content, Screen } from '@/ui/Layout';
import { PressableScale } from '@/ui/Pressable';
import { EmptyState } from '@/ui/Seller';
import { useRefusal } from '@/ui/SocialSheets';
import { Text } from '@/ui/Text';
import { TopAppBar } from '@/ui/TopAppBar';

/** SV12 · Mes collections. */
export default function Collections() {
  const { state, shop, dispatch } = useSeller();
  const { byId } = useSellerCatalog();
  const stamp = useRefusal();
  const { width } = useWindowDimensions();
  const [ordering, setOrdering] = useState(false);
  const w = Math.floor((width - space.screen * 2 - space.md) / 2);
  const list = Object.values(state.content.collections)
    .filter((c) => c.shopId === shop?.shopId)
    .sort((a, b) => a.position - b.position);

  return (
    <Screen>
      <TopAppBar title="Mes collections" />
      <Content>
        <Text variant="bodyS" color={color.text.secondary}>
          Elles apparaissent dans l’onglet Collections de ta boutique, dans cet ordre.
        </Text>
        {list.length === 0 ? (
          <EmptyState icon={LayoutGrid} title="Aucune collection" body="Regroupe tes produits (Sono de fête, Petits prix…) pour aider les acheteurs à choisir." />
        ) : ordering ? (
          <View style={{ gap: space.sm }}>
            {list.map((c, i) => (
              <View key={c.id} style={styles.orderRow}>
                <Text variant="labelL" style={{ flex: 1 }}>
                  {c.name}
                </Text>
                <PressableScale accessibilityLabel={`Monter ${c.name}`} disabled={i === 0} onPress={() => dispatch({ type: 'collection/move', id: c.id, by: -1, at: stamp() })} scaleTo={pressScale.icon} style={[styles.move, i === 0 && styles.off]}>
                  <ArrowUp size={20} color={color.icon.primary} strokeWidth={2} />
                </PressableScale>
                <PressableScale accessibilityLabel={`Descendre ${c.name}`} disabled={i === list.length - 1} onPress={() => dispatch({ type: 'collection/move', id: c.id, by: 1, at: stamp() })} scaleTo={pressScale.icon} style={[styles.move, i === list.length - 1 && styles.off]}>
                  <ArrowDown size={20} color={color.icon.primary} strokeWidth={2} />
                </PressableScale>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.grid}>
            {list.map((c) => {
              const cover = c.cover ?? byId(c.productIds[0] ?? '')?.photos[0];
              return (
                <PressableScale key={c.id} accessibilityRole="button" accessibilityLabel={`${c.name}, ${c.productIds.length} produits`} onPress={() => router.push({ pathname: '/vendeur/collections/edition', params: { id: c.id } })} scaleTo={pressScale.card} style={{ width: w, gap: space.xs }}>
                  <View style={[styles.cover, { height: w }]}>{cover ? <Image source={cover} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}</View>
                  <Text variant="labelL" numberOfLines={1}>
                    {c.name}
                  </Text>
                  <Text variant="bodyS" color={c.status === 'draft' ? color.text.warning : color.text.secondary}>
                    {`${c.status === 'draft' ? 'Brouillon · ' : ''}${c.productIds.length} produit${c.productIds.length > 1 ? 's' : ''}`}
                  </Text>
                </PressableScale>
              );
            })}
          </View>
        )}
        {list.length > 1 ? <Button label={ordering ? 'Terminer' : 'Réordonner les collections'} variant="outline" leadingIcon={ListOrdered} onPress={() => setOrdering(!ordering)} fill /> : null}
      </Content>
      <BottomBar>
        <Button label="Nouvelle collection" leadingIcon={Plus} onPress={() => router.push('/vendeur/collections/edition')} fill />
      </BottomBar>
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  cover: { borderRadius: radius.lg, overflow: 'hidden', backgroundColor: color.bg.surfaceSunken },
  orderRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, backgroundColor: color.bg.surface, borderRadius: radius.md, padding: space.md },
  move: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: color.bg.surfaceSunken, alignItems: 'center', justifyContent: 'center' },
  off: { opacity: 0.4 },
});
