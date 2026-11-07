import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Package, Pencil, Plus, Tag } from 'lucide-react-native';
import { useState } from 'react';
import { FlatList, ScrollView, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { formatFC, formatUSD } from '@/domain/money';
import { filterProducts, LOW_STOCK, productFilter, type ProductFilter, type SellerProduct } from '@/domain/seller';
import { useSeller } from '@/store/useSeller';
import { pressScale } from '@/theme/motion';
import { color, elevation, radius, space } from '@/theme/tokens';
import { StarsS } from '@/ui/Catalog';
import { useEnter } from '@/ui/Feedback';
import { Chip } from '@/ui/Form';
import { PressableScale } from '@/ui/Pressable';
import { SearchField } from '@/ui/Search';
import { EmptyState } from '@/ui/Seller';
import { Badge } from '@/ui/Status';
import { Text } from '@/ui/Text';
import { LargeTitleBar } from '@/ui/TopAppBar';

const FILTERS: { value: ProductFilter; label: string }[] = [
  { value: 'all', label: 'Tous' },
  { value: 'online', label: 'En ligne' },
  { value: 'out', label: 'Rupture' },
  { value: 'draft', label: 'Brouillons' },
  { value: 'offline', label: 'Hors ligne' },
];

function StockBadge({ p }: { p: SellerProduct }) {
  const f = productFilter(p);
  if (f === 'draft') return <Badge label="Brouillon" tone="neutral" />;
  if (f === 'offline') return <Badge label="Hors ligne" tone="neutral" />;
  if (f === 'out') return <Badge label="Rupture" tone="danger" />;
  return <Badge label={`${p.stock} en stock`} tone={p.stock <= LOW_STOCK ? 'warning' : 'success'} />;
}

function ProductRow({ p, index }: { p: SellerProduct; index: number }) {
  const entering = useEnter(index);
  const open = () => router.push({ pathname: '/vendeur/produit/[id]', params: { id: p.id } });
  return (
    <Animated.View entering={entering}>
      <PressableScale accessibilityRole="link" accessibilityLabel={`${p.name}, ${formatFC(p.price)}`} onPress={open} scaleTo={pressScale.card} style={styles.card}>
        <View style={styles.row}>
          <View style={styles.thumb}>
            {p.photos[0] ? <Image source={p.photos[0]} style={StyleSheet.absoluteFill} contentFit="cover" /> : <Package size={28} color={color.icon.secondary} strokeWidth={1.5} />}
          </View>
          <View style={styles.flex}>
            <Text variant="caption" color={color.text.secondary}>
              {p.category.split(' › ')[0]}
            </Text>
            <Text variant="labelM" numberOfLines={2}>
              {p.name}
            </Text>
            {p.rating ? <StarsS value={p.rating} /> : null}
            <Text variant="priceS">{formatFC(p.price)}</Text>
            <Text variant="caption" color={color.text.tertiary}>
              {formatUSD(p.price)}
            </Text>
          </View>
        </View>
        <View style={styles.between}>
          <StockBadge p={p} />
          <View style={styles.inline}>
            <Pencil size={14} color={color.icon.primary} strokeWidth={2} />
            <Text variant="labelS">Modifier</Text>
          </View>
        </View>
      </PressableScale>
    </Animated.View>
  );
}

/** V8 · Mes produits. */
export default function SellerProducts() {
  const { shop } = useSeller();
  const [filter, setFilter] = useState<ProductFilter>('all');
  const [query, setQuery] = useState('');
  const all = shop?.products ?? [];
  const list = filterProducts(all, filter, query);
  const count = (f: ProductFilter) => filterProducts(all, f, '').length;
  const out = count('out');

  return (
    <View style={styles.screen}>
      <LargeTitleBar title="Mes produits" subtitle={`${all.length} produit${all.length > 1 ? 's' : ''}${out ? ` · ${out} en rupture` : ''}`} />
      <FlatList
        data={list}
        keyExtractor={(p) => p.id}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View style={{ gap: space.md }}>
            <View style={{ flexDirection: 'row' }}>
              <SearchField value={query} onChangeText={setQuery} placeholder="Rechercher dans mon catalogue" accessibilityLabel="Rechercher dans mon catalogue" />
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              {FILTERS.map((f) => (
                <Chip key={f.value} label={`${f.label} (${count(f.value)})`} selected={filter === f.value} onPress={() => setFilter(f.value)} />
              ))}
            </ScrollView>
          </View>
        }
        ListEmptyComponent={
          all.length === 0 ? (
            <EmptyState icon={Tag} title="Ton catalogue est vide" body="Ajoute ton premier produit : photos, prix et stock. Il est publié dès que ta boutique est vérifiée." />
          ) : (
            <EmptyState icon={Package} title="Aucun produit" body="Aucun produit ne correspond à ce filtre." />
          )
        }
        renderItem={({ item, index }) => <ProductRow p={item} index={index} />}
      />
      {shop ? (
        <PressableScale accessibilityRole="button" accessibilityLabel="Ajouter un produit" onPress={() => router.push('/vendeur/produit/nouveau')} haptic="medium" style={styles.fab}>
          <Plus size={20} color={color.icon.inverse} strokeWidth={2.5} />
          <Text variant="labelM" color={color.text.inverse}>
            Ajouter un produit
          </Text>
        </PressableScale>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg.canvas },
  flex: { flex: 1, minWidth: 0, gap: 2 },
  list: { paddingHorizontal: space.screen, paddingTop: space.sm, paddingBottom: 96, gap: space.md },
  chips: { gap: space.sm, paddingRight: space.screen },
  card: { backgroundColor: color.bg.surface, borderRadius: radius.lg, padding: space.lg, gap: space.md },
  row: { flexDirection: 'row', gap: space.md },
  thumb: { width: 76, height: 76, borderRadius: radius.md, overflow: 'hidden', backgroundColor: color.bg.surfaceSunken, alignItems: 'center', justifyContent: 'center' },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  inline: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  fab: {
    position: 'absolute',
    right: space.screen,
    bottom: space.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: color.bg.inverse,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    height: 48,
    ...elevation[2],
  },
});
