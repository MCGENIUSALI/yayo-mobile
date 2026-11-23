import { router } from 'expo-router';
import { Bell, Bike, Package, ShoppingBag, Wallet, type LucideIcon } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { formatDayTime } from '@/domain/format';
import { sellerNotices, type SellerNotice, type SellerNoticeKind } from '@/domain/seller';
import { useSeller } from '@/store/useSeller';
import { pressScale } from '@/theme/motion';
import { color, space } from '@/theme/tokens';
import { PressableScale } from '@/ui/Pressable';
import { EmptyState } from '@/ui/Seller';
import { Text } from '@/ui/Text';
import { TopAppBar } from '@/ui/TopAppBar';

const ICON: Record<SellerNoticeKind, LucideIcon> = { order: ShoppingBag, courier: Bike, stock: Package, payout: Wallet };

function ago(iso: string) {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (min < 1) return 'à l’instant';
  if (min < 60) return `il y a ${min} min`;
  if (min < 24 * 60) return `il y a ${Math.round(min / 60)} h`;
  return formatDayTime(iso);
}

/** V13 · Notifications vendeur (unread first highlighted; opening the list marks them read on leave). */
export default function SellerNotifications() {
  const { shop, orders, dispatch } = useSeller();
  const list = useMemo(() => (shop ? sellerNotices(orders, shop.products, new Date().toISOString()) : []), [orders, shop]);
  // Snapshot of what was unread when the screen opened, so highlights do not vanish while reading.
  const [unread] = useState(() => new Set(shop ? list.filter((n) => !shop.readNotifications.includes(n.id)).map((n) => n.id) : []));

  useEffect(() => {
    const ids = list.map((n) => n.id);
    if (ids.length) dispatch({ type: 'seller/readNotifications', ids });
  }, [list, dispatch]);

  const open = (n: SellerNotice) => {
    if (n.orderId) {
      const o = orders.find((x) => x.id === n.orderId);
      if (o?.seller === 'ready') router.push({ pathname: '/vendeur/remise/[id]', params: { id: n.orderId } });
      else router.push({ pathname: '/vendeur/commande/[id]', params: { id: n.orderId } });
    } else if (n.productId) router.push({ pathname: '/vendeur/produit/[id]', params: { id: n.productId } });
  };

  return (
    <View style={styles.screen}>
      <TopAppBar title="Notifications" />
      <FlatList
        data={list}
        keyExtractor={(n) => n.id}
        ListHeaderComponent={
          unread.size ? (
            <Text variant="bodyM" color={color.text.secondary} style={styles.count}>
              {unread.size} non lue{unread.size > 1 ? 's' : ''}
            </Text>
          ) : undefined
        }
        ListEmptyComponent={<EmptyState icon={Bell} title="Aucune notification" body="Nouvelles commandes, livreurs et paiements s’affichent ici." />}
        renderItem={({ item }) => {
          const Icon = ICON[item.kind];
          const isUnread = unread.has(item.id);
          return (
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={`${isUnread ? 'Non lue. ' : ''}${item.title}. ${item.body}`}
              onPress={() => open(item)}
              scaleTo={pressScale.card}
              style={[styles.item, isUnread && { backgroundColor: color.bg.accentSubtle }]}
            >
              <View style={styles.icon}>
                <Icon size={20} color={color.icon.primary} strokeWidth={2} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="labelM">{item.title}</Text>
                <Text variant="bodyS" color={color.text.secondary}>
                  {item.body}
                </Text>
                <Text variant="caption" color={color.text.tertiary}>
                  {ago(item.at)}
                </Text>
              </View>
              {isUnread ? <View style={styles.dot} /> : null}
            </PressableScale>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg.surface },
  count: { paddingHorizontal: space.screen, paddingVertical: space.sm },
  item: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md, paddingHorizontal: space.screen, paddingVertical: space.lg },
  icon: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: color.border.default, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: color.bg.accent, marginTop: 6 },
});
