import { Image } from 'expo-image';
import { Camera, ChevronRight, ShieldCheck, Sparkles, TrendingDown, TrendingUp, X, type LucideIcon } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { StyleSheet, Switch, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { products } from '@/domain/catalog';
import { formatTime } from '@/domain/format';
import { formatFC } from '@/domain/money';
import { orderNet, type Photo } from '@/domain/seller';
import type { Order } from '@/domain/types';
import { pressScale } from '@/theme/motion';
import { color, radius, space } from '@/theme/tokens';
import { Button } from './Button';
import { useEnter } from './Feedback';
import { PageIndicator } from './Form';
import { haptic, PressableScale } from './Pressable';
import { Sheet } from './Sheet';
import { Badge } from './Status';
import { Text } from './Text';

/* ---------- Step header ("Étape 1 sur 3 · Boutique") ---------- */

export function Steps({ count, step, label }: { count: number; step: number; label: string }) {
  return (
    <View style={styles.steps}>
      <PageIndicator count={count} index={step - 1} />
      <Text variant="labelM" color={color.text.secondary}>
        Étape {step} sur {count} · {label}
      </Text>
    </View>
  );
}

/* ---------- KPI tile (V4, V11) ---------- */

export function TrendPill({ value, suffix, tone }: { value: string; suffix?: string; tone: 'up' | 'down' | 'flat' | 'success' }) {
  const t =
    tone === 'down'
      ? { bg: color.bg.dangerSubtle, fg: color.text.danger, Icon: TrendingDown }
      : tone === 'flat'
        ? { bg: color.bg.surfaceSunken, fg: color.text.secondary, Icon: undefined }
        : { bg: color.bg.successSubtle, fg: color.text.success, Icon: TrendingUp };
  return (
    <View style={[styles.trend, { backgroundColor: t.bg }]}>
      {t.Icon ? <t.Icon size={14} color={t.fg} strokeWidth={2} /> : null}
      <Text variant="labelS" color={t.fg} numberOfLines={1} style={{ flexShrink: 1 }}>
        {value}
        {suffix ? ` ${suffix}` : ''}
      </Text>
    </View>
  );
}

export function StatTile({ icon: Icon, label, value, footer }: { icon: LucideIcon; label: string; value: string; footer?: ReactNode }) {
  return (
    <View style={styles.tile} accessible accessibilityLabel={`${label} : ${value}`}>
      <View style={styles.tileHead}>
        <View style={styles.tileIcon}>
          <Icon size={18} color={color.icon.primary} strokeWidth={2} />
        </View>
        <Text variant="bodyS" color={color.text.secondary} style={styles.flex} numberOfLines={2}>
          {label}
        </Text>
      </View>
      <Text variant="h3" numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      {footer}
    </View>
  );
}

/* ---------- Seller order card (V4, V5) ---------- */

export function NewBadge() {
  return <Badge label="Nouvelle" icon={Sparkles} tone="accent" />;
}

export function EscrowBadge({ order }: { order: Order }) {
  if (order.method === 'cash') return <Badge label="Paiement à la livraison" tone="neutral" />;
  if (order.payment === 'released') return <Badge label="Paiement libéré" icon={ShieldCheck} tone="success" />;
  return <Badge label="Fonds sécurisés" icon={ShieldCheck} tone="escrow" />;
}

const ACTION: Record<Order['seller'], string> = {
  new: 'Préparer la commande',
  preparing: 'Continuer la préparation',
  ready: 'Remettre au livreur',
  handed_over: 'Voir la commande',
};

export function SellerOrderCard({ order, index = 0, onOpen, onAction }: { order: Order; index?: number; onOpen: () => void; onAction?: () => void }) {
  const entering = useEnter(index);
  const net = orderNet(order).net;
  return (
    <Animated.View entering={entering} style={styles.card}>
      <PressableScale
        accessibilityRole="link"
        accessibilityLabel={`Commande ${order.id}, ${formatFC(net)} net estimé`}
        onPress={onOpen}
        scaleTo={pressScale.card}
        style={{ gap: space.md }}
      >
        <View style={styles.cardHead}>
          <View style={styles.flex}>
            <Text variant="labelM">#{order.id}</Text>
            <Text variant="bodyS" color={color.text.secondary} numberOfLines={1}>
              {order.buyer?.name ?? 'Client'} · {order.buyer?.commune ?? 'Kinshasa'} · {formatTime(order.milestones.paidAt ?? order.milestones.createdAt)}
            </Text>
          </View>
          {order.seller === 'new' ? <NewBadge /> : null}
        </View>
        <View style={{ gap: 2 }}>
          {order.lines.map((l) => (
            <Text key={`${l.productId}|${l.color}`} variant="bodyM">
              {l.qty}× {l.name.split(' – ')[0]} ({l.color})
            </Text>
          ))}
        </View>
        <View style={styles.between}>
          <Text variant="bodyS" color={color.text.secondary}>
            Montant net estimé
          </Text>
          <Text variant="priceS">{formatFC(net)}</Text>
        </View>
        <EscrowBadge order={order} />
      </PressableScale>
      <Button label={ACTION[order.seller]} size="M" haptic="medium" variant={order.seller === 'handed_over' ? 'outline' : 'primary'} onPress={onAction ?? onOpen} fill />
    </Animated.View>
  );
}

/* ---------- Menu row (V12) ---------- */

export function MenuGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={{ gap: space.sm }}>
      <Text variant="caption" color={color.text.secondary} style={{ letterSpacing: 0.6 }}>
        {title.toUpperCase()}
      </Text>
      <View style={styles.menu}>{children}</View>
    </View>
  );
}

