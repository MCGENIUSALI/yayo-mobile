import { router, useLocalSearchParams } from 'expo-router';
import { Check, Plus, Share2, ShieldCheck, Store, Truck } from 'lucide-react-native';
import { Image } from 'expo-image';
import { useMemo, useState } from 'react';
import { ScrollView, Share, StyleSheet, View, useWindowDimensions } from 'react-native';
import { products, shops } from '@/domain/catalog';
import { statusAt } from '@/domain/content';
import { filterShopTab, shopProducts, shopRating, shopTabs } from '@/domain/search';
import type { Shop } from '@/domain/types';
import { useStore } from '@/store/AppStore';
import { pressScale } from '@/theme/motion';
import { color, radius, space } from '@/theme/tokens';
import { Button } from '@/ui/Button';
import { ProductGrid, StarsS } from '@/ui/Catalog';
import { HeroIcon } from '@/ui/Feedback';
import { Screen } from '@/ui/Layout';
import { PressableScale } from '@/ui/Pressable';
import { useFollow, ShopAvatar } from '@/ui/Social';
import { Badge } from '@/ui/Status';
import { Text } from '@/ui/Text';
import { TopAppBar } from '@/ui/TopAppBar';

/** B5 · Boutique vendeur: identity, trust signals, follow, catalogue by family. */
export default function ShopScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const shop = id ? shops[id] : undefined;
  if (!shop) return <MissingShop />;
  return <ShopPage key={shop.id} shop={shop} />;
}

