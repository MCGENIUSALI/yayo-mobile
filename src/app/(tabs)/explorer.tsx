import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, ChevronDown, ChevronRight, History, Search } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentRef } from 'react';
import { BackHandler, Keyboard, ScrollView, StyleSheet, TextInput, View, useWindowDimensions } from 'react-native';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { products, shops } from '@/domain/catalog';
import {
  categories,
  countLabel,
  getCategory,
  hasAnyFilter,
  inCategory,
  isCategoryId,
  nearbyProducts,
  noFilters,
  searchProducts,
  sheetFilterCount,
  shopsMatching,
  sortLabels,
  suggestions,
  type CategoryId,
  type SearchFilters,
  type SortKey,
} from '@/domain/search';
import { useStore } from '@/store/AppStore';
import { duration, pressScale } from '@/theme/motion';
import { color, HIT, radius, space } from '@/theme/tokens';
import { Button } from '@/ui/Button';
import { categoryIcon, GridSkeleton, ProductGrid } from '@/ui/Catalog';
import { useEnter } from '@/ui/Feedback';
import { PressableScale } from '@/ui/Pressable';
import { FilterSheet, SearchField, SortSheet } from '@/ui/Search';
import { ShopAvatar } from '@/ui/Social';
import { Text } from '@/ui/Text';

/** Perceived search time (E2 skeleton) so that a new result set never pops in without feedback. */
const SEARCH_LATENCY_MS = 350;
/** Universes shown on E3, as in Figma (Accessoires is a chip on B2/B3 only). */
const UNIVERSES = categories.filter((c) => c.id !== 'accessoires');

/**
 * Explorer tab: E3 · Catégories (idle), E4 · Recherche en cours (typing),
 * B2 · Résultats, B3 · Filtres (sheet), E2 · Chargement, E5 · Aucun résultat.
 *
 * The committed query and category live in the route params (`q`, `cat`) so
 * that B1 shortcuts and the hardware back button share one source of truth.
 */
export default function ExplorerScreen() {
  const params = useLocalSearchParams<{ q?: string; cat?: string; focus?: string }>();
  const q = (params.q ?? '').trim();
  const cat = isCategoryId(params.cat) ? params.cat : undefined;
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { state, dispatch } = useStore();
  const inputRef = useRef<ComponentRef<typeof TextInput>>(null);

  const [text, setText] = useState(q);
  const [editing, setEditing] = useState(!!params.focus);
  const [sheetFilters, setSheetFilters] = useState<SearchFilters>(noFilters);
  const [sort, setSort] = useState<SortKey>('relevance');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);

  // Follow param changes coming from other screens (B1 search pill, categories).
  const [seen, setSeen] = useState({ q, focus: params.focus });
  if (seen.q !== q || seen.focus !== params.focus) {
    setSeen({ q, focus: params.focus });
    setText(q);
    if (params.focus && params.focus !== seen.focus) setEditing(true);
  }

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const filters = useMemo<SearchFilters>(() => ({ ...sheetFilters, category: cat }), [sheetFilters, cat]);
  const mode: 'browse' | 'typing' | 'results' = editing ? 'typing' : q || cat || sheetFilterCount(filters) ? 'results' : 'browse';

  const commit = (raw: string) => {
    const query = raw.trim().replace(/\s+/g, ' ');
    Keyboard.dismiss();
    setEditing(false);
    setText(query);
    if (query) dispatch({ type: 'search/remember', query });
    router.setParams({ q: query || undefined });
  };

  const stopEditing = useCallback(() => {
    Keyboard.dismiss();
    setEditing(false);
    setText(q);
  }, [q]);

  const reset = useCallback(() => {
    Keyboard.dismiss();
    setEditing(false);
    setText('');
    setSheetFilters(noFilters);
    setSort('relevance');
    router.setParams({ q: undefined, cat: undefined, focus: undefined });
  }, []);

  const setCategory = (id: CategoryId | undefined) => router.setParams({ cat: id });

  // Android back: leave typing, then results, before leaving the tab.
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        if (mode === 'typing') {
          stopEditing();
          return true;
        }
        if (mode === 'results') {
          reset();
          return true;
        }
        return false;
      });
      return () => sub.remove();
    }, [mode, reset, stopEditing]),
  );

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + space.sm }]}>
        {mode === 'typing' ? (
          <PressableScale accessibilityLabel="Retour" onPress={stopEditing} scaleTo={pressScale.icon} haptic="selection" style={styles.back}>
            <ArrowLeft size={24} color={color.icon.primary} strokeWidth={2} />
          </PressableScale>
        ) : null}
        <SearchField
          ref={inputRef}
          value={text}
          onChangeText={(v) => {
            setText(v);
            if (!editing && !v && q) router.setParams({ q: undefined });
          }}
          onFocus={() => setEditing(true)}
          onSubmitEditing={(e) => commit(e.nativeEvent.text)}
          onFilter={() => {
            Keyboard.dismiss();
            setFiltersOpen(true);
          }}
          filterCount={sheetFilterCount(filters)}
        />
      </View>

      {mode === 'browse' ? (
        <Browse onPick={setCategory} />
      ) : mode === 'typing' ? (
        <Typing
          text={text}
          recent={state.search.recent}
          onPick={commit}
          onClearRecent={() => dispatch({ type: 'search/clearRecent' })}
        />
      ) : (
        <Results
          query={q}
          filters={filters}
          sort={sort}
          width={width}
          onCategory={setCategory}
          onSort={() => setSortOpen(true)}
          onClearFilters={() => {
            setSheetFilters(noFilters);
            router.setParams({ cat: undefined });
          }}
          onReset={reset}
        />
      )}

      <FilterSheet
        visible={filtersOpen}
        query={q}
        filters={filters}
        onClose={() => setFiltersOpen(false)}
        onApply={({ category, ...rest }) => {
          setSheetFilters({ ...rest });
          setEditing(false);
          router.setParams({ cat: category });
        }}
      />
      <SortSheet visible={sortOpen} value={sort} onClose={() => setSortOpen(false)} onChange={setSort} />
    </View>
  );
}

