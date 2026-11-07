import { router, useLocalSearchParams } from 'expo-router';
import { Ban, Bike, MessageCircle, PackageCheck, Phone, Share2, ShieldCheck, Store, TriangleAlert, Truck, Undo2 } from 'lucide-react-native';
import { useMemo } from 'react';
import { ScrollView, Share, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated from 'react-native-reanimated';
import { getShop } from '@/domain/catalog';
import { cancelReasonLabel } from '@/domain/account';
import { formatDayTime } from '@/domain/format';
import { formatFC } from '@/domain/money';
import { canCancel, canDispute } from '@/domain/orderMachine';
import type { Order } from '@/domain/types';
import { incidentLabel } from '@/domain/courier';
import { buildTimeline, etaLabel, showReceiptCode, type StepKey } from '@/domain/tracking';
import { useStore } from '@/store/AppStore';
import { useOpenWithAccount } from '@/store/useRequireAccount';
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

  if (order.cancellation) return <CancelledOrder order={order} />;

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
                  <Avatar initials={order.courier.initials} verified />
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

          {canCancel(order) ? (
            <Button
              label="Annuler la commande"
              variant="outline"
              leadingIcon={Ban}
              haptic="selection"
              onPress={() => router.push({ pathname: '/suivi/annuler/[id]', params: { id: order.id } })}
              fill
            />
          ) : null}

          {order.dispute ? (
            <Button
              label={`Voir le litige #${order.dispute.id}`}
              variant="outline"
              leadingIcon={TriangleAlert}
              onPress={() => router.push({ pathname: '/suivi/litige/[id]', params: { id: order.id } })}
              fill
            />
          ) : canDispute(order) ? (
            <Button
              label="Signaler un problème"
              variant="ghost"
              size="M"
              leadingIcon={TriangleAlert}
              style={styles.report}
              onPress={() => router.push({ pathname: '/suivi/litige/[id]', params: { id: order.id } })}
            />
          ) : !delivered && !canCancel(order) ? (
            <Text variant="bodyS" color={color.text.secondary}>
              Un souci ? Tu pourras signaler un problème quand le livreur sera en route, avant de donner ton code.
            </Text>
          ) : null}

          <DemoConsole order={order} />
        </View>
      </ScrollView>
    </Screen>
  );
}

/** D19 · Commande annulée: the refund goes back to the payment method, in full. */
function CancelledOrder({ order }: { order: Order }) {
  const { state } = useStore();
  const openWithAccount = useOpenWithAccount();
  const c = order.cancellation!;
  const checkout = state.checkouts[order.checkoutId];
  const prepaid = c.refund !== 'none';
  const destination =
    order.method === 'card' ? 'Ta carte bancaire' : checkout?.operator ? `${checkout.operator}${checkout.msisdn ? ` · ${checkout.msisdn}` : ''}` : 'Ton compte Mobile Money';
  const steps = [
    { key: 'cancelled', title: 'Commande annulée', description: formatDayTime(c.at), state: 'done' as const, icon: Ban },
    ...(prepaid
      ? [
          { key: 'sent', title: 'Remboursement envoyé', description: `${formatFC(order.total)} vers ${destination}`, state: 'done' as const, icon: Undo2 },
          {
            key: 'received',
            title: 'Remboursement reçu',
            description: c.refund === 'received' && c.refundedAt ? formatDayTime(c.refundedAt) : 'En général sous quelques minutes, au plus 48 h selon l’opérateur.',
            state: c.refund === 'received' ? ('done' as const) : ('current' as const),
            icon: ShieldCheck,
          },
        ]
      : []),
  ];
  return (
    <Screen>
      <TopAppBar title={`Commande #${order.id}`} onBack={() => (router.canGoBack() ? router.back() : router.navigate('/commandes'))} />
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          <Alert
            tone={c.refund === 'received' || !prepaid ? 'escrow' : 'info'}
            icon={prepaid ? Undo2 : Ban}
            title={!prepaid ? 'Commande annulée' : c.refund === 'received' ? 'Tu as été remboursé' : 'Remboursement en cours'}
            body={
              !prepaid
                ? 'Tu devais payer à la livraison : rien n’a été débité. Le vendeur a été prévenu.'
                : c.refund === 'received'
                  ? `${formatFC(order.total)} sont revenus sur ${destination}.`
                  : `YA YO te rembourse ${formatFC(order.total)} sur ${destination}. Le vendeur a été prévenu.`
            }
          />
          <View accessibilityRole="list">
            {steps.map((s, i) => (
              <TimelineStep key={s.key} title={s.title} description={s.description} state={s.state} icon={s.icon} last={i === steps.length - 1} />
            ))}
          </View>
          <Card gap={space.sm}>
            <SummaryRow label="Motif" value={cancelReasonLabel(c.reason)} />
            {c.note ? <SummaryRow label="Précision" value={c.note} /> : null}
            <SummaryRow label="Articles" value={formatFC(order.itemsTotal)} />
            <SummaryRow label="Livraison" value={formatFC(order.deliveryFee)} />
            {order.discount > 0 ? <SummaryRow label="Réduction" value={formatFC(-order.discount)} type="discount" /> : null}
            <Divider />
            <SummaryRow label={prepaid ? 'Montant remboursé' : 'Montant débité'} value={formatFC(prepaid ? order.total : 0)} />
          </Card>
          <Button
            label="Contacter le support"
            variant="outline"
            leadingIcon={MessageCircle}
            onPress={() => openWithAccount({ pathname: '/aide/discussion', params: { order: order.id } })}
            fill
          />
          <Button label="Continuer mes achats" variant="ghost" onPress={() => router.navigate('/')} fill />
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
