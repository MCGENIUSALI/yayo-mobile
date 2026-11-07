import { ArrowRight, Banknote, Check, ChevronDown, CircleCheck, CircleX, MapPin, Navigation, Package, Store, type LucideIcon } from 'lucide-react-native';
import { useEffect, useRef, useState, type ComponentRef, type ReactNode } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Switch, TextInput, View, type TextStyle } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { cashToCollect, dropoffLine, etaMinutes, finishedAt, incidentLabel, missionPay, parcelCount, routeLabel } from '@/domain/courier';
import { getShop } from '@/domain/catalog';
import { formatDay, formatTime, plural } from '@/domain/format';
import { formatFC } from '@/domain/money';
import type { Order } from '@/domain/types';
import { pressScale } from '@/theme/motion';
import { color, elevation, radius, space } from '@/theme/tokens';
import { Button } from './Button';
import { useEnter } from './Feedback';
import { haptic, PressableScale } from './Pressable';
import { Sheet } from './Sheet';
import { refocus, useDeferredAutoFocus } from './keyboard';
import { Text } from './Text';

const noWebOutline = (Platform.OS === 'web' ? { outlineStyle: 'none' } : {}) as TextStyle;

/* ---------- Availability toggle (L4 / L12) ---------- */

export function AvailabilityCard({ available, onChange, disabled = false }: { available: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <View style={[styles.availability, available ? styles.availableOn : styles.availableOff]}>
      <View style={styles.flex}>
        <Text variant="labelL">{available ? 'Tu es disponible' : 'Tu es indisponible'}</Text>
        <Text variant="bodyS" color={color.text.secondary}>
          {available ? 'Tu reçois les missions autour de toi' : 'Active-toi pour recevoir des missions'}
        </Text>
      </View>
      <Switch
        accessibilityLabel="Disponible pour des missions"
        value={available}
        disabled={disabled}
        onValueChange={(v) => {
          haptic(v ? 'success' : 'selection');
          onChange(v);
        }}
        trackColor={{ false: color.border.strong, true: color.bg.success }}
        thumbColor={color.bg.surface}
        ios_backgroundColor={color.border.strong}
      />
    </View>
  );
}

/* ---------- Chips (distance, cash, stage) ---------- */

export function Chip({ icon: Icon, label, tone = 'neutral' }: { icon?: LucideIcon; label: string; tone?: 'neutral' | 'warning' | 'accent' | 'info' | 'success' }) {
  const t = {
    neutral: { bg: color.bg.surfaceSunken, fg: color.text.secondary, icon: color.icon.secondary },
    warning: { bg: color.bg.warningSubtle, fg: color.text.warning, icon: color.icon.warning },
    accent: { bg: color.bg.accentSubtle, fg: color.text.accent, icon: color.icon.accent },
    info: { bg: color.bg.infoSubtle, fg: color.text.info, icon: color.icon.info },
    success: { bg: color.bg.successSubtle, fg: color.text.success, icon: color.icon.success },
  }[tone];
  return (
    <View style={[styles.chip, { backgroundColor: t.bg }]}>
      {Icon ? <Icon size={14} color={t.icon} strokeWidth={2} /> : null}
      <Text variant="labelS" color={t.fg} numberOfLines={1} style={{ flexShrink: 1 }}>
        {label}
      </Text>
    </View>
  );
}

export function CashChip({ order }: { order: Order }) {
  const cash = cashToCollect(order);
  if (!cash) return null;
  return <Chip icon={Banknote} label={`Cash à encaisser : ${formatFC(cash)}`} tone="warning" />;
}

/* ---------- Route stops (collecte → livraison) ---------- */

export function Stop({ kind, title, line }: { kind: 'pickup' | 'dropoff'; title: string; line: string }) {
  const pickup = kind === 'pickup';
  const Icon = pickup ? Store : MapPin;
  return (
    <View style={styles.stop}>
      <View style={[styles.stopIcon, { backgroundColor: pickup ? color.bg.inverse : color.bg.accent }]}>
        <Icon size={16} color={color.icon.inverse} strokeWidth={2} />
      </View>
      <View style={styles.flex}>
        <Text variant="labelM" numberOfLines={1}>
          {title}
        </Text>
        <Text variant="bodyS" color={color.text.secondary} numberOfLines={1}>
          {line}
        </Text>
      </View>
    </View>
  );
}

