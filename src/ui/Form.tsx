import { ChevronDown, type LucideIcon } from 'lucide-react-native';
import { useRef, useState, type ComponentRef, type ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, TextInput, View, type TextInputProps, type TextStyle } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, withSpring, withTiming } from 'react-native-reanimated';
import { duration, pressScale, spring } from '@/theme/motion';
import { color, radius, space, type as typeScale } from '@/theme/tokens';
import { refocus, useDeferredAutoFocus } from './keyboard';
import { PressableScale } from './Pressable';
import { Text } from './Text';

/** react-native-web draws its own focus outline inside the field; the field border shows focus. */
const noWebOutline = (Platform.OS === 'web' ? { outlineStyle: 'none' } : {}) as TextStyle;

/* ---------- Selection Control · Radio (996:308) ---------- */

export function Radio({ checked }: { checked: boolean }) {
  const reduced = useReducedMotion();
  const ring = useAnimatedStyle(() => ({
    borderWidth: reduced ? (checked ? 7 : 1.5) : withSpring(checked ? 7 : 1.5, spring.select),
    borderColor: checked ? color.border.focus : color.border.strong,
  }));
  return <Animated.View style={[styles.radio, ring]} />;
}

/* ---------- Selectable card: Payment Method (1000:489) / Address Card (1000:510) ---------- */

export function SelectCard({
  selected,
  onPress,
  icon: Icon,
  title,
  lines,
  align = 'center',
  accessibilityLabel,
}: {
  selected: boolean;
  onPress: () => void;
  icon: LucideIcon;
  title: string;
  lines: { text: string; tone?: 'secondary' | 'tertiary' }[];
  align?: 'center' | 'start';
  accessibilityLabel?: string;
}) {
  const box = align === 'center' ? { size: 44, icon: 22 } : { size: 40, icon: 20 };
  return (
    <PressableScale
      accessibilityRole="radio"
      accessibilityState={{ selected, checked: selected }}
      accessibilityLabel={accessibilityLabel ?? title}
      onPress={onPress}
      haptic="selection"
      scaleTo={pressScale.card}
      style={[
        styles.selectCard,
        {
          alignItems: align === 'center' ? 'center' : 'flex-start',
          borderWidth: selected ? 2 : 1,
          borderColor: selected ? color.border.focus : color.border.default,
          // Keep content from shifting when the border gets thicker.
          padding: selected ? space.lg - 1 : space.lg,
        },
      ]}
    >
      <View
        style={[
          styles.iconBox,
          {
            width: box.size,
            height: box.size,
            backgroundColor: align === 'start' && selected ? color.bg.accentSubtle : color.bg.surfaceSunken,
          },
        ]}
      >
        <Icon
          size={box.icon}
          strokeWidth={2}
          color={align === 'start' ? (selected ? color.icon.accent : color.icon.secondary) : color.icon.primary}
        />
      </View>
      <View style={styles.flex}>
        <Text variant="labelL">{title}</Text>
        {lines.map((l) => (
          <Text
            key={l.text}
            variant={align === 'start' && l.tone !== 'tertiary' ? 'bodyM' : 'bodyS'}
            color={l.tone === 'tertiary' ? color.text.tertiary : color.text.secondary}
          >
            {l.text}
          </Text>
        ))}
      </View>
      <Radio checked={selected} />
    </PressableScale>
  );
}

/* ---------- Chip (996:321) ---------- */

export function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <PressableScale
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      haptic="selection"
      scaleTo={pressScale.icon}
      style={[
        styles.chip,
        selected
          ? { backgroundColor: color.bg.brand }
          : { backgroundColor: color.bg.surface, borderWidth: 1, borderColor: color.border.default },
      ]}
    >
      <Text variant="labelM" color={selected ? color.text.inverse : color.text.primary}>
        {label}
      </Text>
    </PressableScale>
  );
}

/* ---------- Input (996:246): Text and Phone (+243) ---------- */