/* ---------- E3 · Catégories ---------- */

function Browse({ onPick }: { onPick: (id: CategoryId) => void }) {
  const all = Object.values(products);
  return (
    <ScrollView contentContainerStyle={styles.browse} showsVerticalScrollIndicator={false}>
      <View style={styles.titleBlock}>
        <Text variant="bodyM" color={color.text.secondary}>
          {UNIVERSES.length} univers
        </Text>
        <Text variant="h1" accessibilityRole="header">
          Catégories
        </Text>
      </View>
      <View style={styles.catGrid}>
        {UNIVERSES.map((c, i) => (
          <CategoryCard key={c.id} id={c.id} index={i} count={all.filter((p) => inCategory(p, c.id)).length} onPress={() => onPick(c.id)} />
        ))}
      </View>
    </ScrollView>
  );
}

function CategoryCard({ id, count, index, onPress }: { id: CategoryId; count: number; index: number; onPress: () => void }) {
  const c = getCategory(id);
  const Icon = categoryIcon[id];
  const entering = useEnter(index);
  return (
    <Animated.View entering={entering} style={styles.catCell}>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={`${c.label}, ${countLabel(c, count)}`}
        onPress={onPress}
        haptic="selection"
        scaleTo={pressScale.card}
        style={styles.catCard}
      >
        <View style={styles.catIcon}>
          <Icon size={24} color={color.icon.accent} strokeWidth={2} />
        </View>
        <View style={{ gap: space.xs }}>
          <Text variant="h4">{c.label}</Text>
          <Text variant="bodyS" color={color.text.secondary}>
            {countLabel(c, count)}
          </Text>
        </View>
      </PressableScale>
    </Animated.View>
  );
}

/* ---------- E4 · Recherche en cours ---------- */

function Typing({
  text,
  recent,
  onPick,
  onClearRecent,
}: {
  text: string;
  recent: string[];
  onPick: (q: string) => void;
  onClearRecent: () => void;
}) {
  const sugg = suggestions(text);
  const shown = text ? recent.slice(0, 3) : recent;
  return (
    <ScrollView contentContainerStyle={styles.typing} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
      {shown.length ? (
        <View style={styles.listGroup}>
          <View style={styles.overlineRow}>
            <Text variant="caption" color={color.text.secondary} style={styles.overline}>
              RECHERCHES RÉCENTES
            </Text>
            <PressableScale accessibilityRole="button" accessibilityLabel="Effacer les recherches récentes" onPress={onClearRecent} hitSlop={8} scaleTo={pressScale.icon}>
              <Text variant="labelS" color={color.text.accent}>
                Effacer
              </Text>
            </PressableScale>
          </View>
          {shown.map((r) => (
            <QueryRow key={`r-${r}`} icon="recent" label={r} onPress={() => onPick(r)} />
          ))}
        </View>
      ) : null}
      {text.trim() ? (
        <View style={styles.listGroup}>
          <Text variant="caption" color={color.text.secondary} style={styles.overline}>
            SUGGESTIONS
          </Text>
          {sugg.map((s) => (
            <QueryRow key={`s-${s}`} icon="search" label={s} onPress={() => onPick(s)} />
          ))}
          <QueryRow icon="search" label={`Rechercher «\u00a0${text.trim()}\u00a0»`} onPress={() => onPick(text)} />
        </View>
      ) : !shown.length ? (
        <Text variant="bodyM" color={color.text.secondary}>
          Tape le nom d’un produit, d’une marque ou d’une boutique.
        </Text>
      ) : null}
    </ScrollView>
  );
}

