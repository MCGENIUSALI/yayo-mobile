import { Image } from 'expo-image';
import { router } from 'expo-router';
import {
  Bell,
  Bookmark,
  ChevronRight,
  Heart,
  House,
  MessageCircle,
  MoreHorizontal,
  Play,
  Search,
  Share2,
  Shirt,
  SlidersHorizontal,
  Smartphone,
  Sparkles,
  Tag,
  type LucideIcon,
} from 'lucide-react-native';
import { useState } from 'react';
import { FlatList, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getShop, products } from '@/domain/catalog';
import { formatCount, posts } from '@/domain/feed';
import { formatFC } from '@/domain/money';
import { socialCount, type SocialToggle } from '@/domain/state';
import type { Post, Product } from '@/domain/types';
import { useStore } from '@/store/AppStore';
import { duration, pressScale, spring } from '@/theme/motion';
import { color, HIT, radius, space } from '@/theme/tokens';
import { CartButton } from '@/ui/CartButton';
import { ProductImage } from '@/ui/Commerce';
import { useEnter, useToast } from '@/ui/Feedback';
import { haptic, PressableScale } from '@/ui/Pressable';
import { QuickBuySheet } from '@/ui/QuickBuySheet';
import { FollowButton, ProductTag, sharePost, ShopAvatar } from '@/ui/Social';
import { Badge } from '@/ui/Status';
import { Text } from '@/ui/Text';

const CATEGORIES: { label: string; icon: LucideIcon }[] = [
  { label: 'Mode', icon: Shirt },
  { label: 'Électro', icon: Smartphone },
  { label: 'Beauté', icon: Sparkles },
  { label: 'Maison', icon: House },
  { label: 'Promo', icon: Tag },
];

/** B1 · Accueil: search, categories, promo, shop feed, then the catalogue grid. */
export default function Home() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const toast = useToast();
  const [sheetProduct, setSheetProduct] = useState<string | null>(null);
  const cardW = (width - space.screen * 2 - space.md) / 2;
  const grid = Object.values(products);

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + space.sm }]}>
        <View style={styles.logo} accessibilityRole="header" accessibilityLabel="YA YO">
          <Text variant="h2">YA</Text>
          <View style={styles.yo}>
            <Text variant="h3" color={color.text.inverse}>
              YO!
            </Text>
          </View>
        </View>
        <View style={styles.headerActions}>
          <PressableScale
            accessibilityLabel="Alertes"
            onPress={() => router.navigate('/alertes')}
            scaleTo={pressScale.icon}
            haptic="selection"
            style={styles.bell}
          >
            <Bell size={24} color={color.icon.primary} strokeWidth={2} />
          </PressableScale>
          <CartButton />
        </View>
      </View>

      <FlatList
        data={posts}
        keyExtractor={(p) => p.id}
        contentContainerStyle={{ paddingBottom: space.screen }}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={{ gap: space.lg, paddingBottom: space.md }}>
            <View style={styles.searchRow}>
              <PressableScale
                accessibilityRole="search"
                accessibilityLabel="Rechercher un produit, une boutique"
                onPress={() => router.navigate('/explorer')}
                scaleTo={pressScale.card}
                style={styles.search}
              >
                <Search size={20} color={color.icon.secondary} strokeWidth={2} />
                <Text variant="bodyM" color={color.text.tertiary} numberOfLines={1} style={styles.flex}>
                  Rechercher un produit, une boutique…
                </Text>
                <View style={styles.filter}>
                  <SlidersHorizontal size={18} color={color.icon.inverse} strokeWidth={2} />
                </View>
              </PressableScale>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categories}>
              {CATEGORIES.map(({ label, icon: Icon }) => (
                <PressableScale
                  key={label}
                  accessibilityRole="button"
                  accessibilityLabel={`Catégorie ${label}`}
                  onPress={() => toast(`La catégorie ${label} arrive avec l’Explorer (E3).`)}
                  haptic="selection"
                  scaleTo={pressScale.icon}
                  style={styles.category}
                >
                  <View style={styles.categoryIcon}>
                    <Icon size={24} color={color.icon.primary} strokeWidth={2} />
                  </View>
                  <Text variant="labelS">{label}</Text>
                </PressableScale>
              ))}
            </ScrollView>

            <PromoBanner />

            <View style={styles.sectionHead}>
              <Text variant="h4" accessibilityRole="header">
                Fil des boutiques
              </Text>
              <PressableScale
                accessibilityRole="link"
                accessibilityLabel="Abonnements, voir les vidéos des boutiques suivies"
                onPress={() => router.push({ pathname: '/fil', params: { tab: 'abonnements' } })}
                scaleTo={pressScale.icon}
                hitSlop={8}
                style={styles.link}
              >
                <Text variant="labelM" color={color.text.accent}>
                  Abonnements
                </Text>
                <ChevronRight size={18} color={color.icon.accent} strokeWidth={2} />
              </PressableScale>
            </View>
          </View>
        }
        renderItem={({ item }) => <FeedPost post={item} width={width} onBuy={setSheetProduct} />}
        ItemSeparatorComponent={() => <View style={{ height: space.lg }} />}
        ListFooterComponent={
          <View style={styles.gridWrap}>
            <Text variant="h4" accessibilityRole="header">
              Sélection du moment
            </Text>
            <View style={styles.grid}>
              {grid.map((p, i) => (
                <ProductCard key={p.id} product={p} index={i} width={cardW} />
              ))}
            </View>
          </View>
        }
      />
      <QuickBuySheet productId={sheetProduct} onClose={() => setSheetProduct(null)} />
    </View>
  );
}

