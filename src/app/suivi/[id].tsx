import { router, useLocalSearchParams } from 'expo-router';
import { Phone, Share2, Store, TriangleAlert, Truck, Bike, PackageCheck, ShieldCheck } from 'lucide-react-native';
import { useMemo } from 'react';
import { ScrollView, Share, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated from 'react-native-reanimated';
import { getShop } from '@/domain/catalog';
import { formatFC } from '@/domain/money';
import { incidentLabel } from '@/domain/courier';
import { buildTimeline, etaLabel, showReceiptCode, type StepKey } from '@/domain/tracking';
import { useStore } from '@/store/AppStore';
import { color, space } from '@/theme/tokens';
import { Button } from '@/ui/Button';
import { Avatar, SummaryRow, VendorHeader } from '@/ui/Commerce';
import { DemoConsole } from '@/ui/DemoConsole';
import { Alert, DeliveryCode, TimelineStep, useEnter, useToast } from '@/ui/Feedback';
import { Card, Divider, Screen } from '@/ui/Layout';
import { DeliveryStatusBadge, PaymentStatusBadge } from '@/ui/Status';
import { Text } from '@/ui/Text';
import { IconButton, TopAppBar } from '@/ui/TopAppBar';
import { TrackingMap } from '@/ui/TrackingMap';

const STEP_ICON: Record<StepKey, typeof Truck> = {
  paid: ShieldCheck,
  prepared: Store,
  collected: Bike,
  delivering: Truck,
  delivered: PackageCheck,
};

/** D2 · Suivi de livraison — payment and delivery shown in sync (§9). */
export default function TrackingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state } = useStore();
  const toast = useToast();
  const { width } = useWindowDimensions();
  const order = id ? state.orders[id] : undefined;
  const timeline = useMemo(() => (order ? buildTimeline(order) : []), [order]);
  const enter = [useEnter(0), useEnter(1), useEnter(2), useEnter(3)];

  if (!order) {
    return (
      <Screen>
        <TopAppBar title="Commande" />
        <View style={styles.center}>
          <Text variant="bodyM" color={color.text.secondary}>
            Commande introuvable.
          </Text>
          <Button label="Mes commandes" onPress={() => router.navigate('/commandes')} />
        </View>
      </Screen>
    );
  }

  const shop = getShop(order.shopId);
  const time = etaLabel(order);
  const delivered = order.delivery === 'delivered';

  return (
    <Screen>
      <TopAppBar
        title={`Commande #${order.id}`}
        onBack={() => (router.canGoBack() ? router.back() : router.navigate('/commandes'))}
        action={{
          icon: Share2,
          label: 'Partager le suivi',
          onPress: () => Share.share({ message: `Suivi de ma commande YA YO #${order.id}` }).catch(() => undefined),
        }}
      />
      <ScrollView showsVerticalScrollIndicator={false}>
        <TrackingMap status={order.delivery} width={width} />
        <View style={styles.content}>
          <Animated.View entering={enter[0]} style={styles.statusRow}>
            <View>
              <Text variant="caption" color={color.text.secondary}>
                {time.caption}
              </Text>
              <Text variant="h3">{time.value}</Text>
            </View>
            {order.delivery === 'unassigned' ? (
              <PaymentStatusBadge status={order.payment} method={order.method} />
            ) : (
              <DeliveryStatusBadge status={order.delivery} />
            )}
          </Animated.View>

          <Animated.View entering={enter[1]}>
            {order.courier && !delivered ? (
              <Card>
                <View style={styles.courierRow}>
                  <Avatar initials={order.courier.initials} verified photo={order.courier.id ? state.auth.accounts[order.courier.id]?.avatar : undefined} />
                  <View style={styles.flex}>
                    <Text variant="labelL">{order.courier.name} · ton livreur</Text>
                    <Text variant="caption" color={color.text.secondary}>
                      {order.courier.vehicle} · Livreur vérifié · {order.courier.rating ? `${order.courier.rating.toLocaleString('fr-FR')} ★` : 'nouveau'}
                    </Text>
                  </View>
                  <IconButton icon={Phone} label="Appeler le livreur" onPress={() => toast('Appel via YA YO : numéro masqué (simulation).')} />
                </View>
                <Text variant="caption" color={color.text.tertiary}>
                  Numéro masqué : l’appel passe par YA YO.
                </Text>
              </Card>
            ) : (
              <Card>
                <VendorHeader shop={shop} />
              </Card>
            )}
          </Animated.View>

          {showReceiptCode(order) ? (
            <Animated.View entering={enter[2]}>
              <DeliveryCode code={order.receiptCode} />
            </Animated.View>
          ) : null}

          {order.incident ? (
            <Alert
              tone="danger"
              icon={TriangleAlert}
              title="Livraison impossible"
              body={`Motif signalé par le livreur : ${incidentLabel(order.incident.reason).short}. YA YO te contacte pour une nouvelle tentative ou un remboursement ; ton paiement reste bloqué d’ici là.`}
            />
          ) : null}

          {delivered ? (
            <Alert
              tone="info"
              icon={PackageCheck}
              title="Colis livré"
              body={order.payment === 'released' ? 'Ton code a été validé : YA YO a payé le vendeur.' : 'Livraison confirmée.'}
            />
          ) : null}

          <Text variant="h4" accessibilityRole="header">
            Suivi
          </Text>
          <View accessibilityRole="list">
            {timeline.map((s, i) => (
              <TimelineStep
                key={s.key}
                title={s.title}
                description={s.description}
                state={s.state}
                icon={STEP_ICON[s.key]}
                last={i === timeline.length - 1}
              />
            ))}
          </View>

          <Card gap={space.sm}>
            <SummaryRow label="Articles" value={formatFC(order.itemsTotal)} />
            <SummaryRow label="Livraison" value={formatFC(order.deliveryFee)} />
            {order.discount > 0 ? <SummaryRow label="Réduction" value={formatFC(-order.discount)} type="discount" /> : null}
            <Divider />
            <SummaryRow label="Total" value={formatFC(order.total)} />
          </Card>

          {!delivered ? (
            <Button
              label="Signaler un problème"
              variant="ghost"
              size="M"
              leadingIcon={TriangleAlert}
              style={styles.report}
              onPress={() => toast('Le signalement de litige (D4) arrive dans la prochaine version.')}
            />
          ) : null}

          <DemoConsole order={order} />
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.lg, padding: space.screen },
  content: { paddingHorizontal: space.screen, paddingTop: space.xl, paddingBottom: space.screen + space.xl, gap: space.lg },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  courierRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  report: { alignSelf: 'flex-start', paddingHorizontal: 0 },
});