export function RouteStops({ order, pickup }: { order: Order; pickup: string }) {
  return (
    <View style={{ gap: space.md }}>
      <Stop kind="pickup" title={`Collecte · ${getShop(order.shopId).name}`} line={pickup} />
      <Stop kind="dropoff" title={`Livraison · ${order.buyer?.name ?? 'Client'}`} line={dropoffLine(order)} />
    </View>
  );
}

/* ---------- Mission card (L4 proposal, L13 in progress) ---------- */

function MissionHead({ order, label, labelColor }: { order: Order; label: string; labelColor: string }) {
  return (
    <View style={styles.between}>
      <View style={styles.flex}>
        <Text variant="caption" color={labelColor} style={styles.overline}>
          {label.toUpperCase()}
        </Text>
        <Text variant="labelL">
          #{order.mission!.id} · {plural(parcelCount(order), 'colis', 'colis')}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text variant="priceM" color={color.text.success}>
          {formatFC(missionPay(order))}
        </Text>
        <Text variant="caption" color={color.text.secondary}>
          ta rémunération
        </Text>
      </View>
    </View>
  );
}

export function ProposalCard({
  order,
  pickup,
  onAccept,
  onDecline,
  onOpen,
  busy = false,
}: {
  order: Order;
  pickup: string;
  onAccept: () => void;
  onDecline: () => void;
  onOpen: () => void;
  busy?: boolean;
}) {
  const entering = useEnter(1);
  const km = order.mission!.distanceKm;
  return (
    <Animated.View entering={entering} style={[styles.card, styles.proposal]}>
      <PressableScale accessibilityRole="link" accessibilityLabel={`Mission ${order.mission!.id}, ${formatFC(missionPay(order))}`} onPress={onOpen} scaleTo={pressScale.card} style={{ gap: space.md }}>
        <MissionHead order={order} label="Nouvelle mission" labelColor={color.text.accent} />
        <RouteStops order={order} pickup={pickup} />
        <View style={styles.chips}>
          <Chip icon={Navigation} label={`${km.toLocaleString('fr-FR')} km · ${etaMinutes(km)} min`} />
          <CashChip order={order} />
        </View>
      </PressableScale>
      <View style={styles.actions}>
        <Button label="Refuser" variant="secondary" size="M" haptic="selection" onPress={onDecline} style={styles.decline} />
        <Button label="Accepter la mission" variant="accent" size="M" haptic="success" loading={busy} onPress={onAccept} style={styles.flex} />
      </View>
    </Animated.View>
  );
}

const STAGE_CHIP: Record<'pickup' | 'delivery' | 'handover', { label: string; tone: 'warning' | 'info' | 'accent' }> = {
  pickup: { label: 'En collecte', tone: 'warning' },
  delivery: { label: 'En livraison', tone: 'info' },
  handover: { label: 'Remise du colis', tone: 'accent' },
};

export function ActiveMissionCard({ order, pickup, stage, onOpen }: { order: Order; pickup: string; stage: 'pickup' | 'delivery' | 'handover'; onOpen: () => void }) {
  const entering = useEnter(0);
  const chip = STAGE_CHIP[stage];
  return (
    <Animated.View entering={entering} style={[styles.card, elevation[1]]}>
      <MissionHead order={order} label="Mission en cours" labelColor={color.text.accent} />
      <RouteStops order={order} pickup={pickup} />
      <View style={styles.chips}>
        <Chip icon={stage === 'pickup' ? Store : Package} label={chip.label} tone={chip.tone} />
        <CashChip order={order} />
      </View>
      <Button label="Ouvrir la mission" trailingIcon={ArrowRight} size="M" haptic="medium" onPress={onOpen} fill />
    </Animated.View>
  );
}

/** L13 "Ensuite": next accepted mission, or a proposal in the list. */
export function MissionRow({ order, caption, onPress }: { order: Order; caption: string; onPress: () => void }) {
  return (
    <PressableScale accessibilityRole="link" onPress={onPress} haptic="selection" scaleTo={pressScale.card} style={styles.row}>
      <View style={styles.rowIcon}>
        <Package size={20} color={color.icon.primary} strokeWidth={2} />
      </View>
      <View style={styles.flex}>
        <Text variant="labelL" numberOfLines={2}>
          #{order.mission!.id} · {routeLabel(order)}
        </Text>
        <Text variant="bodyS" color={color.text.secondary} numberOfLines={1}>
          {caption}
        </Text>
      </View>
      <Text variant="labelM">{formatFC(missionPay(order))}</Text>
    </PressableScale>
  );
}

