import { BadgeCheck, Banknote, Check, Search, SlidersHorizontal, Truck, X, type LucideIcon } from 'lucide-react-native';
import { useState, type ComponentRef, type Ref } from 'react';
import { Platform, ScrollView, StyleSheet, Switch, TextInput, View, type TextInputProps, type TextStyle } from 'react-native';
import {
  categories,
  noFilters,
  priceRangeError,
  searchProducts,
  sortLabels,
  type MinRating,
  type SearchFilters,
  type SortKey,
} from '@/domain/search';
import { pressScale } from '@/theme/motion';
import { color, radius, space, type as typeScale } from '@/theme/tokens';
import { Button } from './Button';
import { Chip, Radio } from './Form';
import { haptic, PressableScale } from './Pressable';
import { Sheet } from './Sheet';
import { Text } from './Text';

/* ---------- Search field (B2/E4/E5 header) ---------- */

export interface SearchFieldProps extends Omit<TextInputProps, 'style'> {
  value: string;
  onChangeText: (v: string) => void;
  onFilter: () => void;
  /** Number of active filters, shown as a badge on the filter button. */
  filterCount?: number;
  ref?: Ref<ComponentRef<typeof TextInput>>;
}

export function SearchField({ value, onChangeText, onFilter, filterCount = 0, onFocus, onBlur, ref, ...input }: SearchFieldProps) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={[styles.field, focused && styles.fieldFocused]}>
      <Search size={20} color={color.icon.secondary} strokeWidth={2} />
      <TextInput
        ref={ref}
        value={value}
        onChangeText={onChangeText}
        accessibilityLabel="Rechercher un produit, une boutique"
        placeholder="Rechercher un produit, une boutique…"
        placeholderTextColor={color.text.tertiary}
        selectionColor={color.bg.accent}
        returnKeyType="search"
        autoCorrect={false}
        autoCapitalize="none"
        enterKeyHint="search"
        {...input}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        style={[typeScale.bodyL, styles.input, noWebOutline]}
      />
      {value ? (
        <PressableScale accessibilityLabel="Effacer la recherche" onPress={() => onChangeText('')} hitSlop={8} scaleTo={pressScale.icon} style={styles.clear}>
          <X size={16} color={color.icon.secondary} strokeWidth={2.5} />
        </PressableScale>
      ) : null}
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={filterCount ? `Filtres, ${filterCount} actif${filterCount > 1 ? 's' : ''}` : 'Filtres'}
        onPress={onFilter}
        haptic="selection"
        scaleTo={pressScale.icon}
        style={styles.filterBtn}
      >
        <SlidersHorizontal size={18} color={color.icon.inverse} strokeWidth={2} />
        {filterCount ? (
          <View style={styles.filterBadge}>
            <Text variant="caption" color={color.text.inverse}>
              {filterCount}
            </Text>
          </View>
        ) : null}
      </PressableScale>
    </View>
  );
}

/* ---------- B3 · Filtres ---------- */

const RATINGS: { value: MinRating; label: string }[] = [
  { value: 0, label: 'Toutes' },
  { value: 4, label: '4★ et +' },
  { value: 4.5, label: '4,5★ et +' },
];

export function FilterSheet({
  visible,
  query,
  filters,
  onClose,
  onApply,
}: {
  visible: boolean;
  query: string;
  filters: SearchFilters;
  onClose: () => void;
  onApply: (f: SearchFilters) => void;
}) {
  // The draft lives in the sheet: closing without applying discards it.
  const [draft, setDraft] = useState(filters);
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) setDraft(filters);
  }
  const set = (patch: Partial<SearchFilters>) => setDraft((d) => ({ ...d, ...patch }));
  const priceError = priceRangeError(draft);
  const count = priceError ? 0 : searchProducts(query, draft).length;

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Filtres"
      footer={
        <>
          <Button label="Effacer" variant="outline" haptic="selection" onPress={() => setDraft(noFilters)} style={styles.clearBtn} />
          <Button
            label={priceError ? 'Corrige le prix' : count ? `Voir ${count} résultat${count > 1 ? 's' : ''}` : 'Aucun résultat'}
            disabled={!!priceError || count === 0}
            haptic="medium"
            onPress={() => {
              onApply(draft);
              onClose();
            }}
            style={styles.flex}
          />
        </>
      }
    >
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetBody} keyboardShouldPersistTaps="handled">
        <View style={styles.group}>
          <Text variant="labelL">Catégorie</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} accessibilityRole="radiogroup">
            {categories.map((c) => (
              <Chip
                key={c.id}
                label={c.label}
                selected={draft.category === c.id}
                onPress={() => set({ category: draft.category === c.id ? undefined : c.id })}
              />
            ))}
          </ScrollView>
        </View>

        <View style={styles.group}>
          <Text variant="labelL">Prix (FC)</Text>
          <View style={styles.prices}>
            <PriceInput label="Min" value={draft.minPrice} onChange={(minPrice) => set({ minPrice })} invalid={!!priceError} />
            <PriceInput label="Max" value={draft.maxPrice} onChange={(maxPrice) => set({ maxPrice })} invalid={!!priceError} />
          </View>
          {priceError ? (
            <Text variant="bodyS" color={color.text.danger} accessibilityLiveRegion="polite">
              {priceError}
            </Text>
          ) : null}
        </View>

        <View style={styles.group}>
          <Text variant="labelL">Note minimale</Text>
          <View style={styles.chips} accessibilityRole="radiogroup">
            {RATINGS.map((r) => (
              <Chip key={r.value} label={r.label} selected={draft.minRating === r.value} onPress={() => set({ minRating: r.value })} />
            ))}
          </View>
        </View>

        <View style={styles.toggles}>
          <ToggleRow
            icon={BadgeCheck}
            title="Vendeurs certifiés"
            body="Boutiques vérifiées par YA YO"
            value={draft.verifiedOnly}
            onChange={(verifiedOnly) => set({ verifiedOnly })}
          />
          <ToggleRow icon={Truck} title="Livraison en 24 h" body="Disponible à Kinshasa" value={draft.fastDelivery} onChange={(fastDelivery) => set({ fastDelivery })} />
          <ToggleRow
            icon={Banknote}
            title="Paiement à la livraison"
            body="Cash accepté"
            value={draft.cashOnDelivery}
            onChange={(cashOnDelivery) => set({ cashOnDelivery })}
          />
        </View>
      </ScrollView>
    </Sheet>
  );
}

