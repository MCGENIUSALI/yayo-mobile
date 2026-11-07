import { router } from 'expo-router';
import { Headphones, Heart, House, Shirt, Smartphone, Sparkles, Star, Tag, Cable, type LucideIcon } from 'lucide-react-native';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { getShop } from '@/domain/catalog';
import { formatFC, formatUSD } from '@/domain/money';
import { discountPercent, type CategoryId } from '@/domain/search';
import type { Product } from '@/domain/types';
import { useStore } from '@/store/AppStore';
import { duration, pressScale } from '@/theme/motion';
import { color, radius, space } from '@/theme/tokens';
import { ProductImage } from './Commerce';
import { useEnter } from './Feedback';
import { PressableScale } from './Pressable';
import { Text } from './Text';

/** Category icons of E3 and of the B1 shortcuts. */
export const categoryIcon: Record<CategoryId, LucideIcon> = {
  electronique: Smartphone,
  mode: Shirt,
  beaute: Sparkles,
  maison: House,
  audio: Headphones,
  accessoires: Cable,
  promos: Tag,
};

/** Grid geometry shared by B2, B5 and E5: two columns, Figma screen padding, 12 px gutter. */
export function gridCardWidth(screenWidth: number) {
  return Math.floor((screenWidth - space.screen * 2 - space.md) / 2);
}

/* ---------- Wishlist heart ---------- */

export function useWishlist(productId: string) {
  const { state, dispatch } = useStore();
  const on = state.social.wishlist.includes(productId);
  const toggle = () => dispatch({ type: 'social/toggle', list: 'wishlist', id: productId });
  return { on, toggle };
}

export function WishlistButton({
  productId,
  name,
  size = 36,
  tone = 'card',
}: {
  productId: string;
  name: string;
  size?: number;
  /** card: white tile on a photo (B2); bar: Icon Button of the top bar (B4). */
  tone?: 'card' | 'bar';
}) {
  const { on, toggle } = useWishlist(productId);
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={on ? `Retirer ${name} des favoris` : `Ajouter ${name} aux favoris`}
      accessibilityState={{ selected: on }}
      onPress={toggle}
      haptic="light"
      scaleTo={pressScale.icon}
      hitSlop={6}
      style={[styles.heart, tone === 'bar' && styles.heartBar, { width: size, height: size }]}
    >
      <Heart size={20} strokeWidth={2} color={on ? color.icon.danger : color.icon.primary} fill={on ? color.icon.danger : 'transparent'} />
    </PressableScale>
  );
}

/* ---------- Stars (Rating 997:288, size S) ---------- */

