import { useEvent } from 'expo';
import { Image } from 'expo-image';
import { router, useIsFocused, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useVideoPlayer, VideoView, type VideoPlayer } from 'expo-video';
import { ArrowLeft, Bookmark, Heart, MessageCircle, Pause, Repeat2, Search, Share2, Volume2 } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppState as RNAppState, FlatList, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getShop } from '@/domain/catalog';
import { followingFeed, formatCount, videoPosts } from '@/domain/feed';
import { socialCount, type SocialToggle } from '@/domain/state';
import type { Post } from '@/domain/types';
import { useStore } from '@/store/AppStore';
import { duration, pressScale, spring } from '@/theme/motion';
import { color, radius, space } from '@/theme/tokens';
import { Button } from '@/ui/Button';
import { useToast } from '@/ui/Feedback';
import { haptic, PressableScale } from '@/ui/Pressable';
import { QuickBuySheet } from '@/ui/QuickBuySheet';
import { FollowBadge, FollowButton, ProductTag, sharePost, ShopAvatar } from '@/ui/Social';
import { Text } from '@/ui/Text';

type FeedTab = 'following' | 'foryou';

/** SC1 · Fil vidéo « Pour toi » (+ SC2 · Achat rapide depuis une vidéo). */
export default function VideoFeed() {
  const params = useLocalSearchParams<{ post?: string; tab?: string }>();
  const insets = useSafeAreaInsets();
  const { state } = useStore();
  const focused = useIsFocused();
  const [tab, setTab] = useState<FeedTab>(params.tab === 'abonnements' ? 'following' : 'foryou');
  const [height, setHeight] = useState(0);
  const [active, setActive] = useState(0);
  const [sheetProduct, setSheetProduct] = useState<string | null>(null);
  const [appActive, setAppActive] = useState(true);

  useEffect(() => {
    const sub = RNAppState.addEventListener('change', (s) => setAppActive(s === 'active'));
    return () => sub.remove();
  }, []);

  const data = useMemo(
    () => (tab === 'foryou' ? videoPosts : followingFeed(videoPosts, state.social.following)),
    [tab, state.social.following],
  );
  const initialIndex = Math.max(0, data.findIndex((p) => p.id === params.post));

  // Manual pause applies to the current clip only: scrolling away resets it.
  const [pausedId, setPausedId] = useState<string | null>(null);
  const onViewable = useCallback(({ viewableItems }: { viewableItems: { index?: number | null; isViewable: boolean }[] }) => {
    const first = viewableItems.find((v) => v.isViewable);
    if (first?.index != null) {
      setActive(first.index);
      setPausedId(null);
    }
  }, []);

  const switchTab = (next: FeedTab) => {
    if (next === tab) return;
    haptic('selection');
    setActive(0);
    setTab(next);
  };

  return (
    <View style={styles.root} onLayout={(e) => setHeight(e.nativeEvent.layout.height)}>
      <StatusBar style="light" />
      {height > 0 && data.length > 0 ? (
        <FlatList
          key={tab}
          data={data}
          keyExtractor={(p) => p.id}
          pagingEnabled
          snapToInterval={height}
          decelerationRate="fast"
          showsVerticalScrollIndicator={false}
          initialScrollIndex={tab === 'foryou' ? initialIndex : 0}
          getItemLayout={(_, index) => ({ length: height, offset: height * index, index })}
          onViewableItemsChanged={onViewable}
          viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
          // Only the visible clip and its neighbours keep a player alive.
          windowSize={3}
          initialNumToRender={1}
          maxToRenderPerBatch={1}
          removeClippedSubviews
          renderItem={({ item, index }) => (
            <VideoPage
              post={item}
              height={height}
              playing={focused && appActive && index === active}
              preload={Math.abs(index - active) <= 1}
              paused={pausedId === item.id}
              onTogglePause={() => setPausedId((id) => (id === item.id ? null : item.id))}
              onBuy={(productId) => setSheetProduct(productId)}
            />
          )}
        />
      ) : null}
      {height > 0 && data.length === 0 ? <EmptyFollowing onDiscover={() => switchTab('foryou')} /> : null}

      <View style={[styles.top, { paddingTop: insets.top + space.xs }]} pointerEvents="box-none">
        <PressableScale
          accessibilityLabel="Retour"
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          scaleTo={pressScale.icon}
          haptic="selection"
          style={styles.topIcon}
        >
          <ArrowLeft size={24} color={color.icon.inverse} strokeWidth={2} />
        </PressableScale>
        <View style={styles.tabs} accessibilityRole="tablist">
          <TopTab label="Abonnements" active={tab === 'following'} onPress={() => switchTab('following')} />
          <TopTab label="Pour toi" active={tab === 'foryou'} onPress={() => switchTab('foryou')} />
        </View>
        <PressableScale
          accessibilityLabel="Rechercher"
          onPress={() => router.push('/explorer')}
          scaleTo={pressScale.icon}
          haptic="selection"
          style={styles.topIcon}
        >
          <Search size={24} color={color.icon.inverse} strokeWidth={2} />
        </PressableScale>
      </View>

      <QuickBuySheet productId={sheetProduct} onClose={() => setSheetProduct(null)} />
    </View>
  );
}

