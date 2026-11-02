import { router } from 'expo-router';
import { ArrowLeft, type LucideIcon } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color, HIT, radius, space } from '@/theme/tokens';
import { pressScale } from '@/theme/motion';
import { PressableScale } from './Pressable';
import { Text } from './Text';

export interface IconButtonProps {
  icon: LucideIcon;
  label: string;
  onPress?: () => void;
  tone?: 'sunken' | 'plain';
}

/** Icon Button (Figma 995:231): 44 × 44 touch target, radius md. */
export function IconButton({ icon: Icon, label, onPress, tone = 'sunken' }: IconButtonProps) {
  return (
    <PressableScale
      accessibilityLabel={label}
      onPress={onPress}
      scaleTo={pressScale.icon}
      haptic="selection"
      style={[styles.iconButton, tone === 'sunken' && { backgroundColor: color.bg.surfaceSunken }]}
    >
      <Icon size={24} color={color.icon.primary} strokeWidth={2} />
    </PressableScale>
  );
}

export interface TopAppBarProps {
  title: string;
  /** Back = secondary screen. Defaults to router.back(). */
  onBack?: () => void;
  action?: IconButtonProps;
  background?: string;
}

/** Top App Bar · Back / Back + Action (Figma 998:243 / 998:264). Owns the top safe area. */
export function TopAppBar({ title, onBack, action, background = color.bg.surface }: TopAppBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ paddingTop: insets.top, backgroundColor: background }}>
      <View style={styles.bar}>
        <IconButton icon={ArrowLeft} label="Retour" onPress={onBack ?? (() => router.back())} />
        <Text variant="h4" numberOfLines={1} style={styles.title} accessibilityRole="header">
          {title}
        </Text>
        {action ? <IconButton {...action} tone="plain" /> : null}
      </View>
    </View>
  );
}

/** Top App Bar · Large title (root screens such as "Mes commandes"). */
export function LargeTitleBar({ title, subtitle }: { title: string; subtitle?: string }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.large, { paddingTop: insets.top + space.lg }]}>
      {subtitle ? (
        <Text variant="bodyM" color={color.text.secondary}>
          {subtitle}
        </Text>
      ) : null}
      <Text variant="h1" accessibilityRole="header">
        {title}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  iconButton: {
    width: HIT,
    height: HIT,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bar: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.xl,
    paddingVertical: space.sm,
  },
  title: { flex: 1 },
  large: {
    backgroundColor: color.bg.surface,
    paddingHorizontal: space.screen,
    paddingBottom: space.md,
    gap: space.xs,
  },
});
