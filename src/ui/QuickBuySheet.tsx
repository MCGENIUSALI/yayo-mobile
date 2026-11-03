import { router } from 'expo-router';
import { ShoppingCart, X } from 'lucide-react-native';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, SlideInDown, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getProduct } from '@/domain/catalog';
import { formatFC, formatUSD } from '@/domain/money';
import { addToCartError } from '@/domain/state';
import { useStore } from '@/store/AppStore';
import { duration, pressScale, spring } from '@/theme/motion';
import { color, radius, space } from '@/theme/tokens';
import { Button } from './Button';
import { EscrowBanner, ProductImage, QuantityStepper } from './Commerce';
import { Alert, useToast } from './Feedback';
import { haptic, PressableScale } from './Pressable';
import { Text } from './Text';

/**
 * SC2 · Achat rapide depuis une vidéo: pick colour and quantity in a sheet,
 * without leaving the feed. "Ajouter au panier" closes the sheet and the
 * video keeps playing; "Commander" adds and opens the cart.
 */
export function QuickBuySheet({ productId, onClose }: { productId: string | null; onClose: () => void }) {
  return (
    <Modal visible={!!productId} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      {productId ? <SheetBody key={productId} productId={productId} onClose={onClose} /> : null}
    </Modal>
  );
}

function SheetBody({ productId, onClose }: { productId: string; onClose: () => void }) {
  const product = getProduct(productId);
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const { state, dispatch } = useStore();
  const toast = useToast();
  const [colorName, setColorName] = useState(product.colors[0]?.name ?? '');
  const [qty, setQty] = useState(1);
  const out = product.stock <= 0;

  const add = (then: 'stay' | 'cart') => {
    const error = addToCartError(state, product.id, colorName, qty);
    if (error) {
      haptic('warning');
      toast(error, 'danger');
      return;
    }
    dispatch({ type: 'cart/add', productId: product.id, color: colorName, qty });
    haptic('success');
    onClose();
    if (then === 'cart') router.push('/panier');
    else toast('Ajouté au panier', 'success');
  };

  return (
    <View style={styles.fill}>
      <Animated.View entering={reduced ? undefined : FadeIn.duration(duration.base)} style={StyleSheet.absoluteFill}>
        <Pressable accessibilityLabel="Fermer" onPress={onClose} style={[StyleSheet.absoluteFill, styles.backdrop]} />
      </Animated.View>
      <Animated.View
        entering={reduced ? undefined : SlideInDown.springify().damping(spring.sheet.damping).stiffness(spring.sheet.stiffness)}
        style={[styles.sheet, { paddingBottom: insets.bottom + space.lg }]}
        accessibilityViewIsModal
      >
        <View style={styles.grabber} />
        <View style={styles.header}>
          <Text variant="h3" accessibilityRole="header">
            Ajouter au panier
          </Text>
          <PressableScale accessibilityLabel="Fermer" onPress={onClose} scaleTo={pressScale.icon} hitSlop={10} style={styles.close}>
            <X size={24} color={color.icon.primary} strokeWidth={2} />
          </PressableScale>
        </View>

        <View style={styles.product}>
          <ProductImage product={product} size={56} rounded={radius.sm} />
          <View style={styles.flex}>
            <Text variant="labelM" numberOfLines={1}>
              {product.name}
            </Text>
            <View style={styles.row}>
              <Text variant="priceS">{formatFC(product.price)}</Text>
              <Text variant="caption" color={color.text.tertiary}>
                {formatUSD(product.price)}
              </Text>
            </View>
          </View>
          <Button
            label="Voir"
            variant="accent"
            size="S"
            leadingIcon={ShoppingCart}
            onPress={() => {
              onClose();
              router.push({ pathname: '/produit/[id]', params: { id: product.id } });
            }}
          />
        </View>

        {out ? (
          <Alert tone="danger" title="En rupture de stock" body="Ce produit n’est plus disponible pour le moment." />
        ) : (
          <View style={styles.options}>
            <View style={{ gap: space.sm }}>
              <Text variant="labelM">Couleur : {colorName}</Text>
              <View style={styles.swatches} accessibilityRole="radiogroup">
                {product.colors.map((c) => {
                  const selected = c.name === colorName;
                  return (
                    <PressableScale
                      key={c.name}
                      accessibilityRole="radio"
                      accessibilityLabel={c.name}
                      accessibilityState={{ selected, checked: selected }}
                      onPress={() => setColorName(c.name)}
                      haptic="selection"
                      scaleTo={pressScale.icon}
                      style={[styles.swatchRing, { borderColor: selected ? color.border.focus : 'transparent' }]}
                    >
                      <View style={[styles.swatch, { backgroundColor: c.hex }]} />
                    </PressableScale>
                  );
                })}
              </View>
            </View>
            <View style={{ gap: space.sm, alignItems: 'flex-end' }}>
              <Text variant="labelM">Quantité</Text>
              <QuantityStepper value={qty} max={product.stock} onChange={setQty} size="M" label={product.shortName} />
            </View>
          </View>
        )}

        <EscrowBanner />

        <View style={styles.actions}>
          <Button label="Ajouter au panier" variant="outline" disabled={out} onPress={() => add('stay')} style={styles.flex} />
          <Button label="Commander" disabled={out} haptic="medium" onPress={() => add('cart')} style={styles.flex} />
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, justifyContent: 'flex-end' },
  flex: { flex: 1, minWidth: 0 },
  row: { flexDirection: 'row', alignItems: 'baseline', gap: space.xs },
  backdrop: { backgroundColor: 'rgba(10,10,11,0.5)' },
  sheet: {
    backgroundColor: color.bg.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: space.screen,
    paddingTop: space.sm,
    gap: space.lg,
  },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: color.border.default },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  close: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  product: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: color.border.subtle,
  },
  options: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  swatches: { flexDirection: 'row', gap: space.sm },
  swatchRing: { width: 40, height: 40, borderRadius: 20, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  swatch: { width: 30, height: 30, borderRadius: 15 },
  actions: { flexDirection: 'row', gap: space.md },
});