const group3 = (digits: string) => digits.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

function PriceInput({ label, value, onChange, invalid }: { label: string; value?: number; onChange: (v?: number) => void; invalid: boolean }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.priceCol}>
      <Text variant="labelM">{label}</Text>
      <View style={[styles.priceBox, focused && styles.priceFocused, invalid && styles.priceInvalid]}>
        <TextInput
          accessibilityLabel={`Prix ${label === 'Min' ? 'minimum' : 'maximum'} en francs congolais`}
          value={value != null ? group3(String(value)) : ''}
          onChangeText={(t) => {
            const digits = t.replace(/\D/g, '').slice(0, 9);
            onChange(digits ? Number(digits) : undefined);
          }}
          keyboardType="number-pad"
          inputMode="numeric"
          placeholder={label === 'Min' ? '0' : 'Sans limite'}
          placeholderTextColor={color.text.tertiary}
          selectionColor={color.bg.accent}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={[typeScale.bodyL, styles.priceText, noWebOutline]}
        />
        {value != null ? <Text variant="bodyL">FC</Text> : null}
      </View>
    </View>
  );
}

function ToggleRow({
  icon: Icon,
  title,
  body,
  value,
  onChange,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <View style={styles.toggleRow}>
      <View style={styles.toggleIcon}>
        <Icon size={20} color={color.icon.primary} strokeWidth={2} />
      </View>
      <View style={styles.flex}>
        <Text variant="labelL">{title}</Text>
        <Text variant="bodyS" color={color.text.secondary}>
          {body}
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

/* ---------- Sort sheet ---------- */

export function SortSheet({ visible, value, onClose, onChange }: { visible: boolean; value: SortKey; onClose: () => void; onChange: (s: SortKey) => void }) {
  return (
    <Sheet visible={visible} onClose={onClose} title="Trier par">
      <View accessibilityRole="radiogroup" style={styles.sortList}>
        {(Object.keys(sortLabels) as SortKey[]).map((k) => (
          <PressableScale
            key={k}
            accessibilityRole="radio"
            accessibilityState={{ checked: value === k }}
            onPress={() => {
              onChange(k);
              onClose();
            }}
            haptic="selection"
            scaleTo={pressScale.card}
            style={styles.sortRow}
          >
            <Text variant="labelL" style={styles.flex}>
              {sortLabels[k]}
            </Text>
            {value === k ? <Check size={20} color={color.icon.accent} strokeWidth={2.5} /> : <Radio checked={false} />}
          </PressableScale>
        ))}
      </View>
    </Sheet>
  );
}

/** react-native-web draws a focus outline inside the pill; the pill itself shows focus. */
const noWebOutline = (Platform.OS === 'web' ? { outlineStyle: 'none' } : {}) as TextStyle;

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  field: {
    flex: 1,
    height: 52,
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: color.border.focus,
    backgroundColor: color.bg.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingLeft: space.lg,
    paddingRight: space.xs,
  },
  fieldFocused: { shadowColor: color.bg.accent, shadowOpacity: 0.25, shadowRadius: 3, shadowOffset: { width: 0, height: 0 } },
  input: { flex: 1, minWidth: 0, color: color.text.primary, paddingVertical: 0, height: '100%' },
  clear: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: color.bg.surfaceSunken,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: color.bg.inverse,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: color.bg.accent,
    borderWidth: 1.5,
    borderColor: color.bg.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetBody: { gap: space.xl, paddingBottom: space.xs },
  group: { gap: space.md },
  chips: { flexDirection: 'row', gap: space.sm },
  prices: { flexDirection: 'row', gap: space.md },
  priceCol: { flex: 1, gap: space.sm },
  priceBox: {
    height: 52,
    borderRadius: radius.md,
    backgroundColor: color.bg.surfaceMuted,
    borderWidth: 1,
    borderColor: color.border.subtle,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.lg,
    gap: space.xs,
  },
  priceFocused: { borderColor: color.border.focus, backgroundColor: color.bg.surface },
  priceInvalid: { borderColor: color.text.danger },
  priceText: { flex: 1, minWidth: 0, color: color.text.primary, paddingVertical: 0 },
  toggles: { gap: space.lg },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  toggleIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: color.bg.surfaceSunken,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearBtn: { paddingHorizontal: space.xl },
  sortList: { gap: space.xs },
  sortRow: { flexDirection: 'row', alignItems: 'center', minHeight: 52, gap: space.md },
});
