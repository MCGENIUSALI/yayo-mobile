import type { LucideIcon } from 'lucide-react-native';
import { ActivityIndicator, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { color, radius, space } from '@/theme/tokens';
import { PressableScale, type HapticKind } from './Pressable';
import { Text } from './Text';

export type ButtonVariant = 'primary' | 'accent' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'destructive';
export type ButtonSize = 'L' | 'M' | 'S';

export interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  leadingIcon?: LucideIcon;
  trailingIcon?: LucideIcon;
  loading?: boolean;
  disabled?: boolean;
  /** Fill the available width (Figma: "Mettre en largeur FILL dans les écrans"). */
  fill?: boolean;
  haptic?: HapticKind;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
  testID?: string;
}

const sizes = {
  L: { height: 56, px: space.xl, radius: radius.lg, text: 'labelL', icon: 24 },
  M: { height: 48, px: space.lg, radius: radius.lg, text: 'labelM', icon: 20 },
  S: { height: 36, px: space.md, radius: radius.md, text: 'labelS', icon: 16 },
} as const;

function palette(variant: ButtonVariant, disabled: boolean) {
  if (disabled) return { bg: color.bg.surfaceSunken, fg: color.icon.disabled, border: undefined };
  switch (variant) {
    case 'primary':
      return { bg: color.bg.brand, fg: color.text.inverse, border: undefined };
    case 'accent':
      return { bg: color.bg.accent, fg: color.text.inverse, border: undefined };
    case 'secondary':
      return { bg: color.bg.surfaceSunken, fg: color.text.primary, border: undefined };
    case 'outline':
      return { bg: 'transparent', fg: color.text.primary, border: color.border.strong };
    case 'ghost':
      return { bg: 'transparent', fg: color.text.primary, border: undefined };
    case 'danger':
      return { bg: color.bg.dangerSubtle, fg: color.text.danger, border: undefined };
    case 'destructive':
      // Irreversible action (L9 "Déclarer l’échec"): filled red, white label (4.9:1).
      return { bg: color.text.danger, fg: color.text.inverse, border: undefined };
  }
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'L',
  leadingIcon: Leading,
  trailingIcon: Trailing,
  loading = false,
  disabled = false,
  fill = false,
  haptic = 'light',
  style,
  accessibilityHint,
  testID,
}: ButtonProps) {
  const s = sizes[size];
  const p = palette(variant, disabled);
  const inactive = disabled || loading;
  return (
    <PressableScale
      testID={testID}
      onPress={onPress}
      disabled={inactive}
      haptic={haptic}
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: loading }}
      hitSlop={size === 'S' ? 4 : 0}
      style={[
        styles.base,
        {
          height: s.height,
          paddingHorizontal: s.px,
          borderRadius: s.radius,
          backgroundColor: p.bg,
          borderWidth: p.border ? 1.5 : 0,
          borderColor: p.border,
        },
        fill && styles.fill,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={p.fg} />
      ) : (
        <View style={styles.row}>
          {Leading ? <Leading size={s.icon} color={p.fg} strokeWidth={2} /> : null}
          <Text variant={s.text} color={p.fg} numberOfLines={1}>
            {label}
          </Text>
          {Trailing ? <Trailing size={s.icon} color={p.fg} strokeWidth={2} /> : null}
        </View>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center' },
  fill: { alignSelf: 'stretch' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
});