function QueryRow({ icon, label, onPress }: { icon: 'recent' | 'search'; label: string; onPress: () => void }) {
  const Icon = icon === 'recent' ? History : Search;
  return (
    <PressableScale accessibilityRole="button" accessibilityLabel={label} onPress={onPress} haptic="selection" scaleTo={pressScale.card} style={styles.queryRow}>
      <View style={styles.queryIcon}>
        <Icon size={20} color={color.icon.primary} strokeWidth={2} />
      </View>
      <Text variant="labelL" numberOfLines={1} style={styles.flex}>
        {label}
      </Text>
    </PressableScale>
  );
}

/* ---------- B2 · Résultats, E2 · Chargement, E5 · Aucun résultat ---------- */

function Results({
  query,
  filters,
  sort,
  width,
  onCategory,
  onSort,
  onClearFilters,
  onReset,
}: {
  query: string;
  filters: SearchFilters;
  sort: SortKey;
  width: number;
  onCategory: (id: CategoryId | undefined) => void;
  onSort: () => void;
  onClearFilters: () => void;
  onReset: () => void;
}) {
  const reduced = useReducedMotion();
  const items = useMemo(() => searchProducts(query, filters, sort), [query, filters, sort]);
  const matchingShops = useMemo(() => shopsMatching(query, Object.values(shops)), [query]);

  // E2: every new search shows the skeleton briefly, then the results.
  const key = JSON.stringify([query, filters, sort]);
  const [shownKey, setShownKey] = useState<string | null>(null);
  useEffect(() => {
    const t = setTimeout(() => setShownKey(key), SEARCH_LATENCY_MS);
    return () => clearTimeout(t);
  }, [key]);
  const loading = shownKey !== key;

  if (!loading && items.length === 0) {
    const filtered = hasAnyFilter(filters);
    return (
      <ScrollView contentContainerStyle={styles.empty} showsVerticalScrollIndicator={false}>
        <Animated.View entering={reduced ? undefined : FadeIn.duration(duration.base)} style={styles.emptyHead}>
          <View style={styles.emptyIcon}>
            <Search size={32} color={color.icon.secondary} strokeWidth={2} />
          </View>
          <Text variant="h4" align="center" accessibilityRole="header" accessibilityLiveRegion="polite">
            {query ? `Aucun résultat pour «\u00a0${query}\u00a0»` : 'Aucun produit avec ces filtres'}
          </Text>
          <Text variant="bodyM" color={color.text.secondary} align="center">
            {filtered ? 'Vérifie l’orthographe ou retire des filtres. Voici des produits proches.' : 'Vérifie l’orthographe ou essaie un autre mot. Voici des produits proches.'}
          </Text>
          {filtered ? (
            <Button label="Retirer les filtres" size="M" onPress={onClearFilters} />
          ) : (
            <Button label="Voir les catégories" size="M" onPress={onReset} />
          )}
        </Animated.View>
        <View style={{ gap: space.md }}>
          <Text variant="h4" accessibilityRole="header">
            Produits proches
          </Text>
          <ProductGrid items={nearbyProducts(filters)} width={width} />
        </View>
      </ScrollView>
    );
  }

  const n = items.length;
  const summary = query
    ? `${n} résultat${n > 1 ? 's' : ''} à Kinshasa`
    : filters.category
      ? countLabel(getCategory(filters.category), n)
      : `${n} produit${n > 1 ? 's' : ''}`;

  return (
    <ScrollView contentContainerStyle={styles.results} showsVerticalScrollIndicator={false} keyboardDismissMode="on-drag">
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} style={styles.chipsBar} accessibilityRole="tablist">
        <CategoryChip label="Tout" selected={!filters.category} onPress={() => onCategory(undefined)} />
        {categories.map((c) => (
          <CategoryChip key={c.id} label={c.label} selected={filters.category === c.id} onPress={() => onCategory(c.id)} />
        ))}
      </ScrollView>

      <View style={styles.inner}>
        {matchingShops.length && !loading ? (
          <View style={{ gap: space.sm }}>
            {matchingShops.map((s) => (
              <PressableScale
                key={s.id}
                accessibilityRole="link"
                accessibilityLabel={`Boutique ${s.name}`}
                onPress={() => router.push({ pathname: '/boutique/[id]', params: { id: s.id } })}
                scaleTo={pressScale.card}
                style={styles.shopRow}
              >
                <ShopAvatar shop={s} size={44} />
                <View style={styles.flex}>
                  <Text variant="labelL" numberOfLines={1}>
                    {s.name}
                  </Text>
                  <Text variant="bodyS" color={color.text.secondary} numberOfLines={1}>
                    Boutique · {s.category ?? 'Marketplace'} · {s.area}
                  </Text>
                </View>
                <ChevronRight size={20} color={color.icon.secondary} strokeWidth={2} />
              </PressableScale>
            ))}
          </View>
        ) : null}

        <View style={styles.summary}>
          <Text variant="bodyM" color={color.text.secondary} accessibilityLiveRegion="polite">
            {loading ? 'Recherche…' : summary}
          </Text>
          <PressableScale accessibilityRole="button" accessibilityLabel={`Trier : ${sortLabels[sort]}`} onPress={onSort} hitSlop={8} scaleTo={pressScale.icon} style={styles.sort}>
            <Text variant="labelM">{sortLabels[sort]}</Text>
            <ChevronDown size={18} color={color.icon.primary} strokeWidth={2} />
          </PressableScale>
        </View>

        {loading ? <GridSkeleton width={width} /> : <ProductGrid key={key} items={items} width={width} />}
      </View>
    </ScrollView>
  );
}