/* ---------- Promo Banner (1002:584) ---------- */

function PromoBanner() {
  const go3 = products['jbl-go-3'];
  return (
    <View style={styles.promoWrap}>
      <View style={styles.promo}>
        <View style={styles.promoText}>
          <Text variant="caption" color={color.bg.accent} style={styles.overline}>
            LIVRAISON OFFERTE
          </Text>
          <Text variant="h3" color={color.text.inverse}>
            Dès 100 000 FC à Kinshasa
          </Text>
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel="J’en profite, voir la JBL Go 3"
            onPress={() => router.push({ pathname: '/produit/[id]', params: { id: 'jbl-go-3' } })}
            haptic="light"
            scaleTo={pressScale.button}
            style={styles.promoCta}
          >
            <Text variant="labelM" color={color.text.inverse}>
              J’en profite
            </Text>
          </PressableScale>
        </View>
        {go3?.image ? <Image source={go3.image} style={styles.promoImage} contentFit="cover" accessibilityIgnoresInvertColors /> : null}
      </View>
    </View>
  );
}

/* ---------- Feed Post (1002:400) ---------- */

function FeedPost({ post, width, onBuy }: { post: Post; width: number; onBuy: (productId: string) => void }) {
  const { state, dispatch } = useStore();
  const toast = useToast();
  const reduced = useReducedMotion();
  const shop = getShop(post.shopId);
  const featured = post.productIds[0];
  const is = (list: SocialToggle) => state.social[list].includes(post.id);
  const toggle = (list: SocialToggle) => dispatch({ type: 'social/toggle', list, id: post.id });
  const mediaH = Math.round(width * (420 / 402));

  const burst = useSharedValue(0);
  const burstStyle = useAnimatedStyle(() => ({ opacity: burst.value, transform: [{ scale: 0.6 + burst.value * 0.6 }] }));
  const open = () => {
    if (post.kind === 'video') router.push({ pathname: '/fil', params: { post: post.id } });
  };
  const like = () => {
    if (!is('liked')) toggle('liked');
    haptic('light');
    if (!reduced) burst.set(withSequence(withSpring(1, spring.select), withTiming(0, { duration: duration.slow })));
  };
  const taps = Gesture.Exclusive(
    Gesture.Tap().numberOfTaps(2).runOnJS(true).onEnd(like),
    Gesture.Tap().runOnJS(true).onEnd(open),
  );

  return (
    <View style={styles.post}>
      <View style={styles.postHead}>
        <ShopAvatar shop={shop} size={40} />
        <View style={styles.flex}>
          <Text variant="labelL" numberOfLines={1}>
            {shop.name}
          </Text>
          <Text variant="bodyS" color={color.text.secondary} numberOfLines={1}>
            {shop.category ?? 'Boutique'} · {shop.area}
          </Text>
        </View>
        <FollowButton shopId={shop.id} />
        <PressableScale accessibilityLabel="Plus d’options" onPress={() => toast('Options : signaler, masquer (bientôt).')} scaleTo={pressScale.icon} style={styles.more}>
          <MoreHorizontal size={22} color={color.icon.primary} strokeWidth={2} />
        </PressableScale>
      </View>

      <GestureDetector gesture={taps}>
        <View
          style={[styles.media, { height: mediaH }]}
          accessible
          accessibilityRole={post.kind === 'video' ? 'button' : 'image'}
          accessibilityLabel={`${post.kind === 'video' ? 'Vidéo' : 'Photo'} de ${shop.name}`}
          accessibilityHint={post.kind === 'video' ? 'Ouvre le fil vidéo' : 'Touche deux fois pour aimer'}
        >
          <Image source={post.media[0]} style={StyleSheet.absoluteFill} contentFit="cover" transition={160} />
          <View style={styles.counter}>
            <Text variant="labelS" color={color.text.inverse}>
              {post.kind === 'video' ? 'Vidéo' : `1/${Math.max(post.media.length, 1)}`}
            </Text>
          </View>
          {post.kind === 'video' ? (
            <View style={styles.playWrap} pointerEvents="none">
              <View style={styles.play}>
                <Play size={28} color={color.icon.inverse} fill={color.icon.inverse} strokeWidth={0} />
              </View>
            </View>
          ) : null}
          <Animated.View style={[styles.playWrap, burstStyle]} pointerEvents="none">
            <Heart size={96} color={color.icon.inverse} fill={color.bg.accent} strokeWidth={1} />
          </Animated.View>
        </View>
      </GestureDetector>

      <View style={styles.actionsRow}>
        <PostAction
          icon={Heart}
          label="J’aime"
          count={socialCount(post.likes, is('liked'))}
          active={is('liked')}
          activeColor={color.bg.accent}
          onPress={() => toggle('liked')}
        />
        <PostAction icon={MessageCircle} label="Commentaires" count={post.comments} onPress={() => toast('Les commentaires arrivent bientôt (SC4).')} />
        <PostAction icon={Share2} label="Partager" onPress={() => sharePost(post)} />
        <View style={styles.flex} />
        <PostAction
          icon={Bookmark}
          label="Enregistrer"
          count={socialCount(post.saves, is('saved'))}
          active={is('saved')}
          activeColor={color.icon.primary}
          onPress={() => toggle('saved')}
        />
      </View>

      <Text variant="bodyM" numberOfLines={3} style={styles.caption}>
        <Text variant="labelM">{shop.name} </Text>
        {post.caption}
      </Text>

      {featured ? (
        <View style={styles.tagWrap}>
          <ProductTag productId={featured} tone="light" onAdd={() => onBuy(featured)} />
        </View>
      ) : null}
    </View>
  );
}