/* ---------- History row (L11, Historique) ---------- */

export function HistoryRow({ order, onPress }: { order: Order; onPress?: () => void }) {
  const ok = order.delivery === 'delivered';
  const at = finishedAt(order);
  const when = at ? `${formatDay(at)} ${formatTime(at)}` : '';
  const what = ok ? 'Livrée' : `Échec, ${order.incident ? incidentLabel(order.incident.reason).short : 'non livrée'}`;
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`Mission ${order.mission!.id}, ${routeLabel(order)}, ${what}, ${formatFC(missionPay(order))}`}
      onPress={onPress}
      disabled={!onPress}
      haptic="selection"
      scaleTo={pressScale.card}
      style={styles.history}
    >
      <View style={[styles.rowIcon, { borderRadius: 20 }]}>
        {ok ? <CircleCheck size={20} color={color.icon.primary} strokeWidth={2} /> : <CircleX size={20} color={color.icon.primary} strokeWidth={2} />}
      </View>
      <View style={styles.flex}>
        <Text variant="labelL" numberOfLines={2}>
          #{order.mission!.id} · {routeLabel(order)}
        </Text>
        <Text variant="bodyS" color={ok ? color.text.secondary : color.text.danger} numberOfLines={2}>
          {when} · {what}
        </Text>
      </View>
      <Text variant="labelM">{formatFC(missionPay(order))}</Text>
    </PressableScale>
  );
}

/* ---------- Code input (L5 code de remise, L7 code de réception) ---------- */

export function CodeInput({
  length,
  value,
  onChange,
  kind,
  error = false,
  label,
  autoFocus = false,
}: {
  length: number;
  value: string;
  onChange: (v: string) => void;
  /** "alnum": one letter + digits (seller's pick-up code); "digits": buyer's receipt code. */
  kind: 'alnum' | 'digits';
  error?: boolean;
  label: string;
  autoFocus?: boolean;
}) {
  const ref = useRef<ComponentRef<typeof TextInput>>(null);
  const autoFocusNow = useDeferredAutoFocus(ref, autoFocus);
  const [focused, setFocused] = useState(false);
  const reduced = useReducedMotion();
  const shake = useSharedValue(0);
  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }] }));
  useEffect(() => {
    if (error && !reduced) shake.set(withSequence(withTiming(-8, { duration: 50 }), withTiming(8, { duration: 50 }), withTiming(-5, { duration: 50 }), withTiming(0, { duration: 50 })));
  }, [error, reduced, shake]);
  const active = Math.min(value.length, length - 1);
  return (
    <Pressable onPress={() => refocus(ref.current)} accessible={false}>
      <Animated.View style={[styles.code, shakeStyle]}>
        {Array.from({ length }, (_, i) => {
          const c = value[i];
          const isActive = focused && i === active && value.length < length;
          return (
            <View key={i} style={[styles.cell, c ? styles.cellFilled : styles.cellEmpty, isActive && styles.cellActive, error && styles.cellError]}>
              {c ? (
                <Text variant="h2" color={error ? color.text.danger : color.text.primary}>
                  {c}
                </Text>
              ) : isActive ? (
                <View style={styles.caret} />
              ) : null}
            </View>
          );
        })}
      </Animated.View>
      <TextInput
        ref={ref}
        value={value}
        onChangeText={(t) => onChange((kind === 'digits' ? t.replace(/\D/g, '') : t.toUpperCase().replace(/[^A-Z0-9]/g, '')).slice(0, length))}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        autoFocus={autoFocusNow}
        autoCapitalize="characters"
        autoCorrect={false}
        keyboardType={kind === 'digits' ? 'number-pad' : 'default'}
        inputMode={kind === 'digits' ? 'numeric' : 'text'}
        maxLength={length}
        caretHidden
        accessibilityLabel={label}
        style={[StyleSheet.absoluteFill, styles.hidden, noWebOutline]}
      />
    </Pressable>
  );
}

/* ---------- Multi-select (L1 · Zone de travail) ---------- */

