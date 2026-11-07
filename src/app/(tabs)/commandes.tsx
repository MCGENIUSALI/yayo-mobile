import { router } from 'expo-router';
import { Package, PackageCheck, Scale } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { getProduct, getShop } from '@/domain/catalog';
import { formatDay, plural } from '@/domain/format';
import { formatFC } from '@/domain/money';
import { confirmedOrders, orderTab, type OrderTab } from '@/domain/state';
import type { Order } from '@/domain/types';
import { useStore } from '@/store/AppStore';
import { pressScale } from '@/theme/motion';
import { color, radius, space } from '@/theme/tokens';
import { Button } from '@/ui/Button';
import { ProductImage } from '@/ui/Commerce';
import { HeroIcon, useEnter } from '@/ui/Feedback';
import { Segmented } from '@/ui/Form';
import { PressableScale } from '@/ui/Pressable';
import { PaymentStatusBadge } from '@/ui/Status';
import { Text } from '@/ui/Text';
import { GuestTab } from '@/ui/GuestPrompt';
import { LargeTitleBar } from '@/ui/TopAppBar';

/** Order Card (Figma 1002:474): the badge shows the escrow payment state (§9). */
function OrderCard({ order, index }: { order: Order; index: number }) {
  const entering = useEnter(index);
  const shop = getShop(order.shopId);
  const items = order.lines.reduce((n, l) => n + l.qty, 0);
  const open = () => router.push({ pathname: '/suivi/[id]', params: { id: order.id } });
  return (
    <Animated.View entering={entering}>
      <PressableScale
        accessibilityRole="link"
        accessibilityLabel={`Commande ${order.id}, ${formatFC(order.total)}`}
        onPress={open}
        scaleTo={pressScale.card}
        style={styles.card}
      >
        <View style={styles.header}>
          <View style={styles.flex}>
            <Text variant="labelM">Commande #{order.id}</Text>
            <Text variant="bodyS" color={color.text.secondary} numberOfLines={1}>
              {formatDay(order.milestones.createdAt)} · {plural(items, 'article', 'articles')} · {shop.name}
            </Text>
          </View>
          <PaymentStatusBadge status={order.payment} method={order.method} />
        </View>
        <View style={styles.items}>
          {order.lines.slice(0, 3).map((l) => (
            <ProductImage key={`${l.productId}|${l.color}`} product={getProduct(l.productId)} size={48} rounded={radius.sm} />
          ))}
          <Text variant="bodyM" color={color.text.secondary} numberOfLines={1} style={styles.flex}>
            {order.lines.map((l) => l.name.split(' – ')[0]).join(', ')}
          </Text>
        </View>
        <View style={styles.footer}>
          <View>
            <Text variant="bodyS" color={color.text.secondary}>
              Total
            </Text>
            <Text variant="priceM">{formatFC(order.total)}</Text>
          </View>
          <Button
            label={order.delivery === 'delivered' ? 'Voir la commande' : 'Suivre la commande'}
            size="S"
            onPress={open}
            style={{ width: 161 }}
            haptic="selection"
          />
        </View>
      </PressableScale>
    </Animated.View>
  );
}

const EMPTY: Record<OrderTab, { title: string; body: string; icon: typeof Package }> = {
  active: { title: 'Aucune commande en cours', body: 'Tes achats apparaîtront ici dès le paiement sécurisé.', icon: Package },
  delivered: { title: 'Aucune commande livrée', body: 'Les commandes reçues s’affichent ici.', icon: PackageCheck },
  disputes: { title: 'Aucun litige', body: 'Si un colis pose problème, signale-le depuis son suivi.', icon: Scale },
};

/** Guests see why the tab needs an account; signing in comes back here. */
export default function OrdersScreen() {
  const { state } = useStore();
  if (!state.auth.session)
    return (
      <GuestTab
        title="Commandes"
        icon={Package}
        heading="Suis tes commandes"
        body="Connecte-toi pour passer commande et suivre tes livraisons en direct."
        resume="/commandes"
      />
    );
  return <OrdersScreenContent />;
}

/** D1 · Mes commandes. */
function OrdersScreenContent() {
  const { state } = useStore();
  const [tab, setTab] = useState<OrderTab>('active');
  const all = useMemo(() => confirmedOrders(state), [state]);
  const list = all.filter((o) => orderTab(o) === tab);
  const activeCount = all.filter((o) => orderTab(o) === 'active').length;
  const empty = EMPTY[tab];

  return (
    <View style={styles.screen}>
      <LargeTitleBar
        title="Mes commandes"
        subtitle={activeCount > 0 ? `${plural(activeCount, 'commande', 'commandes')} en cours` : 'Aucune commande en cours'}
      />
      <FlatList
        data={list}
        keyExtractor={(o) => o.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <Segmented<OrderTab>
            value={tab}
            onChange={setTab}
            options={[
              { value: 'active', label: 'En cours' },
              { value: 'delivered', label: 'Livrées' },
              { value: 'disputes', label: 'Litiges' },
            ]}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <HeroIcon icon={empty.icon} bg={color.bg.surfaceSunken} fg={color.icon.secondary} animate={false} />
            <Text variant="h4" align="center">
              {empty.title}
            </Text>
            <Text variant="bodyM" color={color.text.secondary} align="center">
              {empty.body}
            </Text>
            {tab === 'active' ? <Button label="Découvrir les produits" variant="outline" onPress={() => router.navigate('/')} /> : null}
          </View>
        }
        renderItem={({ item, index }) => <OrderCard order={item} index={index} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg.canvas },
  flex: { flex: 1, minWidth: 0 },
  list: { paddingHorizontal: space.screen, paddingTop: space.sm, paddingBottom: space.lg, gap: space.lg },
  card: {
    backgroundColor: color.bg.surface,
    borderWidth: 1,
    borderColor: color.border.subtle,
    borderRadius: radius.lg,
    padding: space.lg,
    gap: space.md,
  },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  items: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  empty: { alignItems: 'center', gap: space.md, paddingTop: space.screen * 2 },
});
