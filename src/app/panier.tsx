import { router } from 'expo-router';
import { ArrowRight, ShoppingCart, Trash2 } from 'lucide-react-native';
import { Fragment, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeOut, LinearTransition, useReducedMotion } from 'react-native-reanimated';
import { formatFC, formatUSD } from '@/domain/money';
import { summarizeCart, type CartGroupLine } from '@/domain/pricing';
import { plural } from '@/domain/format';
import { useStore } from '@/store/AppStore';
import { duration, pressScale } from '@/theme/motion';
import { color, radius, space } from '@/theme/tokens';
import { Button } from '@/ui/Button';
import { EscrowBanner, PriceBlock, ProductImage, QuantityStepper, SummaryRow, VendorHeader } from '@/ui/Commerce';
import { HeroIcon, useToast } from '@/ui/Feedback';
import { BottomBar, Card, Content, Divider, Screen } from '@/ui/Layout';
import { PressableScale } from '@/ui/Pressable';
import { Text } from '@/ui/Text';
import { TopAppBar } from '@/ui/TopAppBar';

function CartItem({ line }: { line: CartGroupLine }) {
  const { dispatch } = useStore();
  const toast = useToast();
  const reduced = useReducedMotion();
  return (
    <Animated.View
      exiting={reduced ? undefined : FadeOut.duration(duration.fast)}
      layout={reduced ? undefined : LinearTransition.duration(duration.base)}
      style={styles.item}
    >
      <PressableScale
        accessibilityRole="link"
        accessibilityLabel={`Voir ${line.product.shortName}`}
        onPress={() => router.push({ pathname: '/produit/[id]', params: { id: line.productId } })}
        scaleTo={pressScale.card}
      >
        <ProductImage product={line.product} size={88} />
      </PressableScale>
      <View style={styles.info}>
        <View style={styles.top}>
          <Text variant="labelM" numberOfLines={1} style={styles.flex}>
            {line.product.shortName}
          </Text>
          <PressableScale
            accessibilityLabel={`Retirer ${line.product.shortName} du panier`}
            haptic="light"
            hitSlop={12}
            scaleTo={pressScale.icon}
            onPress={() => {
              dispatch({ type: 'cart/remove', productId: line.productId, color: line.color });
              toast('Article retiré du panier');
            }}
          >
            <Trash2 size={18} color={color.icon.secondary} strokeWidth={2} />
          </PressableScale>
        </View>
        <Text variant="bodyS" color={color.text.secondary}>
          {line.color} · Qté {line.qty}
        </Text>
        <View style={styles.bottom}>
          <PriceBlock amount={line.lineTotal} />
          <QuantityStepper
            value={line.qty}
            max={line.product.stock}
            label={line.product.shortName}
            onChange={(qty) => dispatch({ type: 'cart/setQty', productId: line.productId, color: line.color, qty })}
          />
        </View>
      </View>
    </Animated.View>
  );
}

/** C1 · Panier multi-vendeur (+ D8 · Panier vide). */
export default function CartScreen() {
  const { state } = useStore();
  const summary = useMemo(() => summarizeCart(state.cart, state.promoCode), [state.cart, state.promoCode]);
  const empty = summary.groups.length === 0;

  return (
    <Screen>
      <TopAppBar title={empty ? 'Mon panier' : `Mon panier (${summary.itemsCount})`} />
      {empty ? (
        <View style={styles.empty}>
          <HeroIcon icon={ShoppingCart} bg={color.bg.surfaceSunken} fg={color.icon.secondary} />
          <Text variant="h2" align="center">
            Ton panier est vide
          </Text>
          <Text variant="bodyM" color={color.text.secondary} align="center">
            Découvre les produits des boutiques de Kinshasa et paie en toute sécurité avec YA YO Escrow.
          </Text>
          <Button label="Découvrir les produits" onPress={() => router.dismissTo('/')} fill />
        </View>
      ) : (
        <>
          <Content>
            {summary.groups.map((g) => (
              <Card key={g.shop.id}>
                <VendorHeader shop={g.shop} />
                {g.lines.map((line) => (
                  <Fragment key={`${line.productId}|${line.color}`}>
                    <Divider />
                    <CartItem line={line} />
                  </Fragment>
                ))}
              </Card>
            ))}
            <Card gap={space.sm}>
              <SummaryRow label={`Sous-total (${plural(summary.itemsCount, 'article', 'articles')})`} value={formatFC(summary.itemsTotal)} />
              <SummaryRow label={`Livraison (${plural(summary.groups.length, 'vendeur', 'vendeurs')})`} value={formatFC(summary.deliveryTotal)} />
              {summary.promo && summary.discount > 0 ? (
                <SummaryRow label={`Code promo ${summary.promo.code}`} value={formatFC(-summary.discount)} type="discount" />
              ) : null}
              <Divider />
              <SummaryRow label="Total à payer" value={formatFC(summary.total)} type="total" />
              <Text variant="caption" color={color.text.secondary} align="right">
                {formatUSD(summary.total)} · taux indicatif du jour
              </Text>
            </Card>
            <EscrowBanner />
          </Content>
          <BottomBar direction="row">
            <View style={{ gap: 2 }}>
              <Text variant="caption" color={color.text.secondary}>
                Total
              </Text>
              <Text variant="priceL">{formatFC(summary.total)}</Text>
              <Text variant="caption" color={color.text.secondary}>
                {formatUSD(summary.total)}
              </Text>
            </View>
            <Button label="Commander" trailingIcon={ArrowRight} onPress={() => router.push('/achat/livraison')} style={styles.flex} />
          </BottomBar>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  item: { flexDirection: 'row', gap: space.md, padding: space.md, minHeight: 112, borderRadius: radius.lg },
  info: { flex: 1, minWidth: 0, gap: space.xs },
  top: { flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' },
  bottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.screen, gap: space.xl },
});
