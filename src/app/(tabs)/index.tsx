import { Image } from 'expo-image';
import { router } from 'expo-router';
import {
  Bell,
  Bookmark,
  Flag,
  Heart,
  House,
  MessageCircle,
  MoreHorizontal,
  Play,
  Radio,
  Repeat2,
  Search,
  Share2,
  Shirt,
  ShoppingCart,
  SlidersHorizontal,
  Smartphone,
  Sparkles,
  Tag,
  type LucideIcon,
} from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { FlatList, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getShop, products } from '@/domain/catalog';
import { statusAt, type ContentItem } from '@/domain/content';
import { followingFeed, formatCount } from '@/domain/feed';
import { formatDayTime } from '@/domain/format';
import { formatFC, formatUSD } from '@/domain/money';
import { socialCount, type SocialToggle } from '@/domain/state';
import type { CategoryId } from '@/domain/search';
import type { Post, Product } from '@/domain/types';
import { useStore } from '@/store/AppStore';
import { duration, pressScale, spring } from '@/theme/motion';
import { color, HIT, radius, space } from '@/theme/tokens';
import { Button } from '@/ui/Button';
import { CartButton } from '@/ui/CartButton';
import { ProductImage } from '@/ui/Commerce';
import { useEnter } from '@/ui/Feedback';
import { Segmented } from '@/ui/Form';
import { haptic, PressableScale } from '@/ui/Pressable';
import { QuickBuySheet } from '@/ui/QuickBuySheet';
import { FollowButton, ShopAvatar } from '@/ui/Social';
import { CommentsSheet, ShareSheet, useFeed } from '@/ui/SocialSheets';
import { Badge } from '@/ui/Status';
import { Text } from '@/ui/Text';

const CATEGORIES: { label: string; icon: LucideIcon; id: CategoryId }[] = [
  { label: 'Mode', icon: Shirt, id: 'mode' },
  { label: 'Électro', icon: Smartphone, id: 'electronique' },
  { label: 'Beauté', icon: Sparkles, id: 'beaute' },
  { label: 'Maison', icon: House, id: 'maison' },
  { label: 'Promo', icon: Tag, id: 'promos' },
];

type HomeTab = 'foryou' | 'following' | 'lives';

/** B1 · Accueil + SC3: search, categories, promo, shop feed (Pour toi, Abonnements, Lives), then the catalogue grid. */
export default function Home() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { state, dispatch } = useStore();
  const feed = useFeed();
  const [tab, setTab] = useState<HomeTab>('foryou');
  const [sheetProduct, setSheetProduct] = useState<string | null>(null);
  const [commentsOn, setCommentsOn] = useState<Post | null>(null);
  const [shareOn, setShareOn] = useState<Post | null>(null);
  const data = useMemo(() => (tab === 'lives' ? [] : tab === 'following' ? followingFeed(feed, state.social.following) : feed), [tab, feed, state.social.following]);
  const lives = useMemo(() => liveList(state.content.items), [state.content.items]);
  const buy = (postId: string, productId: string) => {
    dispatch({ type: 'content/track', postId, metric: 'click', productId });
    setSheetProduct(productId);
  };
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
        data={data}
        keyExtractor={(p) => p.id}
        contentContainerStyle={{ paddingBottom: space.screen }}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={{ gap: space.lg, paddingBottom: space.md }}>
            <View style={styles.searchRow}>
              <PressableScale
                accessibilityRole="search"
                accessibilityLabel="Rechercher un produit, une boutique"
                onPress={() => router.navigate({ pathname: '/explorer', params: { focus: String(Date.now()) } })}
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
              {CATEGORIES.map(({ label, icon: Icon, id }) => (
                <PressableScale
                  key={label}
                  accessibilityRole="button"
                  accessibilityLabel={`Catégorie ${label}`}
                  onPress={() => router.navigate({ pathname: '/explorer', params: { cat: id, q: '' } })}
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
              <Segmented
                value={tab}
                onChange={setTab}
                options={[
                  { value: 'foryou', label: 'Pour toi' },
                  { value: 'following', label: 'Abonnements' },
                  { value: 'lives', label: 'Lives' },
                ]}
              />
            </View>
          </View>
        }
        ListEmptyComponent={tab === 'lives' ? <LivesList lives={lives} /> : <EmptyFeed following={tab === 'following'} onDiscover={() => setTab('foryou')} />}
        renderItem={({ item }) => (
          <FeedPost post={item} width={width} onBuy={(productId) => buy(item.id, productId)} onComments={() => setCommentsOn(item)} onShare={() => setShareOn(item)} />
        )}
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
      <CommentsSheet post={commentsOn} onClose={() => setCommentsOn(null)} resumeHref="/" />
      <ShareSheet post={shareOn} onClose={() => setShareOn(null)} />
    </View>
  );
}

