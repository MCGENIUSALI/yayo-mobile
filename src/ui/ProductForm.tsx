import { Plus } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { formatFC } from '@/domain/money';
import { MAX_PHOTOS, parseAmount, payoutPreview, PRODUCT_CATEGORIES as CATEGORIES, PRODUCT_COLORS, type ProductDraft, type SellerProduct } from '@/domain/seller';
import { pressScale } from '@/theme/motion';
import { color, radius, space, type as typeScale } from '@/theme/tokens';
import { SelectField } from './Auth';
import { Chip, TextField } from './Form';
import { haptic, PressableScale } from './Pressable';
import { AddPhotoTile } from './PhotoPicker';
import { PhotoTile } from './Seller';
import { Sheet } from './Sheet';
import { Text } from './Text';

export function draftOf(p?: SellerProduct): ProductDraft {
  return {
    name: p?.name ?? '',
    category: p?.category ?? '',
    description: p?.description ?? '',
    photos: p?.photos ?? [],
    price: p && p.price > 0 ? groupDigits(String(p.price)) : '',
    compareAt: p?.compareAt ? groupDigits(String(p.compareAt)) : '',
    stock: p ? String(p.stock) : '',
    colors: p?.colors ?? [],
  };
}

/** "95000" → "95 000" while typing. */
export function groupDigits(input: string): string {
  const d = input.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
  return d.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/** V9 photo strip: up to 6, the first is the cover. */
export function PhotoStrip({ photos, onChange }: { photos: ProductDraft['photos']; onChange: (p: ProductDraft['photos']) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
      {photos.map((ph, i) => (
        <View key={typeof ph === 'string' ? ph : `${ph}-${i}`}>
          <PhotoTile photo={ph} label={i === 0 ? 'Photo de couverture' : `Photo ${i + 1}`} onRemove={() => onChange(photos.filter((_, j) => j !== i))} />
          {i === 0 ? (
            <View style={styles.cover}>
              <Text variant="caption" color={color.text.inverse}>
                Couverture
              </Text>
            </View>
          ) : null}
        </View>
      ))}
      {photos.length < MAX_PHOTOS ? (
        <AddPhotoTile
          title="Ajouter des photos"
          max={MAX_PHOTOS - photos.length}
          // Kept in the order picked; the same image picked twice is added once.
          onPickMany={(picked) => onChange([...photos, ...picked.filter((p, i) => !photos.includes(p) && picked.indexOf(p) === i)].slice(0, MAX_PHOTOS))}
        />
      ) : null}
    </ScrollView>
  );
}

/** V9 · Photos et description. */
export function InfoFields({ draft, set, errors }: { draft: ProductDraft; set: (p: Partial<ProductDraft>) => void; errors: boolean }) {
  return (
    <>
      <View style={{ gap: space.sm }}>
        <Text variant="labelM">Photos (jusqu’à {MAX_PHOTOS}, la première est la couverture)</Text>
        <PhotoStrip photos={draft.photos} onChange={(photos) => set({ photos })} />
        {errors && draft.photos.length === 0 ? (
          <Text variant="bodyS" color={color.text.danger}>
            Ajoute au moins une photo.
          </Text>
        ) : null}
      </View>
      <TextField
        label="Nom du produit"
        value={draft.name}
        onChangeText={(name) => set({ name })}
        placeholder="Ex. JBL Go 3 – Enceinte portable"
        error={errors && draft.name.trim().length < 3 ? 'Indique le nom du produit.' : undefined}
      />
      <View style={{ gap: space.xs }}>
        <SelectField label="Catégorie" value={draft.category || undefined} placeholder="Choisis une catégorie" options={CATEGORIES} onChange={(category) => set({ category })} />
        {errors && !draft.category ? (
          <Text variant="bodyS" color={color.text.danger}>
            Choisis une catégorie.
          </Text>
        ) : null}
      </View>
      <View style={{ gap: space.xs }}>
        <Text variant="labelM">Description</Text>
        <TextInput
          accessibilityLabel="Description"
          value={draft.description}
          onChangeText={(description) => set({ description })}
          placeholder="Son, autonomie, dimensions…"
          placeholderTextColor={color.text.tertiary}
          selectionColor={color.bg.accent}
          multiline
          style={[typeScale.bodyL, styles.area]}
        />
        <Text variant="bodyS" color={color.text.secondary}>
          Décris l’état, les dimensions et ce qui est inclus.
        </Text>
      </View>
    </>
  );
}

/** V10 · Prix, stock et variantes. */
export function PriceFields({ draft, set, errors }: { draft: ProductDraft; set: (p: Partial<ProductDraft>) => void; errors: boolean }) {
  const [adding, setAdding] = useState(false);
  const price = parseAmount(draft.price);
  const preview = price > 0 ? payoutPreview(price) : null;
  const compareAt = parseAmount(draft.compareAt);
  const compareErr = draft.compareAt.trim() && price > 0 && !(compareAt > price) ? 'Plus élevé que le prix de vente.' : undefined;
  return (
    <>
      <View style={styles.two}>
        <View style={{ flex: 1 }}>
          <TextField
            label="Prix de vente (FC)"
            value={draft.price}
            onChangeText={(v) => set({ price: groupDigits(v) })}
            keyboardType="number-pad"
            inputMode="numeric"
            placeholder="95 000"
            error={errors && !(price > 0) ? 'Indique un prix.' : undefined}
          />
        </View>
        <View style={{ flex: 1 }}>
          <TextField
            label="Prix barré (facultatif)"
            value={draft.compareAt}
            onChangeText={(v) => set({ compareAt: groupDigits(v) })}
            keyboardType="number-pad"
            inputMode="numeric"
            placeholder="118 000"
            muted
            error={compareErr}
          />
        </View>
      </View>
      {preview ? (
        <View style={styles.preview} accessible accessibilityLabel={`Tu reçois ${formatFC(preview.net)} hors livraison`}>
          <Row label="Prix de vente" value={formatFC(price)} />
          <Row label="Commission YA YO (10 %)" value={formatFC(-preview.commission)} tone="success" />
          <View style={styles.previewTotal}>
            <Text variant="labelL">Tu reçois (hors livraison)</Text>
            <Text variant="priceL">{formatFC(preview.net)}</Text>
          </View>
        </View>
      ) : null}
      <View style={{ gap: space.xs }}>
        <TextField
          label="Quantité en stock"
          value={draft.stock}
          onChangeText={(v) => set({ stock: v.replace(/\D/g, '') })}
          keyboardType="number-pad"
          inputMode="numeric"
          placeholder="14"
          error={errors && !(parseAmount(draft.stock) >= 0) ? 'Indique la quantité (0 si tu n’en as plus).' : undefined}
        />
        <Text variant="bodyS" color={color.text.secondary}>
          Le produit passe en rupture automatiquement à 0.
        </Text>
      </View>
      <View style={{ gap: space.sm }}>
        <Text variant="labelM">Couleurs disponibles</Text>
        <View style={styles.colors}>
          {draft.colors.map((c) => (
            <Chip key={c} label={c} selected onPress={() => set({ colors: draft.colors.filter((x) => x !== c) })} />
          ))}
          <PressableScale accessibilityRole="button" accessibilityLabel="Ajouter une couleur" onPress={() => setAdding(true)} haptic="selection" scaleTo={pressScale.icon} style={styles.addColor}>
            <Plus size={14} color={color.icon.primary} strokeWidth={2.5} />
            <Text variant="labelM">Ajouter</Text>
          </PressableScale>
        </View>
        {draft.colors.length ? (
          <Text variant="bodyS" color={color.text.secondary}>
            Touche une couleur pour la retirer.
          </Text>
        ) : null}
      </View>
      <Sheet visible={adding} onClose={() => setAdding(false)} title="Ajouter une couleur">
        <View style={styles.colors}>
          {PRODUCT_COLORS.filter((c) => !draft.colors.includes(c)).map((c) => (
            <Chip
              key={c}
              label={c}
              selected={false}
              onPress={() => {
                haptic('selection');
                set({ colors: [...draft.colors, c] });
                setAdding(false);
              }}
            />
          ))}
        </View>
      </Sheet>
    </>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: 'success' }) {
  return (
    <View style={styles.between}>
      <Text variant="bodyS" color={color.text.secondary}>
        {label}
      </Text>
      <Text variant="labelS" color={tone === 'success' ? color.text.success : color.text.primary}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  strip: { gap: space.sm },
  cover: { position: 'absolute', left: 6, bottom: 6, backgroundColor: 'rgba(10,10,11,0.7)', borderRadius: radius.sm, paddingHorizontal: 6, paddingVertical: 2 },
  area: {
    minHeight: 96,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.border.subtle,
    backgroundColor: color.bg.surfaceMuted,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    color: color.text.primary,
    textAlignVertical: 'top',
  },
  two: { flexDirection: 'row', gap: space.md },
  preview: { backgroundColor: color.bg.surface, borderRadius: radius.lg, padding: space.lg, gap: space.sm },
  previewTotal: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm, marginTop: space.xs },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  colors: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  addColor: { flexDirection: 'row', alignItems: 'center', gap: space.xs, height: 36, paddingHorizontal: space.md, borderRadius: radius.full, borderWidth: 1, borderColor: color.border.default, backgroundColor: color.bg.surface },
});