export function MultiSelectField({ label, values, options, onChange, icon: Icon = MapPin, error }: { label: string; values: string[]; options: string[]; onChange: (v: string[]) => void; icon?: LucideIcon; error?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={{ gap: space.xs }}>
      <Text variant="labelM">{label}</Text>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={`${label} : ${values.length ? values.join(', ') : 'aucune commune'}`}
        onPress={() => setOpen(true)}
        haptic="selection"
        scaleTo={pressScale.card}
        style={[styles.select, error ? { borderColor: color.text.danger, borderWidth: 1.5 } : null]}
      >
        <Icon size={20} color={color.icon.secondary} strokeWidth={2} />
        <Text variant="bodyL" color={values.length ? color.text.primary : color.text.tertiary} style={styles.flex} numberOfLines={1}>
          {values.length ? values.join(', ') : 'Choisis tes communes'}
        </Text>
        <ChevronDown size={20} color={color.icon.secondary} strokeWidth={2} />
      </PressableScale>
      {error ? (
        <Text variant="bodyS" color={color.text.danger}>
          {error}
        </Text>
      ) : null}
      <Sheet visible={open} onClose={() => setOpen(false)} title={label} footer={<Button label={values.length ? `Valider (${values.length})` : 'Valider'} onPress={() => setOpen(false)} style={styles.flex} />}>
        <ScrollView style={{ maxHeight: 380 }}>
          {options.map((o) => {
            const on = values.includes(o);
            return (
              <PressableScale
                key={o}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                onPress={() => onChange(on ? values.filter((v) => v !== o) : [...values, o])}
                haptic="selection"
                scaleTo={pressScale.card}
                style={styles.option}
              >
                <Text variant="labelL" style={styles.flex}>
                  {o}
                </Text>
                <View style={[styles.box, on ? styles.boxOn : styles.boxOff]}>{on ? <Check size={16} color={color.icon.inverse} strokeWidth={3} /> : null}</View>
              </PressableScale>
            );
          })}
        </ScrollView>
      </Sheet>
    </View>
  );
}

/* ---------- Section header with link ---------- */

export function SectionHead({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <View style={styles.between}>
      <Text variant="h4" accessibilityRole="header">
        {title}
      </Text>
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  overline: { letterSpacing: 0.6 },
  availability: { flexDirection: 'row', alignItems: 'center', gap: space.md, borderRadius: radius.lg, padding: space.lg },
  availableOn: { backgroundColor: color.bg.successSubtle },
  availableOff: { backgroundColor: color.bg.surface, borderWidth: 1, borderColor: color.border.subtle },
  chip: { flexDirection: 'row', alignItems: 'center', gap: space.xs, alignSelf: 'flex-start', maxWidth: '100%', borderRadius: radius.full, paddingHorizontal: space.sm, paddingVertical: space.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  stop: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  stopIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  card: { backgroundColor: color.bg.surface, borderRadius: radius.lg, padding: space.lg, gap: space.lg },
  proposal: { borderWidth: 2, borderColor: color.border.accent, padding: space.lg - 1 },
  actions: { flexDirection: 'row', gap: space.md },
  decline: { minWidth: 110 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: color.bg.surface, borderRadius: radius.lg, padding: space.lg },
  rowIcon: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: color.bg.surfaceSunken, alignItems: 'center', justifyContent: 'center' },
  history: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md },
  code: { flexDirection: 'row', justifyContent: 'center', gap: space.md },
  cell: { width: 52, height: 60, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  cellEmpty: { backgroundColor: color.bg.surfaceSunken, borderWidth: 1, borderColor: color.border.subtle },
  cellFilled: { backgroundColor: color.bg.surface, borderWidth: 1, borderColor: color.border.default },
  cellActive: { backgroundColor: color.bg.surface, borderWidth: 1.5, borderColor: color.border.focus },
  cellError: { backgroundColor: color.bg.surface, borderWidth: 1.5, borderColor: color.text.danger },
  caret: { width: 2, height: 24, borderRadius: 1, backgroundColor: color.bg.accent },
  hidden: { opacity: 0.01, color: 'transparent' },
  select: {
    height: 52,
    borderRadius: radius.md,
    backgroundColor: color.bg.surfaceMuted,
    borderWidth: 1,
    borderColor: color.border.subtle,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.lg,
    gap: space.sm,
  },
  option: { flexDirection: 'row', alignItems: 'center', minHeight: 48 },
  box: { width: 24, height: 24, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  boxOn: { backgroundColor: color.bg.inverse },
  boxOff: { borderWidth: 1.5, borderColor: color.border.strong, backgroundColor: color.bg.surface },
});