export function TextField({
  label,
  prefix,
  error,
  muted = false,
  multiline,
  autoFocus,
  ...input
}: TextInputProps & { label: string; prefix?: 'phone-cd'; error?: string; muted?: boolean }) {
  const ref = useRef<ComponentRef<typeof TextInput>>(null);
  const autoFocusNow = useDeferredAutoFocus(ref, autoFocus);
  const [focused, setFocused] = useState(false);
  const borderColor = error ? color.text.danger : focused ? color.border.focus : muted ? color.border.subtle : color.border.default;
  const phone = prefix === 'phone-cd';
  return (
    <View style={{ gap: space.xs }}>
      <Text variant="labelM">{label}</Text>
      {/* The whole box (prefix, padding) focuses the field: small inputs are hard to hit on Android. */}
      <Pressable
        accessible={false}
        onPress={() => refocus(ref.current)}
        style={[
          styles.field,
          multiline && styles.fieldMultiline,
          {
            borderColor,
            borderWidth: focused || error ? 1.5 : 1,
            // Same box size focused or not: only the colour changes, nothing moves under the finger.
            paddingHorizontal: focused || error ? space.lg - 0.5 : space.lg,
            backgroundColor: muted && !focused ? color.bg.surfaceMuted : color.bg.surface,
          },
          focused && !error ? styles.focusRing : null,
        ]}
      >
        {phone ? (
          <>
            <View style={styles.prefix} accessibilityLabel="Indicatif République démocratique du Congo, plus 243">
              <Text variant="bodyL">🇨🇩</Text>
              <Text variant="labelL">+243</Text>
              <ChevronDown size={16} color={color.icon.secondary} strokeWidth={2} />
            </View>
            <View style={styles.prefixDivider} />
          </>
        ) : null}
        <TextInput
          ref={ref}
          accessibilityLabel={label}
          placeholderTextColor={color.text.tertiary}
          selectionColor={color.bg.accent}
          cursorColor={color.bg.accent}
          keyboardType={phone ? 'phone-pad' : undefined}
          autoComplete={phone ? 'tel-national' : undefined}
          textContentType={phone ? 'telephoneNumber' : undefined}
          multiline={multiline}
          autoFocus={autoFocusNow}
          {...input}
          onFocus={(e) => {
            setFocused(true);
            input.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            input.onBlur?.(e);
          }}
          style={[typeScale.bodyL, styles.input, multiline ? styles.inputMultiline : styles.inputSingle, noWebOutline]}
        />
      </Pressable>
      {error ? (
        <Text variant="bodyS" color={color.text.danger} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

/* ---------- Page Indicator (997:392) + checkout steps ---------- */

function Dot({ active }: { active: boolean }) {
  const reduced = useReducedMotion();
  const style = useAnimatedStyle(() => ({
    width: reduced ? (active ? 24 : 8) : withTiming(active ? 24 : 8, { duration: duration.base }),
    backgroundColor: active ? color.bg.accent : color.border.strong,
  }));
  return <Animated.View style={[styles.dot, style]} />;
}

export function PageIndicator({ count, index }: { count: number; index: number }) {
  return (
    <View style={styles.dots} accessibilityLabel={`Étape ${index + 1} sur ${count}`}>
      {Array.from({ length: count }, (_, i) => (
        <Dot key={i} active={i === index} />
      ))}
    </View>
  );
}

export function CheckoutSteps({ step, label }: { step: 1 | 2 | 3; label: string }) {
  return (
    <View style={styles.steps}>
      <PageIndicator count={3} index={step - 1} />
      <Text variant="labelM" color={color.text.secondary}>
        Étape {step} sur 3 · {label}
      </Text>
    </View>
  );
}

/* ---------- Segmented control (Segment 998:446) ---------- */

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  fit = false,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  /** Size each segment to its label (4 segments on a phone width). */
  fit?: boolean;
}) {
  return (
    <View style={styles.segmented} accessibilityRole="tablist">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <PressableScale
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(o.value)}
            haptic="selection"
            scaleTo={pressScale.card}
            style={[styles.segment, fit && styles.segmentFit, active && styles.segmentActive]}
          >
            <Text variant={active ? 'labelM' : 'bodyM'} color={active ? color.text.primary : color.text.secondary} numberOfLines={1}>
              {o.label}
            </Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={{ gap: space.md }}>
      <Text variant="h4" accessibilityRole="header">
        {title}
      </Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0, gap: 2 },
  radio: { width: 24, height: 24, borderRadius: 12, backgroundColor: color.bg.surface },
  selectCard: {
    flexDirection: 'row',
    gap: space.md,
    borderRadius: radius.lg,
    backgroundColor: color.bg.surface,
    minHeight: 72,
  },
  iconBox: { borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  chip: {
    height: 36,
    paddingHorizontal: space.md,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  field: {
    minHeight: 52,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  fieldMultiline: { alignItems: 'flex-start', paddingVertical: space.md },
  focusRing: {
    // Focus/Accent effect: 3 px orange ring at 25 %.
    shadowColor: color.bg.accent,
    shadowOpacity: 0.25,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    outlineColor: color.focusRing,
    outlineWidth: 3,
    outlineStyle: 'solid',
  },
  prefix: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  prefixDivider: { width: 1, height: 24, backgroundColor: color.border.default },
  input: { flex: 1, color: color.text.primary, paddingVertical: 0, minWidth: 0 },
  // Android: no extra font padding and a vertically centred line, so the text and caret sit inside the 52 px box.
  inputSingle: { height: 50, textAlignVertical: 'center', includeFontPadding: false },
  inputMultiline: { minHeight: 96, textAlignVertical: 'top', includeFontPadding: false },
  dots: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { height: 8, borderRadius: 4 },
  steps: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  segmented: {
    flexDirection: 'row',
    padding: space.xs,
    gap: space.xs,
    borderRadius: radius.full,
    backgroundColor: color.bg.surfaceMuted,
  },
  segment: { flex: 1, height: 36, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  segmentFit: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', paddingHorizontal: space.sm },
  segmentActive: {
    backgroundColor: color.bg.surface,
    shadowColor: '#0a0a0d',
    shadowOpacity: 0.08,
    shadowRadius: 1.5,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
});
