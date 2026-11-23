import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { Bookmark, Heart, Play } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { formatCount } from '@/domain/feed';
import { socialCount } from '@/domain/state';
import type { Post } from '@/domain/types';
import { useStore } from '@/store/AppStore';
import { pressScale } from '@/theme/motion';
import { color, radius, space } from '@/theme/tokens';
import { Chip, Segmented } from '@/ui/Form';
import { Content, Screen } from '@/ui/Layout';
import { PressableScale } from '@/ui/Pressable';
import { EmptyState } from '@/ui/Seller';
import { FolderSheet, findPost } from '@/ui/SocialSheets';
import { Text } from '@/ui/Text';
import { TopAppBar } from '@/ui/TopAppBar';

type Tab = 'saved' | 'reposted' | 'liked';

/** SC6 · Mes enregistrements: saved (with folders), reposted and liked posts. */
export default function SavedPosts() {
  const params = useLocalSearchParams<{ tab?: string }>();
  const { state } = useStore();
  const { width } = useWindowDimensions();
  const [tab, setTab] = useState<Tab>(params.tab === 'republies' ? 'reposted' : params.tab === 'aimes' ? 'liked' : 'saved');
  const [folder, setFolder] = useState<string | null>(null);
  const [sorting, setSorting] = useState<string | null>(null);
  const tile = Math.floor((width - space.screen * 2 - space.sm * 2) / 3);

  const lists = useMemo(() => {
    const resolve = (ids: string[]) =>
      [...ids]
        .reverse()
        .map((id) => findPost(state, id))
        .filter((p): p is Post => !!p);
    return { saved: resolve(state.social.saved), reposted: resolve(state.social.reposted), liked: resolve(state.social.liked) };
  }, [state]);
  const folders = Object.keys(state.social.folders);
  const shown = tab === 'saved' && folder ? lists.saved.filter((p) => state.social.folders[folder]?.includes(p.id)) : lists[tab];

  const open = (p: Post) =>
    p.kind === 'video'
      ? router.push({ pathname: '/fil', params: { post: p.id } })
      : p.productIds[0]
        ? router.push({ pathname: '/produit/[id]', params: { id: p.productIds[0] } })
        : router.push({ pathname: '/boutique/[id]', params: { id: p.shopId } });

  return (
    <Screen>
      <TopAppBar title="Enregistrés" />
      <Content gap={space.lg}>
        <Segmented
          value={tab}
          onChange={(t) => {
            setTab(t);
            setFolder(null);
          }}
          options={[
            { value: 'saved', label: `Enregistrés (${lists.saved.length})` },
            { value: 'reposted', label: `Republiés (${lists.reposted.length})` },
            { value: 'liked', label: 'Aimés' },
          ]}
        />
        {tab === 'saved' && folders.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            <Chip label="Tout" selected={folder === null} onPress={() => setFolder(null)} />
            {folders.map((f) => (
              <Chip key={f} label={f} selected={folder === f} onPress={() => setFolder(f)} />
            ))}
          </ScrollView>
        ) : null}

        {shown.length === 0 ? (
          <EmptyState
            icon={tab === 'liked' ? Heart : Bookmark}
            title={tab === 'saved' ? 'Rien d’enregistré' : tab === 'reposted' ? 'Rien de republié' : 'Aucune publication aimée'}
            body="Depuis le fil, touche « Enregistrer », « Republier » ou le cœur pour retrouver une publication ici."
          />
        ) : (
          <View style={styles.grid}>
            {shown.map((p) => (
              <PressableScale
                key={p.id}
                accessibilityRole="button"
                accessibilityLabel={`${p.kind === 'video' ? 'Vidéo' : 'Photo'} : ${p.caption}`}
                accessibilityHint={tab === 'saved' ? 'Appui long pour ranger dans un dossier' : undefined}
                onPress={() => open(p)}
                onLongPress={tab === 'saved' ? () => setSorting(p.id) : undefined}
                scaleTo={pressScale.card}
                style={[styles.tile, { width: tile, height: Math.round(tile * 1.3) }]}
              >
                <Image source={p.poster ?? p.media[0]} style={StyleSheet.absoluteFill} contentFit="cover" />
                {p.kind === 'video' ? (
                  <View style={styles.play}>
                    <Play size={16} color={color.icon.inverse} strokeWidth={2} />
                  </View>
                ) : null}
                <View style={styles.likes}>
                  <Heart size={14} color={color.icon.inverse} strokeWidth={2} />
                  <Text variant="caption" color={color.text.inverse}>
                    {formatCount(socialCount(p.likes, state.social.liked.includes(p.id)))}
                  </Text>
                </View>
              </PressableScale>
            ))}
          </View>
        )}
        {tab === 'saved' && shown.length ? (
          <Text variant="bodyS" color={color.text.secondary}>
            Appui long sur une publication pour la ranger dans un dossier.
          </Text>
        ) : null}
      </Content>
      <FolderSheet postId={sorting} onClose={() => setSorting(null)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { gap: space.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  tile: { borderRadius: radius.md, overflow: 'hidden', backgroundColor: color.bg.surfaceSunken },
  play: { position: 'absolute', top: space.sm, left: space.sm },
  likes: {
    position: 'absolute',
    left: space.sm,
    bottom: space.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
});
