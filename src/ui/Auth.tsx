import { Check, ChevronDown, ShieldCheck, type LucideIcon } from 'lucide-react-native';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, TextInput, View, type TextStyle } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OTP_LENGTH } from '@/domain/auth';
import { pressScale } from '@/theme/motion';
import { color, radius, space } from '@/theme/tokens';
import { Radio } from './Form';
import { haptic, PressableScale } from './Pressable';
import { Sheet } from './Sheet';
import { Text } from './Text';

const noWebOutline = (Platform.OS === 'web' ? { outlineStyle: 'none' } : {}) as TextStyle;

/* ---------- Logo "YA YO!" ---------- */

export function Logo({ size = 'M', inverse = false }: { size?: 'M' | 'XL'; inverse?: boolean }) {
  const xl = size === 'XL';
  const fg = inverse ? color.text.inverse : color.text.primary;
  return (
    <View style={styles.logo} accessibilityRole="header" accessibilityLabel="YA YO">
      <Text variant={xl ? 'display' : 'h2'} color={fg} style={xl ? styles.logoXL : undefined}>
        YA
      </Text>
      <View style={[styles.yo, { backgroundColor: inverse ? color.bg.surface : color.bg.inverse }, xl && styles.yoXL]}>
        <Text variant={xl ? 'display' : 'h3'} color={inverse ? color.text.primary : color.text.inverse} style={xl ? styles.logoXL : undefined}>
          YO!
        </Text>
      </View>
    </View>
  );
}

/* ---------- A1 · Splash (boot screen while the session loads) ---------- */

export function Splash() {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.splash, { paddingTop: insets.top, paddingBottom: insets.bottom + space.xl }]}>
      <View style={styles.splashCenter}>
        <Logo size="XL" inverse />
        <Text variant="bodyM" color="rgba(255,255,255,0.72)">
          Vendre mieux, acheter ensemble.
        </Text>
      </View>
      <Text variant="caption" color="rgba(255,255,255,0.56)" align="center">
        Paiement sécurisé · Livraison suivie
      </Text>
    </View>
  );
}

/* ---------- OTP (A6, E8): 6 cells over one hidden input ---------- */

