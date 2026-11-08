import { Image } from 'expo-image';
import { Check, Eye, Play } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { addMs, MAX_LINKED_PRODUCTS, scheduleError, type ContentItem } from '@/domain/content';
import { formatCount } from '@/domain/feed';
import { formatDayTime } from '@/domain/format';
import { formatFC, formatUSD } from '@/domain/money';
import type { SellerProduct } from '@/domain/seller';
import { useSeller } from '@/store/useSeller';
import { pressScale } from '@/theme/motion';
import { color, radius, space } from '@/theme/tokens';
import { Button } from './Button';
import { Alert } from './Feedback';
import { Chip, TextField } from './Form';
import { PressableScale } from './Pressable';
import { Sheet } from './Sheet';
import { Text } from './Text';

/* ---------- Seller products ---------- */

/** The signed-in seller's products, and the ones that may be linked (online, in stock). */
export function useSellerCatalog() {
  const { shop } = useSeller();
  const list = shop?.products ?? [];
  const byId = (id: string) => list.find((p) => p.id === id);
  const linkable = list.filter((p) => p.status === 'online' && p.stock > 0).map((p) => p.id);
  return { list, byId, linkable };
}

/** A content whose linked product ran out (SV1 « Rupture », SV7 alert). */
export function outOfStockLinks(item: ContentItem, byId: (id: string) => SellerProduct | undefined): SellerProduct[] {
  return item.productIds.map(byId).filter((p): p is SellerProduct => !!p && (p.stock <= 0 || p.status !== 'online'));
}

/* ---------- SV1 tile ---------- */

export function ContentTile({ item, width, badge, onPress }: { item: ContentItem; width: number; badge?: string; onPress: () => void }) {
  const cover = item.poster ?? item.media[0];
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`${item.caption || 'Sans légende'}, ${formatCount(item.stats.views)} vues${badge ? `, ${badge}` : ''}`}
      onPress={onPress}
      scaleTo={pressScale.card}
      style={[styles.tile, { width, height: Math.round(width * 1.3) }]}
    >
      {cover ? <Image source={cover} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
      {item.kind === 'video' ? (
        <View style={styles.play}>
          <Play size={16} color={color.icon.inverse} strokeWidth={2} />
        </View>
      ) : null}
      {badge ? (
        <View style={styles.badge}>
          <Text variant="caption" color={color.text.danger}>
            {badge}
          </Text>
        </View>
      ) : null}
      <View style={styles.views}>
        <Eye size={14} color={color.icon.inverse} strokeWidth={2} />
        <Text variant="caption" color={color.text.inverse}>
          {formatCount(item.stats.views)}
        </Text>
      </View>
    </PressableScale>
  );
}

/* ---------- Linked product row (SV2, SV13, SV16) ---------- */

export function LinkedProductRow({ product, onRemove, actionLabel = 'Retirer' }: { product: SellerProduct; onRemove?: () => void; actionLabel?: string }) {
  const out = product.stock <= 0;
  return (
    <View style={styles.linked}>
      {product.photos[0] ? <Image source={product.photos[0]} style={styles.linkedImg} contentFit="cover" /> : <View style={styles.linkedImg} />}
      <View style={styles.flex}>
        <Text variant="labelM" numberOfLines={1}>
          {product.name}
        </Text>
        <View style={styles.row}>
          <Text variant="priceS">{formatFC(product.price)}</Text>
          <Text variant="caption" color={out ? color.text.danger : color.text.tertiary}>
            {out ? 'Rupture' : formatUSD(product.price)}
          </Text>
        </View>
      </View>
      {onRemove ? <Button label={actionLabel} size="S" variant="accent" onPress={onRemove} /> : null}
    </View>
  );
}

/* ---------- SV3 · Lier des produits ---------- */

export function ProductPickerSheet({
  visible,
  selected,
  max = MAX_LINKED_PRODUCTS,
  title = 'Lier des produits',
  note = `Seuls tes produits en ligne et en stock peuvent être liés (${MAX_LINKED_PRODUCTS} maximum).`,
  onClose,
  onDone,
}: {
  visible: boolean;
  selected: string[];
  max?: number;
  title?: string;
  note?: string;
  onClose: () => void;
  onDone: (ids: string[]) => void;
}) {
  const { list, linkable } = useSellerCatalog();
  const [picked, setPicked] = useState<string[]>(selected);
  const [opened, setOpened] = useState(false);
  if (visible && !opened) {
    setOpened(true);
    setPicked(selected);
  }
  if (!visible && opened) setOpened(false);
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length >= max ? p : [...p, id]));
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={title}
      footer={<Button label={`Valider (${picked.length})`} onPress={() => onDone(picked)} fill />}
    >
      <Text variant="bodyS" color={color.text.secondary}>
        {note}
      </Text>
      <View style={{ gap: space.sm }}>
        {list.map((p) => {
          const ok = linkable.includes(p.id);
          const on = picked.includes(p.id);
          return (
            <PressableScale
              key={p.id}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on, disabled: !ok }}
              accessibilityLabel={p.name}
              disabled={!ok}
              onPress={() => toggle(p.id)}
              haptic="selection"
              scaleTo={pressScale.card}
              style={[styles.pick, on && styles.pickOn, !ok && { opacity: 0.5 }]}
            >
              {p.photos[0] ? <Image source={p.photos[0]} style={styles.linkedImg} contentFit="cover" /> : <View style={styles.linkedImg} />}
              <View style={styles.flex}>
                <Text variant="labelM" numberOfLines={1}>
                  {p.name}
                </Text>
                <Text variant="bodyS" color={color.text.secondary}>
                  {`${formatFC(p.price)} · ${p.stock > 0 ? `${p.stock} en stock` : 'Rupture'}${p.status !== 'online' ? ' · hors ligne' : ''}`}
                </Text>
              </View>
              <View style={[styles.check, on && styles.checkOn]}>{on ? <Check size={16} color={color.icon.inverse} strokeWidth={3} /> : null}</View>
            </PressableScale>
          );
        })}
      </View>
    </Sheet>
  );
}

