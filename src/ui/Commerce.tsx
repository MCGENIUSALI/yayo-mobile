import { Image } from 'expo-image';
import { BadgeCheck, Lock, Minus, PackageCheck, Plus, ShieldCheck, Star, Truck, Undo2, Package } from 'lucide-react-native';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { formatFC, formatUSD } from '@/domain/money';
import type { Product, Shop } from '@/domain/types';
import { pressScale } from '@/theme/motion';
import { color, radius, space } from '@/theme/tokens';
import { PressableScale } from './Pressable';
import { Text } from './Text';

/* ---------- Summary Row (1000:440) ---------- */

export function SummaryRow({
  label,
  value,
  type = 'default',
}: {
  label: string;
  value: string;
  type?: 'default' | 'discount' | 'total';
}) {
  if (type === 'total') {
    return (
      <View style={[styles.row, { minHeight: 32 }]}>
        <Text variant="h4">{label}</Text>
        <Text variant="priceL">{value}</Text>
      </View>
    );
  }
  return (
    <View style={styles.row}>
      <Text variant="bodyM" color={color.text.secondary} style={styles.shrink}>
        {label}
      </Text>
      <Text variant="labelM" color={type === 'discount' ? color.text.success : color.text.primary}>
        {value}
      </Text>
    </View>
  );
}

/* ---------- Escrow Banner (1000:470) ---------- */

export function EscrowBanner({ variant = 'compact' }: { variant?: 'compact' | 'detailed' }) {
  if (variant === 'compact') {
    return (
      <View style={styles.escrowCompact} accessibilityRole="text">
        <ShieldCheck size={18} color={color.icon.success} strokeWidth={2} />
        <Text variant="labelS" color={color.text.success}>
          Paiement 100 % sécurisé par YA YO Escrow
        </Text>
      </View>
    );
  }
  const points = [
    { Icon: Lock, text: 'Ton argent est bloqué par YA YO, pas par le vendeur' },
    { Icon: PackageCheck, text: 'Le vendeur est payé après la livraison confirmée' },
    { Icon: Undo2, text: 'Remboursé si le colis n’arrive pas ou n’est pas conforme' },
  ];
  return (
    <View style={styles.escrowDetailed}>
      <View style={styles.inline}>
        <ShieldCheck size={22} color={color.icon.success} strokeWidth={2} />
        <Text variant="labelL" color={color.text.inverse}>
          Protection YA YO Escrow
        </Text>
      </View>
      {points.map(({ Icon, text }) => (
        <View key={text} style={[styles.inline, { gap: 10 }]}>
          <Icon size={16} color={color.icon.success} strokeWidth={2} />
          <Text variant="bodyS" color={color.text.inverse} style={[styles.shrink, { opacity: 0.85 }]}>
            {text}
          </Text>
        </View>
      ))}
    </View>
  );
}

/* ---------- Quantity Stepper (996:340) ---------- */

export function QuantityStepper({
  value,
  max,
  onChange,
  size = 'S',
  min = 1,
  label,
}: {
  value: number;
  max: number;
  onChange: (next: number) => void;
  size?: 'S' | 'M';
  min?: number;
  label: string;
}) {
  const d = size === 'S' ? { h: 36, btn: 28, icon: 16, text: 'labelM' as const } : { h: 44, btn: 36, icon: 20, text: 'labelL' as const };
  const canDec = value > min;
  const canInc = value < max;
  return (
    <View
      style={[styles.stepper, { height: d.h }]}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={`Quantité ${label}`}
      accessibilityValue={{ min, max, now: value }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => {
        if (e.nativeEvent.actionName === 'increment' && canInc) onChange(value + 1);
        if (e.nativeEvent.actionName === 'decrement' && canDec) onChange(value - 1);
      }}
    >
      <PressableScale
        accessibilityLabel="Diminuer"
        disabled={!canDec}
        scaleTo={pressScale.icon}
        haptic="selection"
        hitSlop={6}
        onPress={() => onChange(value - 1)}
        style={[styles.stepBtn, { width: d.btn, height: d.btn }]}
      >
        <Minus size={d.icon} color={canDec ? color.icon.primary : color.icon.disabled} strokeWidth={2} />
      </PressableScale>
      <Text variant={d.text} align="center" style={{ width: 24 }}>
        {value}
      </Text>
      <PressableScale
        accessibilityLabel="Augmenter"
        disabled={!canInc}
        scaleTo={pressScale.icon}
        haptic="selection"
        hitSlop={6}
        onPress={() => onChange(value + 1)}
        style={[styles.stepBtn, { width: d.btn, height: d.btn }]}
      >
        <Plus size={d.icon} color={canInc ? color.icon.primary : color.icon.disabled} strokeWidth={2} />
      </PressableScale>
    </View>
  );
}

