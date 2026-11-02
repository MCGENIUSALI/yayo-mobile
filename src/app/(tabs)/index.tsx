import { router } from 'expo-router';
import { FlatList, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { products, getShop } from '@/domain/catalog';
import { formatFC } from '@/domain/money';
import type { Product } from '@/domain/types';
import { pressScale } from '@/theme/motion';
import { color, radius, space } from '@/theme/tokens';
import { CartButton } from '@/ui/CartButton';
import { ProductImage } from '@/ui/Commerce';
import { useEnter } from '@/ui/Feedback';
import { PressableScale } from '@/ui/Pressable';
import { Badge } from '@/ui/Status';
import { Text } from '@/ui/Text';

function ProductCard({ product, index, width }: { product: Product; index: number; width: number }) {
  const entering = useEnter(index);
  const out = product.stock <= 0;
  return (
    <Animated.View entering={entering} style={{ width }}>
      <PressableScale
        accessibilityLabel={`${product.shortName}, ${formatFC(product.price)}${out ? ', en rupture' : ''}`}
        onPress={() => router.push({ pathname: '/produit/[id]', params: { id: product.id } })}
        scaleTo={pressScale.card}
        style={styles.card}
      >
        <ProductImage product={product} style={{ width: '100%', aspectRatio: 1 }} rounded={radius.md} />
        <View style={{ gap: 2 }}>
          <Text variant="labelM" numberOfLines={2}>
            {product.shortName}
          </Text>
          <Text variant="bodyS" color={color.text.secondary} numberOfLines={1}>
            {getShop(product.shopId).name}
          </Text>
        </View>
        <Text variant="priceS">{formatFC(product.price)}</Text>
        {out ? <Badge label="Rupture" tone="neutral" /> : null}
      </PressableScale>
    </Animated.View>
  );
}

/**
 * Temporary home: catalogue grid. The Figma B1 home + SC1 video feed are the
 * next increment (P1 · Feed de découverte).
 */
export default function Home() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const cardW = (width - space.screen * 2 - space.md) / 2;
  const list = Object.values(products);
  return (
    <View style={[styles.flex, { backgroundColor: color.bg.canvas }]}>
      <View style={[styles.header, { paddingTop: insets.top + space.sm }]}>
        <View style={styles.logo} accessibilityRole="header" accessibilityLabel="YA YO">
          <Text variant="h2">YA</Text>
          <View style={styles.yo}>
            <Text variant="labelM" color={color.text.inverse}>
              YO!
            </Text>
          </View>
        </View>
        <CartButton />
      </View>
      <FlatList
        data={list}
        keyExtractor={(p) => p.id}
        numColumns={2}
        columnWrapperStyle={{ gap: space.md }}
        contentContainerStyle={styles.grid}
        ListHeaderComponent={
          <Text variant="h4" style={{ marginBottom: space.md }}>
            Sélection du moment
          </Text>
        }
        renderItem={({ item, index }) => <ProductCard product={item} index={index} width={cardW} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    backgroundColor: color.bg.surface,
    paddingHorizontal: space.xl,
    paddingBottom: space.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logo: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  yo: { backgroundColor: color.bg.inverse, borderRadius: radius.sm, paddingHorizontal: 6, paddingVertical: 2 },
  grid: { padding: space.screen, gap: space.md },
  card: { backgroundColor: color.bg.surface, borderRadius: radius.lg, padding: space.sm, gap: space.sm },
});