export function OtpInput({
  value,
  onChange,
  error = false,
  disabled = false,
  autoFocus = true,
}: {
  value: string;
  onChange: (v: string) => void;
  error?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
}) {
  const ref = useRef<ComponentRef<typeof TextInput>>(null);
  const [focused, setFocused] = useState(false);
  const reduced = useReducedMotion();
  const shake = useSharedValue(0);
  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }] }));
  useEffect(() => {
    if (error && !reduced) {
      shake.set(withSequence(withTiming(-8, { duration: 50 }), withTiming(8, { duration: 50 }), withTiming(-5, { duration: 50 }), withTiming(0, { duration: 50 })));
    }
  }, [error, reduced, shake]);
  const active = Math.min(value.length, OTP_LENGTH - 1);

  return (
    <Pressable onPress={() => ref.current?.focus()} accessible={false} disabled={disabled}>
      <Animated.View style={[styles.otp, shakeStyle]}>
        {Array.from({ length: OTP_LENGTH }, (_, i) => {
          const digit = value[i];
          const isActive = focused && !disabled && i === active && value.length < OTP_LENGTH;
          return (
            <View
              key={i}
              style={[
                styles.cell,
                digit ? styles.cellFilled : styles.cellEmpty,
                isActive && styles.cellActive,
                error && styles.cellError,
              ]}
            >
              {digit ? (
                <Text variant="h2" color={error ? color.text.danger : color.text.primary}>
                  {digit}
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
        onChangeText={(t) => onChange(t.replace(/\D/g, '').slice(0, OTP_LENGTH))}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        editable={!disabled}
        autoFocus={autoFocus}
        keyboardType="number-pad"
        inputMode="numeric"
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        maxLength={OTP_LENGTH}
        caretHidden
        accessibilityLabel={`Code à ${OTP_LENGTH} chiffres`}
        style={[StyleSheet.absoluteFill, styles.hiddenInput, noWebOutline]}
      />
    </Pressable>
  );
}

/* ---------- Select field (A7 Ville / Commune) ---------- */

export function SelectField({
  label,
  value,
  placeholder,
  options,
  onChange,
  disabled = false,
}: {
  label: string;
  value?: string;
  placeholder: string;
  options: string[];
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <View style={{ gap: space.xs }}>
      <Text variant="labelM">{label}</Text>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={`${label} : ${value ?? 'non choisie'}`}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={() => setOpen(true)}
        haptic="selection"
        scaleTo={pressScale.card}
        style={[styles.select, disabled && { opacity: 0.5 }]}
      >
        <Text variant="bodyL" color={value ? color.text.primary : color.text.tertiary} style={styles.flex}>
          {value ?? placeholder}
        </Text>
        <ChevronDown size={20} color={color.icon.secondary} strokeWidth={2} />
      </PressableScale>
      <Sheet visible={open} onClose={() => setOpen(false)} title={label}>
        <ScrollView style={{ maxHeight: 420 }} accessibilityRole="radiogroup">
          {options.map((o) => (
            <PressableScale
              key={o}
              accessibilityRole="radio"
              accessibilityState={{ checked: o === value }}
              onPress={() => {
                onChange(o);
                setOpen(false);
              }}
              haptic="selection"
              scaleTo={pressScale.card}
              style={styles.option}
            >
              <Text variant="labelL" style={styles.flex}>
                {o}
              </Text>
              {o === value ? <Check size={20} color={color.icon.accent} strokeWidth={2.5} /> : null}
            </PressableScale>
          ))}
        </ScrollView>
      </Sheet>
    </View>
  );
}

/* ---------- Checkbox (Selection Control) ---------- */

export function Checkbox({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <PressableScale
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
      onPress={() => onChange(!checked)}
      haptic="selection"
      scaleTo={pressScale.card}
      style={styles.checkRow}
    >
      <View style={[styles.box, checked ? styles.boxOn : styles.boxOff]}>{checked ? <Check size={16} color={color.icon.inverse} strokeWidth={3} /> : null}</View>
      <Text variant="bodyS" color={color.text.secondary} style={styles.flex}>
        {label}
      </Text>
    </PressableScale>
  );
}

/* ---------- Role card (A8 · Option Card) ---------- */

export function RoleCard({
  icon: Icon,
  title,
  body,
  badge,
  selected,
  onPress,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
  badge?: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <PressableScale
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={`${title}. ${body}${badge ? `. ${badge}` : ''}`}
      onPress={() => {
        haptic('selection');
        onPress();
      }}
      scaleTo={pressScale.card}
      style={[styles.role, selected ? styles.roleOn : styles.roleOff]}
    >
      <View style={[styles.roleIcon, { backgroundColor: selected ? color.bg.accent : color.bg.surfaceSunken }]}>
        <Icon size={24} color={selected ? color.icon.inverse : color.icon.primary} strokeWidth={2} />
      </View>
      <View style={[styles.flex, { gap: space.xs }]}>
        <Text variant="labelL">{title}</Text>
        <Text variant="bodyS" color={color.text.secondary}>
          {body}
        </Text>
        {badge ? (
          <View style={styles.roleBadge}>
            <ShieldCheck size={14} color={color.icon.secondary} strokeWidth={2} />
            <Text variant="caption" color={color.text.secondary}>
              {badge}
            </Text>
          </View>
        ) : null}
      </View>
      <Radio checked={selected} />
    </PressableScale>
  );
}

/* ---------- "ou" divider ---------- */

export function OrDivider() {
  return (
    <View style={styles.or} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={styles.orLine} />
      <Text variant="caption" color={color.text.tertiary}>
        ou
      </Text>
      <View style={styles.orLine} />
    </View>
  );
}

/** Small uppercase step label, e.g. "ÉTAPE 1 SUR 2 · NOUVEAU COMPTE". */
export function StepLabel({ children }: { children: string }) {
  return (
    <Text variant="caption" color={color.text.accent} style={{ letterSpacing: 0.6 }}>
      {children.toUpperCase()}
    </Text>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  logo: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  yo: { borderRadius: radius.sm, paddingHorizontal: 6 },
  yoXL: { borderRadius: radius.md, paddingHorizontal: 10, paddingVertical: 2 },
  logoXL: { fontSize: 44, lineHeight: 52 },
  splash: { flex: 1, backgroundColor: color.bg.inverse, justifyContent: 'space-between' },
  splashCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md },
  otp: { flexDirection: 'row', justifyContent: 'space-between', gap: space.sm },
  cell: { flex: 1, maxWidth: 52, height: 56, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  cellEmpty: { backgroundColor: color.bg.surfaceSunken, borderWidth: 1, borderColor: color.border.subtle },
  cellFilled: { backgroundColor: color.bg.surface, borderWidth: 1, borderColor: color.border.default },
  cellActive: { backgroundColor: color.bg.surface, borderWidth: 1.5, borderColor: color.border.focus },
  cellError: { backgroundColor: color.bg.surface, borderWidth: 1.5, borderColor: color.text.danger },
  caret: { width: 2, height: 24, borderRadius: 1, backgroundColor: color.bg.accent },
  hiddenInput: { opacity: 0.01, color: 'transparent' },
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
  checkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  box: { width: 24, height: 24, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  boxOn: { backgroundColor: color.bg.inverse },
  boxOff: { borderWidth: 1.5, borderColor: color.border.strong, backgroundColor: color.bg.surface },
  role: { flexDirection: 'row', alignItems: 'center', gap: space.md, borderRadius: radius.lg, padding: space.lg },
  roleOn: { backgroundColor: color.bg.accentSubtle, borderWidth: 2, borderColor: color.border.accent, padding: space.lg - 1 },
  roleOff: { backgroundColor: color.bg.surface, borderWidth: 1, borderColor: color.border.default },
  roleIcon: { width: 48, height: 48, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    alignSelf: 'flex-start',
    backgroundColor: color.bg.surfaceSunken,
    borderRadius: radius.sm,
    paddingHorizontal: space.sm,
    paddingVertical: 2,
    marginTop: 2,
  },
  or: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  orLine: { flex: 1, height: StyleSheet.hairlineWidth * 2, backgroundColor: color.border.default },
});