export function MenuRow({ icon: Icon, title, subtitle, onPress, tone = 'default' }: { icon: LucideIcon; title: string; subtitle?: string; onPress: () => void; tone?: 'default' | 'danger' }) {
  return (
    <PressableScale accessibilityRole="button" accessibilityLabel={subtitle ? `${title}, ${subtitle}` : title} onPress={onPress} haptic="selection" scaleTo={pressScale.card} style={styles.menuRow}>
      <View style={styles.menuIcon}>
        <Icon size={20} color={tone === 'danger' ? color.icon.danger : color.icon.primary} strokeWidth={2} />
      </View>
      <View style={styles.flex}>
        <Text variant="labelL" color={tone === 'danger' ? color.text.danger : color.text.primary}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="bodyS" color={color.text.secondary} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <ChevronRight size={20} color={color.icon.secondary} strokeWidth={2} />
    </PressableScale>
  );
}

/* ---------- Switch row (V14 "Produit en ligne") ---------- */

export function SwitchRow({ title, subtitle, value, onChange }: { title: string; subtitle: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={styles.switchRow}>
      <View style={styles.flex}>
        <Text variant="labelL">{title}</Text>
        <Text variant="bodyS" color={color.text.secondary}>
          {subtitle}
        </Text>
      </View>
      <Switch
        accessibilityLabel={title}
        value={value}
        onValueChange={(v) => {
          haptic('selection');
          onChange(v);
        }}
        trackColor={{ false: color.border.strong, true: color.bg.success }}
        thumbColor={color.bg.surface}
        ios_backgroundColor={color.border.strong}
      />
    </View>
  );
}

/* ---------- Photos (V1 logo, V2 pièces, V9 photos produit) ---------- */

/**
 * Demo gallery: Expo Go cannot add the native image picker without a new build
 * from this environment, so "Ajouter" picks one of the demo pictures. The real
 * picker (expo-image-picker, camera + gallery) plugs into `onPick`.
 */
const DEMO_GALLERY: Photo[] = Object.values(products)
  .map((p) => p.image)
  .filter((x): x is number => x !== undefined);

