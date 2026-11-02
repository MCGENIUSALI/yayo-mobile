import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Heart, Share2, ShoppingCart } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, Share, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getShop, products } from '@/domain/catalog';
import { formatFC } from '@/domain/money';
import { addToCartError } from '@/domain/state';
import { useStore } from '@/store/AppStore';
import { pressScale } from '@/theme/motion';
import { color, radius, space } from '@/theme/tokens';
import { Button } from '@/ui/Button';
import { EscrowBanner, PriceBlock, ProductImage, QuantityStepper, Rating, VendorHeader } from '@/ui/Commerce';
import { Alert, useToast } from '@/ui/Feedback';
import { PageIndicator } from '@/ui/Form';
import { BottomBar, Screen } from '@/ui/Layout';
import { haptic, PressableScale } from '@/ui/Pressable';
import { Badge } from '@/ui/Status';
import { Text } from '@/ui/Text';
import { IconButton } from '@/ui/TopAppBar';

/** B4 · Fiche produit (+ E6 · Produit en rupture). */
export default function ProductScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const product = id ? products[id] : undefined;
  const insets = useSafeAreaInsets();
  const { state, dispatch } = useStore();
  const toast = useToast();
  const [colorName, setColorName] = useState(product?.colors[0]?.name ?? '');
  const [qty, setQty] = useState(1);
  const [liked, setLiked] = useState(false);

  if (!product) {
    return (
      <Screen>
        <View style={[styles.missing, { paddingTop: insets.top + space.screen }]}>
          <Text variant="h4">Produit introuvable</Text>
          <Button label="Retour à l’accueil" onPress={() => router.replace('/')} />
        </View>
      </Screen>
    );
  }

  const shop = getShop(product.shopId);
  const out = product.stock <= 0;
  const discount = product.compareAt ? Math.round((1 - product.price / product.compareAt) * 100) : 0;

  const add = (then?: () => void) => {
    const error = addToCartError(state, product.id, colorName, qty);
    if (error) {
      haptic('warning');
      toast(error, 'danger');
      return;
    }
    dispatch({ type: 'cart/add', productId: product.id, color: colorName, qty });
    haptic('success');
    if (then) then();
    else toast('Ajouté au panier', 'success');
  };

  return (
    <Screen background={color.bg.canvas}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: space.lg }}>
        <View style={{ paddingTop: insets.top, backgroundColor: product.tint }}>
          <View style={styles.gallery}>
            <ProductImage product={product} rounded={0} style={StyleSheet.absoluteFill} />
            <View style={styles.galleryTop}>
              <IconButton icon={ArrowLeft} label="Retour" onPress={() => router.back()} />
              <View style={styles.row}>
                <IconButton
                  icon={Share2}
                  label="Partager"
                  onPress={() => Share.share({ message: `${product.name} · ${formatFC(product.price)} sur YA YO` }).catch(() => undefined)}
                />
                <PressableScale
                  accessibilityLabel={liked ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                  accessibilityState={{ selected: liked }}
                  onPress={() => setLiked((v) => !v)}
                  haptic="light"
                  scaleTo={pressScale.icon}
                  style={styles.likeBtn}
                >
                  <Heart size={24} strokeWidth={2} color={liked ? color.icon.danger : color.icon.primary} fill={liked ? color.icon.danger : 'transparent'} />
                </PressableScale>
              </View>
            </View>
            {discount > 0 ? (
              <View style={styles.discount}>
                <Badge label={`-${discount} %`} tone="accent" />
              </View>
            ) : null}
            <View style={styles.pager}>
              <PageIndicator count={3} index={0} />
            </View>
          </View>
        </View>

        <View style={styles.content}>
          <VendorHeader shop={shop} showDelivery={false} />
          <Text variant="h3">{product.name}</Text>
          <Rating value={product.rating} count={product.reviews} />
          <View style={styles.priceRow}>
            <PriceBlock amount={product.price} size="L" note="prix indicatif" />
            {product.compareAt ? (
              <Text variant="priceStrike" color={color.text.tertiary} style={styles.strike}>
                {formatFC(product.compareAt)}
              </Text>
            ) : null}
          </View>

          {out ? (
            <Alert tone="danger" title="Produit en rupture de stock" body="Le vendeur n’a plus ce produit. Reviens bientôt ou découvre sa boutique." />
          ) : (
            <View style={styles.options}>
              <View style={{ gap: space.sm }}>
                <Text variant="labelM">Couleur : {colorName}</Text>
                <View style={styles.row} accessibilityRole="radiogroup">
                  {product.colors.map((c) => {
                    const selected = c.name === colorName;
                    return (
                      <PressableScale
                        key={c.name}
                        accessibilityRole="radio"
                        accessibilityLabel={c.name}
                        accessibilityState={{ selected }}
                        haptic="selection"
                        scaleTo={pressScale.icon}
                        onPress={() => setColorName(c.name)}
                        style={[styles.swatchRing, { borderColor: selected ? color.border.focus : 'transparent' }]}
                      >
                        <View style={[styles.swatch, { backgroundColor: c.hex }]} />
                      </PressableScale>
                    );
                  })}
                </View>
              </View>
              <View style={{ gap: space.sm, alignItems: 'flex-end' }}>
                <Text variant="labelM">Quantité · {product.stock} en stock</Text>
                <QuantityStepper value={qty} max={product.stock} onChange={setQty} size="M" label={product.shortName} />
              </View>
            </View>
          )}

          <EscrowBanner variant="compact" />

          <View style={{ gap: space.xs }}>
            <Text variant="labelL">Description</Text>
            <Text variant="bodyM" color={color.text.secondary}>
              {product.description}
            </Text>
          </View>
        </View>
      </ScrollView>

      <BottomBar direction="row">
        {out ? (
          <Button label="Produit indisponible" disabled fill style={{ flex: 1 }} />
        ) : (
          <>
            <Button label="Au panier" variant="outline" leadingIcon={ShoppingCart} onPress={() => add()} haptic="none" />
            <Button
              label="Acheter maintenant"
              onPress={() => add(() => router.push('/panier'))}
              haptic="none"
              style={{ flex: 1 }}
            />
          </>
        )}
      </BottomBar>
    </Screen>
  );
}

const styles = StyleSheet.create({
  missing: { padding: space.screen, gap: space.lg },
  gallery: { height: 340, overflow: 'hidden' },
  galleryTop: {
    position: 'absolute',
    top: space.md,
    left: space.lg,
    right: space.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  row: { flexDirection: 'row', gap: space.sm, alignItems: 'center' },
  likeBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: color.bg.surfaceSunken,
    alignItems: 'center',
    justifyContent: 'center',
  },
  discount: { position: 'absolute', left: space.lg, bottom: 16 },
  pager: { position: 'absolute', bottom: 24, left: 0, right: 0, alignItems: 'center' },
  content: { paddingHorizontal: space.screen, paddingTop: space.xl, gap: space.lg },
  priceRow: { flexDirection: 'row', alignItems: 'flex-end', gap: space.md },
  strike: { textDecorationLine: 'line-through', marginBottom: space['2xs'] },
  options: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: space.md },
  swatchRing: { width: 40, height: 40, borderRadius: 20, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  swatch: { width: 30, height: 30, borderRadius: 15 },
});