export function StarsS({ value }: { value: number }) {
  return (
    <View style={styles.stars} accessibilityLabel={`Note ${value.toLocaleString('fr-FR')} sur 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} size={14} strokeWidth={2} color={color.icon.warning} fill={value >= i - 0.25 ? color.icon.warning : 'transparent'} />
      ))}
      <Text variant="labelS" style={{ marginLeft: space.xs }}>
        {value.toLocaleString('fr-FR')}
      </Text>
    </View>
  );
}

/* ---------- Product card · grid (Product Card 1000:325, B2/B5) ---------- */

export function ProductGridCard({ product, width, index = 0 }: { product: Product; width: number; index?: number }) {
  const entering = useEnter(index);
  const discount = discountPercent(product);
  const out = product.stock <= 0;
  const shop = getShop(product.shopId);
  return (
    <Animated.View entering={entering} style={{ width }}>
      <PressableScale
        accessibilityLabel={`${product.shortName}, ${shop.name}, ${formatFC(product.price)}${out ? ', en rupture' : ''}`}
        accessibilityHint="Ouvre la fiche produit"
        onPress={() => router.push({ pathname: '/produit/[id]', params: { id: product.id } })}
        scaleTo={pressScale.card}
        style={styles.card}
      >
        <View style={[styles.media, { height: Math.round(width * 1.02) }]}>
          <ProductImage product={product} rounded={0} style={StyleSheet.absoluteFill} />
          {discount > 0 ? (
            <View style={styles.discount}>
              <Text variant="labelS" color={color.text.accent}>
                -{discount} %
              </Text>
            </View>
          ) : null}
          {out ? (
            <View style={styles.out}>
              <Text variant="labelS" color={color.text.inverse}>
                Rupture
              </Text>
            </View>
          ) : null}
        </View>
        <View style={styles.body}>
          <Text variant="bodyS" color={color.text.secondary} numberOfLines={1}>
            {shop.name}
          </Text>
          <Text variant="labelL" numberOfLines={2} style={styles.name}>
            {product.shortName}
          </Text>
          <StarsS value={product.rating} />
          <View style={styles.priceRow}>
            <Text variant="priceM">{formatFC(product.price)}</Text>
            {product.compareAt ? (
              <Text variant="priceStrike" color={color.text.tertiary} style={styles.strike} numberOfLines={1}>
                {formatFC(product.compareAt)}
              </Text>
            ) : null}
          </View>
          <Text variant="caption" color={color.text.tertiary}>
            {formatUSD(product.price)}
          </Text>
        </View>
      </PressableScale>
      {/* Sibling of the card so that the heart never triggers navigation. */}
      <View style={styles.heartWrap}>
        <WishlistButton productId={product.id} name={product.shortName} />
      </View>
    </Animated.View>
  );
}

export function ProductGrid({ items, width }: { items: Product[]; width: number }) {
  const w = gridCardWidth(width);
  return (
    <View style={styles.grid}>
      {items.map((p, i) => (
        <ProductGridCard key={p.id} product={p} width={w} index={i} />
      ))}
    </View>
  );
}

/* ---------- E2 · Chargement (skeleton) ---------- */

export function GridSkeleton({ width, count = 4 }: { width: number; count?: number }) {
  const w = gridCardWidth(width);
  const reduced = useReducedMotion();
  const pulse = useSharedValue(1);
  useEffect(() => {
    if (!reduced) pulse.set(withRepeat(withTiming(0.55, { duration: duration.slow * 2 }), -1, true));
  }, [pulse, reduced]);
  const style = useAnimatedStyle(() => ({ opacity: pulse.value }));
  return (
    <Animated.View style={[styles.grid, style]} accessibilityLabel="Chargement des produits" accessibilityRole="progressbar">
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={[styles.card, { width: w }]}>
          <View style={[styles.skelMedia, { width: w, height: Math.round(w * 1.02) }]} />
          <View style={styles.body}>
            <View style={[styles.bone, { width: '50%' }]} />
            <View style={[styles.bone, { width: '90%', height: 16 }]} />
            <View style={[styles.bone, { width: '60%' }]} />
            <View style={[styles.bone, { width: '70%', height: 18 }]} />
          </View>
        </View>
      ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  card: { backgroundColor: color.bg.surface, borderRadius: radius.lg, overflow: 'hidden' },
  media: { backgroundColor: color.bg.surfaceSunken },
  discount: {
    position: 'absolute',
    top: space.sm,
    left: space.sm,
    paddingHorizontal: space.sm,
    height: 24,
    borderRadius: radius.sm,
    backgroundColor: color.bg.accentSubtle,
    justifyContent: 'center',
  },
  out: {
    position: 'absolute',
    bottom: space.sm,
    left: space.sm,
    paddingHorizontal: space.sm,
    height: 24,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(10,10,11,0.72)',
    justifyContent: 'center',
  },
  heartWrap: { position: 'absolute', top: space.sm, right: space.sm },
  heart: { borderRadius: radius.sm, backgroundColor: color.bg.surface, alignItems: 'center', justifyContent: 'center' },
  heartBar: { borderRadius: radius.md, backgroundColor: color.bg.surfaceSunken },
  body: { padding: space.md, gap: space.xs },
  name: { minHeight: 48 },
  stars: { flexDirection: 'row', alignItems: 'center', gap: 1 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm, flexWrap: 'wrap' },
  strike: { textDecorationLine: 'line-through' },
  skelMedia: { backgroundColor: color.bg.surfaceSunken },
  bone: { height: 12, borderRadius: radius.sm, backgroundColor: color.bg.surfaceSunken },
});
