import { router } from 'expo-router';
import { Bell, CircleX, PackageCheck, ShieldCheck, Store, Truck, type LucideIcon } from 'lucide-react-native';
import { useMemo } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { formatDayTime } from '@/domain/format';
import type { AppState } from '@/domain/state';
import { useStore } from '@/store/AppStore';
import { pressScale } from '@/theme/motion';
import { color, radius, space } from '@/theme/tokens';
import { HeroIcon } from '@/ui/Feedback';
import { PressableScale } from '@/ui/Pressable';
import { Text } from '@/ui/Text';
import { GuestTab } from '@/ui/GuestPrompt';
import { LargeTitleBar } from '@/ui/TopAppBar';

interface Notice {
  id: string;
  at: string;
  title: string;
  body: string;
  icon: LucideIcon;
  tint: string;
  orderId?: string;
}

/** Buyer notifications (D6), derived from the domain event log. */
function notices(state: AppState): Notice[] {
  const out: Notice[] = [];
  for (const e of state.events) {
    const order = e.orderId ? state.orders[e.orderId] : undefined;
    const ref = order ? `#${order.id}` : '';
    switch (e.type) {
      case 'payment.held_in_escrow':
        out.push({ id: e.id, at: e.at, title: 'Paiement sécurisé', body: 'YA YO garde tes fonds jusqu’à la livraison.', icon: ShieldCheck, tint: color.icon.success, orderId: e.checkoutId ? state.checkouts[e.checkoutId]?.orderIds[0] : undefined });
        break;
      case 'payment.failed':
        out.push({ id: e.id, at: e.at, title: 'Paiement non abouti', body: 'Aucun montant n’a été débité. Tu peux réessayer.', icon: CircleX, tint: color.icon.danger });
        break;
      case 'seller.mark_ready':
        out.push({ id: e.id, at: e.at, title: `Commande ${ref} prête`, body: 'Le vendeur a préparé ton colis. Un livreur arrive.', icon: Store, tint: color.icon.accent, orderId: e.orderId });
        break;
      case 'courier.collect':
        out.push({ id: e.id, at: e.at, title: `Commande ${ref} en route`, body: 'Prépare ton code de réception.', icon: Truck, tint: color.icon.info, orderId: e.orderId });
        break;
      case 'courier.confirm_delivery':
        out.push({ id: e.id, at: e.at, title: `Commande ${ref} livrée`, body: 'Le vendeur a été payé par YA YO.', icon: PackageCheck, tint: color.icon.success, orderId: e.orderId });
        break;
    }
  }
  return out.reverse();
}

/** Guests see why the tab needs an account; signing in comes back here. */
export default function AlertsScreen() {
  const { state } = useStore();
  if (!state.auth.session)
    return (
      <GuestTab
        title="Alertes"
        icon={Bell}
        heading="Tes alertes"
        body="Connecte-toi pour recevoir le suivi de tes commandes et de tes paiements."
        resume="/alertes"
      />
    );
  return <AlertsScreenContent />;
}

function AlertsScreenContent() {
  const { state } = useStore();
  const list = useMemo(() => notices(state), [state]);
  return (
    <View style={styles.screen}>
      <LargeTitleBar title="Alertes" />
      <FlatList
        data={list}
        keyExtractor={(n) => n.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <HeroIcon icon={Bell} bg={color.bg.surfaceSunken} fg={color.icon.secondary} animate={false} />
            <Text variant="h4">Aucune alerte</Text>
            <Text variant="bodyM" color={color.text.secondary} align="center">
              Le suivi de tes commandes et de tes paiements s’affichera ici.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <PressableScale
            disabled={!item.orderId}
            scaleTo={pressScale.card}
            accessibilityRole={item.orderId ? 'link' : 'text'}
            onPress={() => item.orderId && router.push({ pathname: '/suivi/[id]', params: { id: item.orderId } })}
            style={styles.row}
          >
            <View style={styles.icon}>
              <item.icon size={20} color={item.tint} strokeWidth={2} />
            </View>
            <View style={styles.flex}>
              <Text variant="labelM">{item.title}</Text>
              <Text variant="bodyS" color={color.text.secondary}>
                {item.body}
              </Text>
              <Text variant="caption" color={color.text.tertiary}>
                {formatDayTime(item.at)}
              </Text>
            </View>
          </PressableScale>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg.canvas },
  list: { padding: space.screen, gap: space.md },
  row: { flexDirection: 'row', gap: space.md, backgroundColor: color.bg.surface, borderRadius: radius.lg, padding: space.lg },
  icon: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: color.bg.surfaceSunken, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1, minWidth: 0, gap: 2 },
  empty: { alignItems: 'center', gap: space.md, paddingTop: space.screen * 2 },
});