/* ---------- SV5 · Programmer (also SV16 date) ---------- */

const DAY = 24 * 3_600_000;

function dayLabel(d: Date, i: number) {
  if (i === 0) return 'Aujourd’hui';
  if (i === 1) return 'Demain';
  return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
}

/** Local date + "HH:MM" → ISO, or null when the time is not valid. */
export function toIso(dayOffset: number, hhmm: string, now = new Date()): string | null {
  const m = /^(\d{1,2})[:h](\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  const d = new Date(now.getTime() + dayOffset * DAY);
  d.setHours(h, min, 0, 0);
  return d.toISOString();
}

export function DateTimeFields({ day, time, onDay, onTime }: { day: number; time: string; onDay: (d: number) => void; onTime: (t: string) => void }) {
  const now = new Date();
  return (
    <View style={{ gap: space.md }}>
      <View style={{ gap: space.xs }}>
        <Text variant="labelM">Date</Text>
        <View style={styles.chips}>
          {Array.from({ length: 8 }, (_, i) => (
            <Chip key={i} label={dayLabel(new Date(now.getTime() + i * DAY), i)} selected={day === i} onPress={() => onDay(i)} />
          ))}
        </View>
      </View>
      <TextField label="Heure" placeholder="19:00" value={time} onChangeText={onTime} keyboardType="numbers-and-punctuation" maxLength={5} />
    </View>
  );
}

export function ScheduleSheet({ visible, onClose, onConfirm }: { visible: boolean; onClose: () => void; onConfirm: (iso: string) => void }) {
  const [day, setDay] = useState(1);
  const [time, setTime] = useState('19:00');
  const now = new Date().toISOString();
  const iso = toIso(day, time);
  const error = iso ? scheduleError(iso, now) : 'Indique l’heure au format 19:00.';
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Programmer la publication"
      footer={<Button label={iso && !error ? `Programmer pour ${formatDayTime(iso)}` : 'Programmer'} disabled={!!error} onPress={() => iso && onConfirm(iso)} fill />}
    >
      <DateTimeFields day={day} time={time} onDay={setDay} onTime={setTime} />
      <Text variant="caption" color={error ? color.text.danger : color.text.tertiary}>
        {error ?? 'Entre 15 min et 30 jours à partir de maintenant'}
      </Text>
      {iso && !error ? (
        <Alert tone="info" title={`Tes abonnés la verront ${formatDayTime(iso)}`} body="Elle reste dans Programmées jusque-là. Tu peux la modifier ou l’annuler." />
      ) : null}
    </Sheet>
  );
}

export const inMinutes = (min: number) => addMs(new Date().toISOString(), min * 60_000);

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0, gap: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  tile: { borderRadius: radius.md, overflow: 'hidden', backgroundColor: color.bg.surfaceSunken },
  play: { position: 'absolute', top: space.sm, left: space.sm },
  badge: { position: 'absolute', top: space.sm, right: space.sm, backgroundColor: color.bg.dangerSubtle, borderRadius: radius.full, paddingHorizontal: space.sm, paddingVertical: 1 },
  views: { position: 'absolute', left: space.sm, bottom: space.sm, flexDirection: 'row', alignItems: 'center', gap: 2 },
  linked: { flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: color.bg.surface, borderRadius: radius.md, borderWidth: 1, borderColor: color.border.subtle, padding: space.sm },
  linkedImg: { width: 48, height: 48, borderRadius: radius.sm, backgroundColor: color.bg.surfaceSunken },
  pick: { flexDirection: 'row', alignItems: 'center', gap: space.md, borderRadius: radius.md, borderWidth: 1, borderColor: color.border.subtle, padding: space.sm },
  pickOn: { borderColor: color.border.focus, borderWidth: 2, padding: space.sm - 1 },
  check: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: color.border.strong, alignItems: 'center', justifyContent: 'center' },
  checkOn: { backgroundColor: color.bg.accent, borderColor: color.bg.accent },
});
