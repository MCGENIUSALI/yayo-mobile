import { FlaskConical } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { nextRoleEvents, type OrderEvent, type OrderEventType } from '@/domain/orderMachine';
import { pickupCodeFor } from '@/domain/seller';
import type { Order } from '@/domain/types';
import { useStore } from '@/store/AppStore';
import { color, radius, space } from '@/theme/tokens';
import { Button } from './Button';
import { Text } from './Text';

const LABELS: Record<OrderEventType, { actor: 'seller' | 'courier'; label: string } | undefined> = {
  'seller.start_preparing': { actor: 'seller', label: 'Vendeur · commencer la préparation' },
  'seller.mark_ready': { actor: 'seller', label: 'Vendeur · prêt pour la collecte' },
  'courier.accept': { actor: 'courier', label: 'Livreur · accepter la mission' },
  'courier.decline': undefined,
  'courier.arrive': undefined,
  'courier.report_incident': undefined,
  'courier.collect': { actor: 'courier', label: 'Livreur · colis collecté' },
  'courier.confirm_delivery': { actor: 'courier', label: 'Livreur · saisir le code de réception' },
  'escrow.release': undefined,
  'buyer.cancel': undefined,
  'refund.received': undefined,
};

/**
 * Demo console: plays the seller and courier roles on the shared order state
 * machine, so the buyer journey can be tested end to end without the other apps.
 */
export function DemoConsole({ order }: { order: Order }) {
  const { dispatch } = useStore();
  const next = nextRoleEvents(order).filter((t) => LABELS[t]);
  if (next.length === 0) return null;
  return (
    <View style={styles.box}>
      <View style={styles.title}>
        <FlaskConical size={16} color={color.icon.secondary} strokeWidth={2} />
        <Text variant="labelS" color={color.text.secondary}>
          Mode démo · simuler l’étape suivante
        </Text>
      </View>
      {next.map((type) => {
        const meta = LABELS[type]!;
        const event: OrderEvent =
          type === 'courier.confirm_delivery'
            ? { type, code: order.receiptCode, cashCollected: order.method === 'cash' }
            : type === 'courier.collect'
              ? { type, code: pickupCodeFor(order.id) }
              : ({ type } as OrderEvent);
        return (
          <Button
            key={type}
            label={meta.label}
            size="M"
            variant="outline"
            haptic="light"
            fill
            onPress={() => dispatch({ type: 'order/event', orderId: order.id, event, actor: meta.actor })}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: color.border.strong,
    borderRadius: radius.lg,
    padding: space.lg,
    gap: space.md,
  },
  title: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
});
