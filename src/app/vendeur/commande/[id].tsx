import { router, useLocalSearchParams } from 'expo-router';
import { Bike, PackageCheck, PackageOpen, ShieldCheck, TriangleAlert } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { initialsOf } from '@/domain/auth';
import { formatTime } from '@/domain/format';
import { formatFC } from '@/domain/money';
import { orderNet } from '@/domain/seller';
import { useSeller } from '@/store/useSeller';
import { color, space } from '@/theme/tokens';
import { Button } from '@/ui/Button';
import { SummaryRow } from '@/ui/Commerce';
import { Alert, TimelineStep, useToast, type TimelineState } from '@/ui/Feedback';
import { BottomBar, Card, Content, Divider, Screen } from '@/ui/Layout';
import { haptic } from '@/ui/Pressable';
import { EscrowBadge } from '@/ui/Seller';
import { Sheet } from '@/ui/Sheet';
import { Text } from '@/ui/Text';
import { TopAppBar } from '@/ui/TopAppBar';

/** Current step of the V6 timeline: Payée → À préparer → Prête pour collecte → Remise au livreur. */
const CURRENT = { new: 1, preparing: 1, ready: 3, handed_over: 4 } as const;

/** V6 · Détail commande (seller). */
export default function SellerOrderDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { orders, shop, dispatch, state } = useSeller();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [stockout, setStockout] = useState(false);
  const order = orders.find((o) => o.id === id);

  if (!order || !shop) {
    return (
      <Screen>
        <TopAppBar title="Commande" background={color.bg.canvas} />
        <Content>
          <Text variant="bodyM" color={color.text.secondary}>
            Commande introuvable.
          </Text>
          <Button label="Mes commandes" onPress={() => router.navigate('/vendeur/commandes')} fill />
        </Content>
      </Screen>
    );
  }

  const net = orderNet(order);
  const current = CURRENT[order.seller];
  const stateOf = (i: number): TimelineState => (i < current ? 'done' : i === current ? 'current' : 'upcoming');
  const timeline = [
    { title: 'Payée', description: order.method === 'cash' ? 'Paiement à la livraison' : 'Fonds bloqués par YA YO', icon: ShieldCheck },
    { title: 'À préparer', description: 'Emballe les articles', icon: PackageOpen },
    { title: 'Prête pour collecte', description: order.courier ? `${order.courier.name} est assigné` : 'Un livreur est assigné', icon: Bike },
    { title: 'Remise au livreur', description: 'Avec le code de remise', icon: PackageCheck },
  ];

  const act = (event: 'seller.start_preparing' | 'seller.mark_ready') => {
    setBusy(true);
    setTimeout(() => {
      dispatch({ type: 'seller/orderEvent', orderId: order.id, event: { type: event } });
      setBusy(false);
      haptic('success');
      if (event === 'seller.mark_ready') {
        toast('Livreur assigné : il arrive pour la collecte.', 'success');
        router.replace({ pathname: '/vendeur/remise/[id]', params: { id: order.id } });
      }
    }, 450);
  };

  const ownProducts = order.lines.map((l) => l.productId).filter((pid) => shop.products.some((p) => p.id === pid));

  return (
    <Screen>
      <TopAppBar title={`Commande #${order.id}`} background={color.bg.canvas} />
      <Content gap={space.lg} top={space.sm}>
        <View style={styles.between}>
          <Text variant="bodyM" color={color.text.secondary}>
            Reçue à {formatTime(order.milestones.paidAt ?? order.milestones.createdAt)}
          </Text>
          <EscrowBadge order={order} />
        </View>

        <View>
          {timeline.map((t, i) => (
            <TimelineStep key={t.title} title={t.title} description={t.description} icon={t.icon} state={stateOf(i)} last={i === timeline.length - 1} />
          ))}
        </View>

        <Card gap={space.sm}>
          <Text variant="caption" color={color.text.secondary} style={styles.caps}>
            CLIENT
          </Text>
          <View style={styles.client}>
            <View style={styles.avatar}>
              <Text variant="labelS" color={color.text.accent}>
                {initialsOf(order.buyer?.name ?? 'Client')}
              </Text>
            </View>
            <Text variant="labelL">
              {order.buyer?.name ?? 'Client'} · {order.buyer?.commune ?? 'Kinshasa'}, Kinshasa
            </Text>
          </View>
          <Text variant="bodyS" color={color.text.secondary}>
            Coordonnées masquées : la livraison passe par YA YO.
          </Text>
        </Card>

        <Card gap={space.sm}>
          <Text variant="caption" color={color.text.secondary} style={styles.caps}>
            ARTICLES
          </Text>
          {order.lines.map((l) => (
            <SummaryRow key={`${l.productId}|${l.color}`} label={`${l.qty}× ${l.name.split(' – ')[0]} · ${l.color}`} value={formatFC(l.unitPrice * l.qty)} />
          ))}
          {order.courierNote ? (
            <Text variant="bodyS" color={color.text.secondary}>
              Note de l’acheteur : {order.courierNote}
            </Text>
          ) : null}
        </Card>

        <Card gap={space.sm}>
          <Text variant="caption" color={color.text.secondary} style={styles.caps}>
            CE QUE TU RECEVRAS
          </Text>
          <SummaryRow label="Montant de la commande" value={formatFC(net.items)} />
          <SummaryRow label="Commission YA YO (10 %)" value={formatFC(-net.commission)} type="discount" />
          <SummaryRow label="Frais de livraison" value={formatFC(-net.delivery)} type="discount" />
          <Divider />
          <SummaryRow label="Net vendeur" value={formatFC(net.net)} type="total" />
          <Text variant="bodyS" color={color.text.secondary}>
            {order.payment === 'released' ? 'Versé sur ton solde.' : 'Versé après confirmation de la livraison.'}
          </Text>
        </Card>
        {order.dispute && !order.dispute.decision ? (
          <Alert tone="danger" title="Litige en cours" body="L’acheteur a signalé un problème. Les fonds restent bloqués jusqu’à la décision de YA YO, sous 72 h. YA YO te contacte." />
        ) : null}
        {order.cancellation ? (
          <Alert tone="warning" title="Commande annulée par l’acheteur" body="Ne prépare pas ce colis. Tu ne reçois rien pour cette commande et l’acheteur est remboursé par YA YO." />
        ) : null}
        {state.lastError && ['INVALID_TRANSITION', 'PAYMENT_NOT_SECURED', 'NOT_SELLER'].includes(state.lastError.code) ? (
          <Alert tone="danger" title="Action impossible" body={state.lastError.message} />
        ) : null}
      </Content>

      <BottomBar>
        {order.cancellation ? (
          <Button label="Retour aux commandes" variant="outline" onPress={() => router.navigate('/vendeur/commandes')} fill />
        ) : order.seller === 'new' ? (
          <Button label="Préparer la commande" haptic="medium" loading={busy} onPress={() => act('seller.start_preparing')} fill />
        ) : order.seller === 'preparing' ? (
          <Button label="Marquer comme prête pour collecte" haptic="medium" loading={busy} onPress={() => act('seller.mark_ready')} fill />
        ) : order.seller === 'ready' ? (
          <Button label="Remettre au livreur" haptic="medium" onPress={() => router.push({ pathname: '/vendeur/remise/[id]', params: { id: order.id } })} fill />
        ) : (
          <Button label="Retour aux commandes" variant="outline" onPress={() => router.navigate('/vendeur/commandes')} fill />
        )}
        {!order.cancellation && (order.seller === 'new' || order.seller === 'preparing') ? (
          <Button label="Signaler une rupture" variant="ghost" leadingIcon={TriangleAlert} onPress={() => setStockout(true)} fill />
        ) : null}
      </BottomBar>

      <Sheet
        visible={stockout}
        onClose={() => setStockout(false)}
        title="Signaler une rupture"
        footer={
          <>
            <Button label="Annuler" variant="outline" onPress={() => setStockout(false)} style={{ flex: 1 }} />
            <Button
              label="Signaler"
              variant="danger"
              haptic="warning"
              onPress={() => {
                dispatch({ type: 'seller/markOutOfStock', productIds: ownProducts });
                setStockout(false);
                toast('Rupture signalée : l’équipe YA YO te contacte pour la suite de la commande.', 'success');
              }}
              style={{ flex: 1 }}
            />
          </>
        }
      >
        <Text variant="bodyM" color={color.text.secondary}>
          Les articles de cette commande passent en rupture dans ton catalogue. L’équipe YA YO te contacte pour décider de la suite avec l’acheteur ; ses fonds restent protégés.
        </Text>
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  caps: { letterSpacing: 0.6 },
  client: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: color.bg.accentSubtle, alignItems: 'center', justifyContent: 'center' },
});