function CategoryChip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <PressableScale
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      onPress={onPress}
      haptic="selection"
      scaleTo={pressScale.icon}
      style={[styles.chip, selected ? styles.chipOn : styles.chipOff]}
    >
      <Text variant="labelM" color={selected ? color.text.inverse : color.text.primary}>
        {label}
      </Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg.canvas },
  flex: { flex: 1, minWidth: 0 },
  header: {
    backgroundColor: color.bg.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.screen,
    paddingBottom: space.md,
  },
  back: { width: 32, height: HIT, alignItems: 'center', justifyContent: 'center', marginLeft: -space.xs },
  browse: { paddingBottom: space.screen },
  titleBlock: { backgroundColor: color.bg.surface, paddingHorizontal: space.screen, paddingTop: space.lg, paddingBottom: space.md, gap: space.xs },
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md, paddingHorizontal: space.screen, paddingTop: space.sm },
  catCell: { width: '48%', flexGrow: 1 },
  catCard: { backgroundColor: color.bg.surface, borderRadius: radius.lg, padding: space.lg, gap: space.md },
  catIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: color.bg.accentSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typing: { backgroundColor: color.bg.surface, flexGrow: 1, paddingHorizontal: space.screen, paddingTop: space.sm, gap: space.xl },
  listGroup: { gap: space.sm },
  overlineRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  overline: { letterSpacing: 0.6 },
  queryRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 52 },
  queryIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: color.bg.surfaceSunken,
    alignItems: 'center',
    justifyContent: 'center',
  },
  results: { paddingBottom: space.screen },
  chipsBar: { backgroundColor: color.bg.surface, flexGrow: 0 },
  chips: { paddingHorizontal: space.screen, paddingBottom: space.md, gap: space.sm },
  chip: { height: 40, paddingHorizontal: space.md, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  chipOn: { backgroundColor: color.bg.brand },
  chipOff: { backgroundColor: color.bg.surface, borderWidth: 1, borderColor: color.border.default },
  inner: { paddingHorizontal: space.screen, paddingTop: space.lg, gap: space.md },
  shopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: color.bg.surface,
    borderRadius: radius.lg,
    padding: space.md,
  },
  summary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sort: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  empty: { paddingHorizontal: space.screen, paddingTop: 96, paddingBottom: space.screen, gap: 56 },
  emptyHead: { alignItems: 'center', gap: space.md },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: color.bg.surfaceSunken,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.sm,
  },
});