/* ---------- Avatar (997:259) + Vendor Header (1000:408) ---------- */

export function Avatar({ initials, verified = false, photo }: { initials: string; verified?: boolean; photo?: string | number }) {
  return (
    <View style={styles.avatar}>
      {photo ? (
        <Image source={photo} style={styles.avatarPhoto} contentFit="cover" accessibilityIgnoresInvertColors />
      ) : (
        <Text variant="labelM" color={color.text.accent}>
          {initials}
        </Text>
      )}
      {verified ? (
        <View style={styles.verified}>
          <BadgeCheck size={14} color={color.icon.info} fill={color.bg.surface} strokeWidth={2} />
        </View>
      ) : null}
    </View>
  );
}

export function VendorHeader({ shop, showDelivery = true }: { shop: Shop; showDelivery?: boolean }) {
  return (
    <View style={styles.vendor}>
      <Avatar initials={shop.initials} verified={shop.verified} />
      <View style={styles.shrink}>
        <Text variant="labelM" numberOfLines={1}>
          {shop.name}
        </Text>
        <Text variant="bodyS" color={color.text.secondary} numberOfLines={1}>
          {shop.verified ? 'Vendeur certifié' : 'Vendeur'} · {shop.area}
        </Text>
      </View>
      {showDelivery ? (
        <View style={styles.pill}>
          <Truck size={14} color={color.icon.secondary} strokeWidth={2} />
          <Text variant="labelS" color={color.text.secondary}>
            {shop.deliveryLead}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

/* ---------- Product image ---------- */

/**
 * Product photo. Real catalogue photos are not in the repo yet (the Figma
 * image export is blocked from the build environment), so the tile shows the
 * product's tint + package glyph until `product.image` is provided.
 */
export function ProductImage({
  product,
  size,
  rounded = radius.md,
  style,
}: {
  product: Product;
  size?: number;
  rounded?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const box = size ? { width: size, height: size } : null;
  return (
    <View style={[styles.imageTile, box, { borderRadius: rounded, backgroundColor: product.tint }, style]}>
      {product.image ? (
        <Image source={product.image} style={StyleSheet.absoluteFill} contentFit="cover" transition={160} />
      ) : (
        <Package size={size ? Math.round(size * 0.36) : 64} color="rgba(255,255,255,0.75)" strokeWidth={1.5} />
      )}
    </View>
  );
}

/* ---------- Price block ---------- */

export function PriceBlock({ amount, size = 'S', note }: { amount: number; size?: 'S' | 'L'; note?: string }) {
  return (
    <View>
      <Text variant={size === 'L' ? 'priceL' : 'priceS'}>{formatFC(amount)}</Text>
      <Text variant="caption" color={size === 'L' ? color.text.secondary : color.text.tertiary}>
        {formatUSD(amount)}
        {note ? ` · ${note}` : ''}
      </Text>
    </View>
  );
}

/* ---------- Rating (997:288) ---------- */

export function Rating({ value, count }: { value: number; count?: number }) {
  return (
    <View style={styles.inline} accessibilityLabel={`Note ${value} sur 5${count ? `, ${count} avis` : ''}`}>
      <View style={{ flexDirection: 'row', gap: 2 }}>
        {[1, 2, 3, 4, 5].map((i) => (
          <Star
            key={i}
            size={20}
            strokeWidth={2}
            color={color.icon.warning}
            fill={value >= i ? color.icon.warning : 'transparent'}
          />
        ))}
      </View>
      <Text variant="labelM">{value.toLocaleString('fr-FR')}</Text>
      {count !== undefined ? (
        <Text variant="bodyM" color={color.text.tertiary}>
          ({count} avis)
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm, minHeight: 20 },
  shrink: { flex: 1, minWidth: 0 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  escrowCompact: {
    minHeight: 44,
    borderRadius: radius.md,
    backgroundColor: color.bg.successSubtle,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    paddingHorizontal: space.md,
  },
  escrowDetailed: {
    backgroundColor: color.bg.inverse,
    borderRadius: radius.lg,
    paddingHorizontal: space.xl,
    paddingVertical: space.lg,
    gap: space.md,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.xs,
    borderRadius: radius.full,
    backgroundColor: color.bg.surfaceSunken,
  },
  stepBtn: {
    borderRadius: radius.full,
    backgroundColor: color.bg.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: color.bg.accentSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarPhoto: { width: 40, height: 40, borderRadius: 20 },
  verified: { position: 'absolute', left: 28, top: 28, width: 14, height: 14, borderRadius: 7, backgroundColor: color.bg.surface },
  vendor: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingLeft: space.sm,
    paddingRight: 10,
    paddingVertical: space.xs,
    borderRadius: radius.full,
    backgroundColor: color.bg.surfaceSunken,
  },
  imageTile: { overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
});

