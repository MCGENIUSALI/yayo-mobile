import { Image } from 'expo-image';
import { BadgeCheck, Check, Plus } from 'lucide-react-native';
import { Share, StyleSheet, View } from 'react-native';
import { getProduct, getShop } from '@/domain/catalog';
import { formatFC, formatUSD } from '@/domain/money';
import type { Post, Shop } from '@/domain/types';
import { useStore } from '@/store/AppStore';
import { pressScale } from '@/theme/motion';
import { color, radius, space } from '@/theme/tokens';
import { Button } from './Button';
import { ProductImage } from './Commerce';
import { PressableScale } from './Pressable';
import { Text } from './Text';

/* ---------- Avatar with photo (Avatar 997:239) ---------- */

export function ShopAvatar({ shop, size = 40, ring = false }: { shop: Shop; size?: number; ring?: boolean }) {
  const r = size / 2;
  return (
    <View style={{ width: size, height: size }}>
      <View
        style={[
          styles.avatar,
          { width: size, height: size, borderRadius: r },
          ring && { borderWidth: 2, borderColor: color.bg.surface },
        ]}
      >
        {shop.avatar ? (
          <Image source={shop.avatar} style={StyleSheet.absoluteFill} contentFit="cover" accessibilityIgnoresInvertColors />
        ) : (
          <Text variant={size >= 48 ? 'labelL' : 'labelM'} color={color.text.accent}>
            {shop.initials}
          </Text>
        )}
      </View>
      {shop.verified ? (
        <View style={styles.verified}>
          <BadgeCheck size={14} color={color.icon.info} fill={color.bg.surface} strokeWidth={2} />
        </View>
      ) : null}
    </View>
  );
}

/* ---------- Follow ---------- */

export function useFollow(shopId: string) {
  const { state, dispatch } = useStore();
  const following = state.social.following.includes(shopId);
  const toggle = () => dispatch({ type: 'social/toggle', list: 'following', id: shopId });
  return { following, toggle };
}

export function FollowButton({ shopId, tone = 'light' }: { shopId: string; tone?: 'light' | 'chip' }) {
  const { following, toggle } = useFollow(shopId);
  const name = getShop(shopId).name;
  if (tone === 'chip') {
    return (
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={following ? `Ne plus suivre ${name}` : `Suivre ${name}`}
        accessibilityState={{ selected: following }}
        onPress={toggle}
        haptic="selection"
        scaleTo={pressScale.icon}
        style={[styles.chip, following && styles.chipOn]}
      >
        <Text variant="labelS" color={following ? color.text.inverse : color.text.accent}>
          {following ? 'Abonné' : 'Suivre'}
        </Text>
      </PressableScale>
    );
  }
  return (
    <Button
      label={following ? 'Abonné' : 'Suivre'}
      leadingIcon={following ? Check : undefined}
      variant={following ? 'ghost' : 'outline'}
      size="S"
      haptic="selection"
      onPress={toggle}
      accessibilityHint={following ? `Ne plus suivre ${name}` : `Suivre ${name}`}
    />
  );
}

/** Small "+" badge under the avatar on the video rail. */
export function FollowBadge({ shopId }: { shopId: string }) {
  const { following, toggle } = useFollow(shopId);
  if (following) return null;
  return (
    <PressableScale
      accessibilityLabel={`Suivre ${getShop(shopId).name}`}
      onPress={toggle}
      haptic="selection"
      scaleTo={pressScale.icon}
      hitSlop={8}
      style={styles.plus}
    >
      <Plus size={12} color={color.icon.inverse} strokeWidth={3} />
    </PressableScale>
  );
}

/* ---------- Product tag (ProductTag 1054:696) ---------- */

export function ProductTag({
  productId,
  onAdd,
  tone = 'dark',
  actionLabel = 'Ajouter',
}: {
  productId: string;
  onAdd: () => void;
  tone?: 'dark' | 'light';
  actionLabel?: string;
}) {
  const p = getProduct(productId);
  const dark = tone === 'dark';
  const out = p.stock <= 0;
  return (
    <View style={[styles.tag, dark ? styles.tagDark : styles.tagLight]}>
      <ProductImage product={p} size={48} rounded={radius.sm} />
      <View style={styles.flex}>
        <Text variant="labelM" color={dark ? color.text.inverse : color.text.primary} numberOfLines={1}>
          {p.shortName}
        </Text>
        <View style={styles.row}>
          <Text variant="priceS" color={dark ? color.text.inverse : color.text.primary}>
            {formatFC(p.price)}
          </Text>
          <Text variant="caption" color={dark ? 'rgba(255,255,255,0.7)' : color.text.tertiary} numberOfLines={1}>
            {formatUSD(p.price)}
          </Text>
        </View>
      </View>
      <Button
        label={out ? 'Rupture' : actionLabel}
        variant="accent"
        size="S"
        disabled={out}
        haptic="selection"
        onPress={onAdd}
        accessibilityHint={`Choisir la couleur et la quantité de ${p.shortName}`}
      />
    </View>
  );
}

export async function sharePost(post: Post) {
  const shop = getShop(post.shopId);
  const p = post.productIds[0] ? getProduct(post.productIds[0]) : undefined;
  try {
    await Share.share({
      message: `${shop.name} sur YA YO : ${post.caption}${p ? ` · ${p.shortName}, ${formatFC(p.price)}` : ''}`,
    });
  } catch {
    // The share sheet was dismissed or is unavailable (web): nothing to recover.
  }
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  row: { flexDirection: 'row', alignItems: 'baseline', gap: space.xs },
  avatar: { backgroundColor: color.bg.accentSubtle, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  verified: { position: 'absolute', right: -3, bottom: -3, borderRadius: 8, backgroundColor: color.bg.surface },
  chip: {
    height: 28,
    paddingHorizontal: space.md,
    borderRadius: radius.full,
    backgroundColor: color.bg.accentSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipOn: { backgroundColor: 'rgba(255,255,255,0.18)' },
  plus: {
    position: 'absolute',
    bottom: -8,
    alignSelf: 'center',
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: color.bg.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tag: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.sm, borderRadius: radius.lg },
  tagDark: { backgroundColor: 'rgba(10,10,11,0.72)' },
  tagLight: { backgroundColor: color.bg.surfaceMuted },
});