function TopTab({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <PressableScale accessibilityRole="tab" accessibilityState={{ selected: active }} onPress={onPress} scaleTo={pressScale.icon} hitSlop={8}>
      <Text variant={active ? 'h4' : 'labelL'} color={active ? color.text.inverse : 'rgba(255,255,255,0.6)'} style={styles.shadow}>
        {label}
      </Text>
    </PressableScale>
  );
}

function EmptyFollowing({ onDiscover }: { onDiscover: () => void }) {
  return (
    <Animated.View entering={FadeIn.duration(duration.base)} style={styles.empty}>
      <Heart size={40} color={color.icon.inverse} strokeWidth={1.5} />
      <Text variant="h3" color={color.text.inverse} align="center">
        Aucune vidéo de tes abonnements
      </Text>
      <Text variant="bodyM" color="rgba(255,255,255,0.7)" align="center">
        Suis des boutiques depuis « Pour toi » pour retrouver leurs vidéos ici.
      </Text>
      <Button label="Découvrir des vidéos" variant="accent" onPress={onDiscover} />
    </Animated.View>
  );
}

/* ---------- One full-screen clip ---------- */

function VideoPage({
  post,
  height,
  playing,
  preload,
  paused,
  onTogglePause,
  onBuy,
}: {
  post: Post;
  height: number;
  playing: boolean;
  preload: boolean;
  paused: boolean;
  onTogglePause: () => void;
  onBuy: (productId: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const { state, dispatch } = useStore();
  const toast = useToast();
  const reduced = useReducedMotion();
  const shop = getShop(post.shopId);
  const featured = post.productIds[0];

  const player = useVideoPlayer(preload && post.video != null ? post.video : null, (p) => {
    p.loop = true;
    p.muted = true;
    p.timeUpdateEventInterval = 0.25;
  });

  useEffect(() => {
    if (playing && !paused) player.play();
    else player.pause();
  }, [player, playing, paused]);

  const is = (list: SocialToggle, id: string) => state.social[list].includes(id);
  const toggle = (list: SocialToggle) => dispatch({ type: 'social/toggle', list, id: post.id });

  // Double tap = like (never unlike), single tap = pause / play.
  const burst = useSharedValue(0);
  const burstStyle = useAnimatedStyle(() => ({
    opacity: burst.value,
    transform: [{ scale: 0.6 + burst.value * 0.6 }],
  }));
  const like = useCallback(() => {
    if (!state.social.liked.includes(post.id)) dispatch({ type: 'social/toggle', list: 'liked', id: post.id });
    haptic('light');
    if (!reduced) burst.set(withSequence(withSpring(1, spring.select), withTiming(0, { duration: duration.slow })));
  }, [state.social.liked, post.id, dispatch, reduced, burst]);
  const single = Gesture.Tap()
    .runOnJS(true)
    .onEnd(onTogglePause);
  const double = Gesture.Tap().numberOfTaps(2).runOnJS(true).onEnd(like);
  const taps = Gesture.Exclusive(double, single);

  return (
    <View style={{ height, backgroundColor: '#000' }}>
      <GestureDetector gesture={taps}>
        <View style={StyleSheet.absoluteFill} accessible accessibilityLabel={`Vidéo de ${shop.name}. ${post.caption}`} accessibilityHint="Touche pour mettre en pause, touche deux fois pour aimer">
          <Image source={post.poster ?? post.media[0]} style={StyleSheet.absoluteFill} contentFit="cover" />
          {preload ? (
            <VideoView player={player} style={styles.video} contentFit="cover" nativeControls={false} pointerEvents="none" />
          ) : null}
          <View style={styles.scrim} pointerEvents="none" />
          {paused ? (
            <View style={styles.center} pointerEvents="none">
              <View style={styles.pauseBadge}>
                <Pause size={32} color={color.icon.inverse} fill={color.icon.inverse} strokeWidth={0} />
              </View>
            </View>
          ) : null}
          <Animated.View style={[styles.center, burstStyle]} pointerEvents="none">
            <Heart size={110} color={color.icon.inverse} fill={color.bg.accent} strokeWidth={1} />
          </Animated.View>
        </View>
      </GestureDetector>

      {/* Right rail */}
      <View style={[styles.rail, { bottom: insets.bottom + 168 }]}>
        <PressableScale
          accessibilityLabel={`Boutique ${shop.name}`}
          onPress={() => toast('La page boutique arrive bientôt (B5).')}
          scaleTo={pressScale.icon}
          style={{ marginBottom: space.sm }}
        >
          <ShopAvatar shop={shop} size={48} ring />
          <FollowBadge shopId={shop.id} />
        </PressableScale>
        <RailButton
          icon={Heart}
          label="J’aime"
          count={socialCount(post.likes, is('liked', post.id))}
          active={is('liked', post.id)}
          activeColor={color.bg.accent}
          onPress={() => toggle('liked')}
        />
        <RailButton icon={MessageCircle} label="Commentaires" count={post.comments} onPress={() => toast('Les commentaires arrivent bientôt (SC4).')} />
        <RailButton
          icon={Bookmark}
          label="Enregistrer"
          count={socialCount(post.saves, is('saved', post.id))}
          active={is('saved', post.id)}
          activeColor={color.icon.warning}
          onPress={() => {
            toggle('saved');
            if (!is('saved', post.id)) toast('Enregistré', 'success');
          }}
        />
        <RailButton
          icon={Repeat2}
          label="Republier"
          count={socialCount(post.reposts, is('reposted', post.id))}
          active={is('reposted', post.id)}
          activeColor={color.icon.success}
          onPress={() => toggle('reposted')}
        />
        <RailButton icon={Share2} label="Partager" text="Partager" onPress={() => sharePost(post)} />
      </View>

      {/* Caption, product and actions */}
      <View style={[styles.bottom, { paddingBottom: insets.bottom + space.lg }]} pointerEvents="box-none">
        <View style={styles.authorRow}>
          <Text variant="labelL" color={color.text.inverse} style={styles.shadow}>
            @{shop.handle ?? shop.id}
          </Text>
          <FollowButton shopId={shop.id} tone="chip" />
        </View>
        <Text variant="bodyM" color={color.text.inverse} numberOfLines={2} style={[styles.caption, styles.shadow]}>
          {post.caption}
        </Text>
        <View style={styles.sound}>
          <Volume2 size={14} color={color.icon.inverse} strokeWidth={2} />
          <Text variant="caption" color={color.text.inverse} numberOfLines={1}>
            Son original · {shop.name}
          </Text>
        </View>
        {featured ? <ProductTag productId={featured} onAdd={() => onBuy(featured)} /> : null}
        {featured ? (
          <View style={styles.actions}>
            <Button
              label="Voir le produit"
              variant="ghost"
              style={[styles.flex, styles.lightBtn]}
              onPress={() => router.push({ pathname: '/produit/[id]', params: { id: featured } })}
            />
            <Button label="Commander" variant="accent" haptic="medium" style={styles.flex} onPress={() => onBuy(featured)} />
          </View>
        ) : null}
      </View>
      <Progress player={player} active={playing} />
    </View>
  );
}

function RailButton({
  icon: Icon,
  label,
  count,
  text,
  active = false,
  activeColor,
  onPress,
}: {
  icon: typeof Heart;
  label: string;
  count?: number;
  text?: string;
  active?: boolean;
  activeColor?: string;
  onPress: () => void;
}) {
  const reduced = useReducedMotion();
  const pop = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={count != null ? `${label}, ${formatCount(count)}` : label}
      accessibilityState={{ selected: active }}
      onPress={() => {
        if (!reduced) pop.set(withSequence(withTiming(1.2, { duration: duration.fast }), withSpring(1, spring.select)));
        onPress();
      }}
      haptic="light"
      scaleTo={pressScale.icon}
      style={styles.railItem}
    >
      <Animated.View style={[styles.railIcon, style]}>
        <Icon
          size={24}
          color={active && activeColor ? activeColor : color.icon.inverse}
          fill={active && activeColor ? activeColor : 'transparent'}
          strokeWidth={2}
        />
      </Animated.View>
      <Text variant="caption" color={color.text.inverse} style={styles.shadow}>
        {text ?? formatCount(count ?? 0)}
      </Text>
    </PressableScale>
  );
}

function Progress({ player, active }: { player: VideoPlayer; active: boolean }) {
  const { currentTime } = useEvent(player, 'timeUpdate', {
    currentTime: 0,
    currentLiveTimestamp: null,
    currentOffsetFromLive: null,
    bufferedPosition: 0,
  });
  const length = player.duration;
  const ratio = active && length > 0 ? Math.min(1, currentTime / length) : 0;
  return (
    <View style={styles.progressTrack} pointerEvents="none">
      <View style={[styles.progressFill, { width: `${ratio * 100}%` }]} />
    </View>
  );
}

const shadow = { textShadowColor: 'rgba(0,0,0,0.35)', textShadowRadius: 6, textShadowOffset: { width: 0, height: 1 } };

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  flex: { flex: 1 },
  shadow,
  top: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.md,
  },
  topIcon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  tabs: { flexDirection: 'row', alignItems: 'center', gap: space.xl },
  // Explicit size: on web a <video> does not stretch to left/right/top/bottom insets.
  video: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' },
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.12)' },
  center: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  pauseBadge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rail: { position: 'absolute', right: space.md, alignItems: 'center', gap: space.md },
  railItem: { alignItems: 'center', gap: 2 },
  railIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(10,10,11,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: space.lg, gap: space.sm },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  caption: { marginRight: 72 },
  sound: { flexDirection: 'row', alignItems: 'center', gap: space.xs, marginBottom: space.xs },
  actions: { flexDirection: 'row', gap: space.md, marginTop: space.xs },
  lightBtn: { backgroundColor: color.bg.surfaceSunken },
  progressTrack: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 3, backgroundColor: 'rgba(255,255,255,0.25)' },
  progressFill: { height: 3, backgroundColor: color.bg.accent, borderRadius: radius.full },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md, paddingHorizontal: space.screen },
});
