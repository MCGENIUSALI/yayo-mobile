import {
  Ban,
  Banknote,
  Bike,
  CircleX,
  Clock,
  LoaderCircle,
  PackageCheck,
  Scale,
  ShieldCheck,
  Store,
  Truck,
  Undo2,
  type LucideIcon,
} from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import type { DeliveryStatus, Order, PaymentStatus } from '@/domain/types';
import { color, radius, space } from '@/theme/tokens';
import { Text } from './Text';

interface BadgeTone {
  bg: string;
  fg: string;
  icon: string;
}

const tones = {
  neutral: { bg: color.bg.surfaceSunken, fg: color.text.secondary, icon: color.icon.secondary },
  warning: { bg: color.bg.warningSubtle, fg: color.text.warning, icon: color.icon.warning },
  info: { bg: color.bg.infoSubtle, fg: color.text.info, icon: color.icon.info },
  success: { bg: color.bg.successSubtle, fg: color.text.success, icon: color.icon.success },
  danger: { bg: color.bg.dangerSubtle, fg: color.text.danger, icon: color.icon.danger },
  escrow: { bg: color.bg.inverse, fg: color.text.inverse, icon: color.icon.inverse },
  accent: { bg: color.bg.accentSubtle, fg: color.text.accent, icon: color.icon.accent },
} satisfies Record<string, BadgeTone>;

export type BadgeToneName = keyof typeof tones;

/** Badge (997:120): always label + icon, colour never carries the meaning alone. */
export function Badge({ label, icon: Icon, tone = 'neutral' }: { label: string; icon?: LucideIcon; tone?: BadgeToneName }) {
  const t = tones[tone];
  return (
    <View style={[styles.badge, { backgroundColor: t.bg, paddingLeft: Icon ? space.sm : 10 }]}>
      {Icon ? <Icon size={14} color={t.icon} strokeWidth={2} /> : null}
      <Text variant="labelS" color={t.fg} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const paymentBadges: Record<PaymentStatus, { label: string; icon: LucideIcon; tone: BadgeToneName }> = {
  initiated: { label: 'Paiement initié', icon: Clock, tone: 'neutral' },
  pending: { label: 'En attente de paiement', icon: LoaderCircle, tone: 'warning' },
  held_in_escrow: { label: 'Fonds sécurisés', icon: ShieldCheck, tone: 'escrow' },
  in_delivery: { label: 'En livraison', icon: Truck, tone: 'info' },
  delivered: { label: 'Livré', icon: PackageCheck, tone: 'success' },
  released: { label: 'Livré', icon: PackageCheck, tone: 'success' },
  failed: { label: 'Paiement échoué', icon: CircleX, tone: 'danger' },
  refunded: { label: 'Remboursé', icon: Undo2, tone: 'neutral' },
  disputed: { label: 'Litige en cours', icon: Scale, tone: 'danger' },
};

/** Payment Status (997:188), 1:1 with the escrow state machine. */
export function PaymentStatusBadge({ status, method, cancellation }: { status: PaymentStatus; method?: Order['method']; cancellation?: Order['cancellation'] }) {
  // D19: a cancelled order says so first; the refund state is detailed on the order.
  if (cancellation) return <Badge label={cancellation.refund === 'sent' ? 'Annulée · remboursement en cours' : 'Annulée'} icon={Ban} tone="neutral" />;
  if (status === 'pending' && method === 'cash') return <Badge label="Paiement à la livraison" icon={Banknote} tone="neutral" />;
  const b = paymentBadges[status];
  return <Badge label={b.label} icon={b.icon} tone={b.tone} />;
}

const deliveryBadges: Record<DeliveryStatus, { label: string; icon: LucideIcon; tone: BadgeToneName }> = {
  unassigned: { label: 'En préparation', icon: Store, tone: 'neutral' },
  assigned: { label: 'Livreur assigné', icon: Bike, tone: 'neutral' },
  picking_up: { label: 'En collecte', icon: Store, tone: 'accent' },
  delivering: { label: 'En livraison', icon: Bike, tone: 'info' },
  delivered: { label: 'Livrée', icon: PackageCheck, tone: 'success' },
  failed: { label: 'Échec de livraison', icon: CircleX, tone: 'danger' },
};

/** Delivery Status (997:226). */
export function DeliveryStatusBadge({ status }: { status: DeliveryStatus }) {
  const b = deliveryBadges[status];
  return <Badge label={b.label} icon={b.icon} tone={b.tone} />;
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingRight: 10,
    paddingVertical: space.xs,
    borderRadius: radius.full,
    alignSelf: 'flex-start',
  },
});