export function AddPhotoTile({ label = 'Ajouter', size = 96, onPick, title }: { label?: string; size?: number; onPick: (p: Photo) => void; title: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={`${title} : ajouter une photo`}
        onPress={() => setOpen(true)}
        haptic="selection"
        scaleTo={pressScale.card}
        style={[styles.addTile, { width: size, height: size }]}
      >
        <Camera size={20} color={color.icon.secondary} strokeWidth={2} />
        <Text variant="caption" color={color.text.secondary}>
          {label}
        </Text>
      </PressableScale>
      <Sheet visible={open} onClose={() => setOpen(false)} title={title}>
        <Text variant="bodyS" color={color.text.secondary}>
          Démo : choisis une image. Dans l’app publiée, ce bouton ouvre l’appareil photo ou la galerie.
        </Text>
        <View style={styles.gallery}>
          {DEMO_GALLERY.map((src, i) => (
            <PressableScale
              key={i}
              accessibilityRole="button"
              accessibilityLabel={`Image de démo ${i + 1}`}
              onPress={() => {
                onPick(src);
                setOpen(false);
              }}
              haptic="selection"
              scaleTo={pressScale.card}
            >
              <Image source={src} style={styles.galleryItem} contentFit="cover" />
            </PressableScale>
          ))}
        </View>
      </Sheet>
    </>
  );
}

export function PhotoTile({ photo, size = 96, onRemove, label }: { photo: Photo; size?: number; onRemove?: () => void; label: string }) {
  return (
    <View style={[styles.photo, { width: size, height: size }]}>
      <Image source={photo} style={StyleSheet.absoluteFill} contentFit="cover" accessibilityLabel={label} />
      {onRemove ? (
        <PressableScale accessibilityRole="button" accessibilityLabel={`Retirer ${label}`} onPress={onRemove} hitSlop={6} scaleTo={pressScale.icon} style={styles.remove}>
          <X size={16} color={color.icon.primary} strokeWidth={2.5} />
        </PressableScale>
      ) : null}
    </View>
  );
}

/* ---------- Status note ---------- */

export function EmptyState({ icon: Icon, title, body, action }: { icon: LucideIcon; title: string; body: string; action?: ReactNode }) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Icon size={32} color={color.icon.secondary} strokeWidth={1.8} />
      </View>
      <Text variant="h4" align="center">
        {title}
      </Text>
      <Text variant="bodyM" color={color.text.secondary} align="center">
        {body}
      </Text>
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  steps: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  trend: { flexDirection: 'row', alignItems: 'center', gap: space.xs, alignSelf: 'flex-start', maxWidth: '100%', borderRadius: radius.full, paddingHorizontal: space.sm, paddingVertical: 2 },
  tile: {
    flex: 1,
    minWidth: 0,
    backgroundColor: color.bg.surface,
    borderWidth: 1,
    borderColor: color.border.subtle,
    borderRadius: radius.lg,
    padding: space.lg,
    gap: space.sm,
  },
  tileHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  tileIcon: { width: 32, height: 32, borderRadius: radius.sm, backgroundColor: color.bg.surfaceSunken, alignItems: 'center', justifyContent: 'center' },
  card: {
    backgroundColor: color.bg.surface,
    borderWidth: 1,
    borderColor: color.border.subtle,
    borderRadius: radius.lg,
    padding: space.lg,
    gap: space.lg,
  },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  menu: { backgroundColor: color.bg.surface, borderRadius: radius.lg, overflow: 'hidden' },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md, minHeight: 64 },
  menuIcon: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: color.bg.surfaceSunken, alignItems: 'center', justifyContent: 'center' },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: color.bg.surface,
    borderRadius: radius.lg,
    padding: space.lg,
  },
  addTile: {
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: color.border.strong,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs,
  },
  photo: { borderRadius: radius.md, overflow: 'hidden', backgroundColor: color.bg.surfaceSunken },
  remove: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: color.bg.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gallery: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, paddingBottom: space.sm },
  galleryItem: { width: 96, height: 96, borderRadius: radius.md },
  empty: { alignItems: 'center', gap: space.md, paddingTop: space.screen * 2, paddingHorizontal: space.lg },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: color.bg.surfaceSunken, alignItems: 'center', justifyContent: 'center' },
});