function ShopPage({ shop }: { shop: Shop }) {
  const { width } = useWindowDimensions();
  const items = shopProducts(shop.id);
  const { state } = useStore();
  // Published collections of the shop (SV12), limited to products the buyer app can open.
  const collections = useMemo(
    () =>
      Object.values(state.content.collections)
        .filter((c) => c.shopId === shop.id && c.status === 'published')
        .sort((a, b) => a.position - b.position)
        .map((c) => ({ ...c, productIds: c.productIds.filter((pid) => !!products[pid]) }))
        .filter((c) => c.productIds.length > 0),
    [state.content.collections, shop.id],
  );
  const story = Object.values(state.content.items).find((i) => i.shopId === shop.id && i.kind === 'story' && statusAt(i, new Date().toISOString()) === 'published');
  const tabs = [...shopTabs(items), ...collections.map((c) => ({ id: `col:${c.id}`, label: c.name, count: c.productIds.length }))];
  const [tab, setTab] = useState('all');
  const { following, toggle } = useFollow(shop.id);
  const rating = shopRating(shop);
  const collection = tab.startsWith('col:') ? collections.find((c) => `col:${c.id}` === tab) : undefined;
  const visible = collection ? items.filter((p) => collection.productIds.includes(p.id)) : filterShopTab(items, tab);

  return (
    <Screen>
      <TopAppBar
        title={shop.name}
        action={{
          icon: Share2,
          label: 'Partager la boutique',
          onPress: () => Share.share({ message: `${shop.name} sur YA YO · ${shop.tagline ?? shop.category ?? 'Boutique'} à ${shop.area}` }).catch(() => undefined),
        }}
        background={color.bg.canvas}
      />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <View style={styles.identity}>
            <ShopAvatar shop={shop} size={64} />
            <View style={styles.flex}>
              <Text variant="h3" numberOfLines={1} accessibilityRole="header">
                {shop.name}
              </Text>
              {rating.reviews ? (
                <View style={styles.ratingRow}>
                  <StarsS value={rating.value} />
                  <Text variant="bodyS" color={color.text.tertiary}>
                    ({rating.reviews} avis)
                  </Text>
                </View>
              ) : null}
              <Text variant="bodyS" color={color.text.secondary} numberOfLines={1}>
                {shop.tagline ?? shop.category ?? 'Boutique'} · {shop.area}
              </Text>
            </View>
          </View>
          <View style={styles.badges}>
            {shop.verified ? <Badge label="Vendeur vérifié" icon={ShieldCheck} tone="success" /> : <Badge label="Vérification en cours" icon={ShieldCheck} tone="neutral" />}
            <Badge label={`Livraison ${shop.deliveryLead}`} icon={Truck} tone="neutral" />
          </View>
          <Button
            label={following ? 'Abonné à la boutique' : 'Suivre la boutique'}
            leadingIcon={following ? Check : Plus}
            variant={following ? 'outline' : 'primary'}
            size="M"
            fill
            haptic={following ? 'selection' : 'success'}
            onPress={toggle}
            accessibilityHint={following ? `Ne plus suivre ${shop.name}` : 'Ses vidéos apparaîtront dans l’onglet Abonnements'}
          />
        </View>

        {story ? (
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={`Story de ${shop.name}${story.caption ? ` : ${story.caption}` : ''}`}
            onPress={() => (story.productIds[0] && products[story.productIds[0]] ? router.push({ pathname: '/produit/[id]', params: { id: story.productIds[0] } }) : undefined)}
            scaleTo={pressScale.card}
            style={styles.story}
          >
            <View style={styles.storyRing}>{story.media[0] ? <Image source={story.media[0]} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}</View>
            <View style={styles.flex}>
              <Text variant="labelL">Story · 24 h</Text>
              <Text variant="bodyS" color={color.text.secondary} numberOfLines={2}>
                {story.caption || 'Nouveauté de la boutique'}
              </Text>
            </View>
          </PressableScale>
        ) : null}

        <Text variant="bodyS" color={color.text.secondary} style={styles.note}>
          Une question ? Passe par le support YA YO : pas d’échange direct avec le vendeur.
        </Text>

        {items.length ? (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} style={styles.chipsBar} accessibilityRole="tablist">
              {tabs.map((t) => {
                const selected = t.id === tab;
                return (
                  <PressableScale
                    key={t.id}
                    accessibilityRole="tab"
                    accessibilityState={{ selected }}
                    accessibilityLabel={`${t.label}, ${t.count}`}
                    onPress={() => setTab(t.id)}
                    haptic="selection"
                    scaleTo={pressScale.icon}
                    style={[styles.chip, selected ? styles.chipOn : styles.chipOff]}
                  >
                    <Text variant="labelM" color={selected ? color.text.inverse : color.text.primary}>
                      {t.id === 'all' ? `${t.label} (${t.count})` : t.label}
                    </Text>
                  </PressableScale>
                );
              })}
            </ScrollView>
            <View style={styles.gridWrap}>
              <ProductGrid key={tab} items={visible} width={width} />
            </View>
          </>
        ) : (
          <View style={styles.emptyShop}>
            <Text variant="h4" align="center">
              Aucun produit pour le moment
            </Text>
            <Text variant="bodyM" color={color.text.secondary} align="center">
              Suis la boutique pour voir ses nouveautés dans ton fil.
            </Text>
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

function MissingShop() {
  return (
    <Screen>
      <TopAppBar title="Boutique" />
      <View style={styles.missing}>
        <HeroIcon icon={Store} bg={color.bg.surfaceSunken} fg={color.icon.secondary} animate={false} />
        <Text variant="h4" align="center">
          Boutique introuvable
        </Text>
        <Text variant="bodyM" color={color.text.secondary} align="center">
          Elle a peut-être fermé ou changé de nom.
        </Text>
        <Button label="Explorer les catégories" onPress={() => router.replace('/explorer')} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  story: { flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: color.bg.surface, borderRadius: radius.lg, padding: space.md, marginHorizontal: space.screen, marginTop: space.md },
  storyRing: { width: 56, height: 56, borderRadius: 28, overflow: 'hidden', borderWidth: 2, borderColor: color.bg.accent, backgroundColor: color.bg.surfaceSunken },
  flex: { flex: 1, minWidth: 0, gap: space.xs },
  content: { paddingBottom: space.screen },
  card: {
    marginHorizontal: space.screen,
    marginTop: space.xs,
    backgroundColor: color.bg.surface,
    borderRadius: radius.lg,
    padding: space.lg,
    gap: space.lg,
  },
  identity: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  note: { paddingHorizontal: space.screen, paddingTop: space.lg },
  chipsBar: { flexGrow: 0, marginTop: space.lg },
  chips: { paddingHorizontal: space.screen, gap: space.sm },
  chip: { height: 40, paddingHorizontal: space.md, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  chipOn: { backgroundColor: color.bg.brand },
  chipOff: { backgroundColor: color.bg.surface, borderWidth: 1, borderColor: color.border.default },
  gridWrap: { paddingHorizontal: space.screen, paddingTop: space.lg },
  emptyShop: { padding: space.screen, gap: space.sm },
  missing: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md, padding: space.screen },
});