function PostAction({
  icon: Icon,
  label,
  count,
  active = false,
  activeColor,
  onPress,
}: {
  icon: LucideIcon;
  label: string;
  count?: number;
  active?: boolean;
  activeColor?: string;
  onPress: () => void;
}) {
  const tint = active && activeColor ? activeColor : color.icon.primary;
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={count != null ? `${label}, ${formatCount(count)}` : label}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      haptic="light"
      scaleTo={pressScale.icon}
      style={styles.action}
    >
      <Icon size={24} color={tint} fill={active ? tint : 'transparent'} strokeWidth={2} />
      {count != null ? <Text variant="labelM">{formatCount(count)}</Text> : null}
    </PressableScale>
  );
}

/* ---------- Product Card (1000:325) ---------- */

function ProductCard({ product, index, width }: { product: Product; index: number; width: number }) {
  const entering = useEnter(index);
  const out = product.stock <= 0;
  return (
    <Animated.View entering={entering} style={{ width }}>
      <PressableScale
        accessibilityLabel={`${product.shortName}, ${formatFC(product.price)}${out ? ', en rupture' : ''}`}
        onPress={() => router.push({ pathname: '/produit/[id]', params: { id: product.id } })}
        scaleTo={pressScale.card}
        style={styles.card}
      >
        <ProductImage product={product} style={{ width: '100%', aspectRatio: 1 }} rounded={radius.md} />
        <View style={{ gap: 2 }}>
          <Text variant="labelM" numberOfLines={2}>
            {product.shortName}
          </Text>
          <Text variant="bodyS" color={color.text.secondary} numberOfLines={1}>
            {getShop(product.shopId).name}
          </Text>
        </View>
        <Text variant="priceS">{formatFC(product.price)}</Text>
        {out ? <Badge label="Rupture" tone="neutral" /> : null}
      </PressableScale>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg.canvas },
  flex: { flex: 1, minWidth: 0 },
  header: {
    backgroundColor: color.bg.surface,
    paddingHorizontal: space.screen,
    paddingBottom: space.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  bell: { width: HIT, height: HIT, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: color.bg.surfaceSunken },
  logo: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  yo: { backgroundColor: color.bg.inverse, borderRadius: radius.sm, paddingHorizontal: 6 },
  searchRow: { paddingHorizontal: space.screen, paddingTop: space.md },
  search: {
    height: 48,
    borderRadius: radius.full,
    backgroundColor: color.bg.surfaceSunken,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingLeft: space.lg,
    paddingRight: space.xs,
  },
  filter: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: color.bg.inverse,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categories: { paddingHorizontal: space.screen, gap: space.lg },
  category: { alignItems: 'center', gap: space.sm, width: 64 },
  categoryIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: color.bg.surfaceSunken,
    alignItems: 'center',
    justifyContent: 'center',
  },
  promoWrap: { paddingHorizontal: space.screen },
  promo: { flexDirection: 'row', borderRadius: radius.lg, overflow: 'hidden', backgroundColor: color.bg.inverse, minHeight: 140 },
  promoText: { flex: 1, padding: space.lg, gap: space.sm, justifyContent: 'center' },
  overline: { letterSpacing: 0.6 },
  promoCta: {
    alignSelf: 'flex-start',
    height: 36,
    paddingHorizontal: space.lg,
    borderRadius: radius.md,
    backgroundColor: color.bg.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: space.xs,
  },
  promoImage: { width: 130 },
  sectionHead: { paddingHorizontal: space.screen, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  link: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  post: { backgroundColor: color.bg.surface, paddingTop: space.md, paddingBottom: space.md, gap: space.sm },
  postHead: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg },
  more: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  media: { backgroundColor: color.bg.surfaceSunken, overflow: 'hidden' },
  counter: {
    position: 'absolute',
    top: space.md,
    right: space.md,
    paddingHorizontal: space.sm,
    height: 24,
    borderRadius: radius.full,
    backgroundColor: 'rgba(10,10,11,0.72)',
    justifyContent: 'center',
  },
  playWrap: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  play: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(10,10,11,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 4,
  },
  actionsRow: { flexDirection: 'row', alignItems: 'center', gap: space.lg, paddingHorizontal: space.lg },
  action: { flexDirection: 'row', alignItems: 'center', gap: space.xs, minHeight: 36 },
  caption: { paddingHorizontal: space.lg },
  tagWrap: { paddingHorizontal: space.lg, paddingTop: space.xs },
  gridWrap: { padding: space.screen, gap: space.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  card: { backgroundColor: color.bg.surface, borderRadius: radius.lg, padding: space.sm, gap: space.sm },
});