/** Lives of the shops: on air first, then the scheduled ones by start time. */
function liveList(items: Record<string, ContentItem>): ContentItem[] {
  const now = new Date().toISOString();
  return Object.values(items)
    .filter((i) => i.kind === 'live' && i.live && i.live.state !== 'ended' && statusAt(i, now) !== 'draft' && i.status !== 'hidden' && i.status !== 'draft')
    .sort((a, b) => (a.live!.state === b.live!.state ? a.live!.startsAt.localeCompare(b.live!.startsAt) : a.live!.state === 'live' ? -1 : 1));
}

function EmptyFeed({ following, onDiscover }: { following: boolean; onDiscover: () => void }) {
  return (
    <View style={styles.empty}>
      <Text variant="h4" align="center">
        {following ? 'Aucune publication de tes abonnements' : 'Rien à afficher pour l’instant'}
      </Text>
      <Text variant="bodyM" color={color.text.secondary} align="center">
        {following ? 'Suis des boutiques depuis « Pour toi » pour retrouver leurs photos et vidéos ici.' : 'Les publications masquées n’apparaissent plus dans ton fil.'}
      </Text>
      {following ? <Button label="Découvrir des boutiques" variant="outline" onPress={onDiscover} /> : null}
    </View>
  );
}

function LivesList({ lives }: { lives: ContentItem[] }) {
  if (!lives.length) {
    return (
      <View style={styles.empty}>
        <Radio size={32} color={color.icon.secondary} strokeWidth={2} />
        <Text variant="h4" align="center">
          Aucun live programmé
        </Text>
        <Text variant="bodyM" color={color.text.secondary} align="center">
          Les boutiques annoncent leurs lives ici. Suis-les pour ne pas les manquer.
        </Text>
      </View>
    );
  }
  return (
    <View style={{ gap: space.md, paddingHorizontal: space.screen }}>
      {lives.map((l) => {
        const shop = getShop(l.shopId);
        const onAir = l.live!.state === 'live';
        return (
          <PressableScale
            key={l.id}
            accessibilityRole="link"
            accessibilityLabel={`${onAir ? 'En direct' : 'Live programmé'} : ${l.live!.title}, ${shop.name}`}
            onPress={() => router.push({ pathname: '/boutique/[id]', params: { id: shop.id } })}
            scaleTo={pressScale.card}
            style={styles.live}
          >
            <View style={styles.liveCover}>
              {l.media[0] ? <Image source={l.media[0]} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
              <View style={[styles.liveBadge, { backgroundColor: onAir ? color.text.danger : 'rgba(10,10,11,0.72)' }]}>
                <Text variant="caption" color={color.text.inverse}>
                  {onAir ? 'EN DIRECT' : 'PROGRAMMÉ'}
                </Text>
              </View>
            </View>
            <View style={styles.flex}>
              <Text variant="labelL" numberOfLines={2}>
                {l.live!.title}
              </Text>
              <Text variant="bodyS" color={color.text.secondary} numberOfLines={1}>
                {shop.name}
              </Text>
              <Text variant="bodyS" color={onAir ? color.text.danger : color.text.secondary}>
                {onAir ? `${formatCount(l.live!.viewers ?? 0)} spectateurs` : formatDayTime(l.live!.startsAt)}
              </Text>
            </View>
          </PressableScale>
        );
      })}
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

/* ---------- Feed Post (1002:400, SC3 1055:443) ---------- */

function FeedPost({
  post,
  width,
  onBuy,
  onComments,
  onShare,
}: {
  post: Post;
  width: number;
  onBuy: (productId: string) => void;
  onComments: () => void;
  onShare: () => void;
}) {
  const { state, dispatch } = useStore();
  const reduced = useReducedMotion();
  const shop = getShop(post.shopId);
  const item = state.content.items[post.id];
  const featured = post.productIds[0] ? products[post.productIds[0]] : undefined;
  const is = (list: SocialToggle) => state.social[list].includes(post.id);
  const toggle = (list: SocialToggle) => dispatch({ type: 'social/toggle', list, id: post.id });
  const mediaH = Math.round(width * (420 / 402));
  const [page, setPage] = useState(0);
  const pages = post.kind === 'video' ? post.media.slice(0, 1) : post.media;

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
        <PressableScale
          accessibilityRole="link"
          accessibilityLabel={`Boutique ${shop.name}, ${shop.category ?? 'Boutique'}, ${shop.area}`}
          onPress={() => router.push({ pathname: '/boutique/[id]', params: { id: shop.id } })}
          scaleTo={pressScale.card}
          style={styles.postShop}
        >
          <ShopAvatar shop={shop} size={40} />
          <View style={styles.flex}>
            <Text variant="labelL" numberOfLines={1}>
              {shop.name}
            </Text>
            <Text variant="bodyS" color={color.text.secondary} numberOfLines={1}>
              {shop.category ?? 'Boutique'} · {shop.area}
            </Text>
          </View>
        </PressableScale>
        <FollowButton shopId={shop.id} />
        <PressableScale accessibilityLabel="Plus d’options" onPress={onShare} scaleTo={pressScale.icon} style={styles.more}>
          <MoreHorizontal size={22} color={color.icon.primary} strokeWidth={2} />
        </PressableScale>
      </View>

      <GestureDetector gesture={taps}>
        <View
          style={[styles.media, { height: mediaH }]}
          accessible={post.kind === 'video'}
          accessibilityRole={post.kind === 'video' ? 'button' : undefined}
          accessibilityLabel={post.kind === 'video' ? `Vidéo de ${shop.name}` : undefined}
          accessibilityHint={post.kind === 'video' ? 'Ouvre le fil vidéo' : undefined}
        >
          <FlatList
            data={pages}
            horizontal
            pagingEnabled
            scrollEnabled={pages.length > 1}
            showsHorizontalScrollIndicator={false}
            keyExtractor={(_, i) => String(i)}
            onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}
            getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
            renderItem={({ item: m, index }) => (
              <Image
                source={m}
                style={{ width, height: mediaH }}
                contentFit="cover"
                transition={160}
                accessibilityLabel={post.kind === 'video' ? undefined : `Photo ${index + 1} sur ${pages.length} de ${shop.name}`}
              />
            )}
          />
          <View style={styles.counter} pointerEvents="none">
            <Text variant="labelS" color={color.text.inverse}>
              {post.kind === 'video' ? 'Vidéo' : `${page + 1}/${Math.max(pages.length, 1)}`}
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
        <PostAction icon={MessageCircle} label="Commentaires" count={post.comments} onPress={onComments} />
        <PostAction icon={Share2} label="Partager" onPress={onShare} />
        <PostAction
          icon={Repeat2}
          label="Republier"
          count={socialCount(post.reposts, is('reposted'))}
          active={is('reposted')}
          activeColor={color.icon.success}
          onPress={onShare}
        />
        <View style={styles.flex} />
        <PostAction
          icon={Bookmark}
          label="Enregistrer"
          active={is('saved')}
          activeColor={color.icon.primary}
          onPress={() => toggle('saved')}
        />
        <PostAction icon={Flag} label="Signaler" onPress={onShare} />
      </View>

      <Text variant="bodyM" numberOfLines={3} style={styles.caption}>
        {post.caption}
      </Text>

      {featured && item?.buyButton !== false ? (
        <View style={styles.buyRow}>
          <View style={styles.flex}>
            <Text variant="priceS">{formatFC(featured.price)}</Text>
            <Text variant="caption" color={color.text.tertiary}>
              {formatUSD(featured.price)}
            </Text>
          </View>
          <Button
            label="Voir le produit"
            variant="accent"
            onPress={() => {
              dispatch({ type: 'content/track', postId: post.id, metric: 'click', productId: featured.id });
              router.push({ pathname: '/produit/[id]', params: { id: featured.id } });
            }}
          />
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={featured.stock > 0 ? `Commander ${featured.shortName}` : `${featured.shortName}, en rupture`}
            disabled={featured.stock <= 0}
            onPress={() => onBuy(featured.id)}
            haptic="medium"
            scaleTo={pressScale.icon}
            style={[styles.cartBtn, featured.stock <= 0 && { opacity: 0.4 }]}
          >
            <ShoppingCart size={22} color={color.icon.inverse} strokeWidth={2} />
          </PressableScale>
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
  postShop: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: space.md },
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
  buyRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.lg, paddingTop: space.xs },
  cartBtn: { width: 48, height: 48, borderRadius: radius.md, backgroundColor: color.bg.inverse, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', gap: space.md, paddingHorizontal: space.screen, paddingVertical: 32 },
  live: { flexDirection: 'row', gap: space.md, backgroundColor: color.bg.surface, borderRadius: radius.lg, padding: space.sm, alignItems: 'center' },
  liveCover: { width: 96, height: 128, borderRadius: radius.md, overflow: 'hidden', backgroundColor: color.bg.surfaceSunken },
  liveBadge: { position: 'absolute', top: space.xs, left: space.xs, borderRadius: radius.full, paddingHorizontal: space.sm, paddingVertical: 2 },
  gridWrap: { padding: space.screen, gap: space.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  card: { backgroundColor: color.bg.surface, borderRadius: radius.lg, padding: space.sm, gap: space.sm },
});
