import type { BottomTabBarProps } from 'expo-router/tabs';
import type { LucideIcon } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { duration } from '@/theme/motion';
import { color, radius, space } from '@/theme/tokens';
import { PressableScale } from './Pressable';
import { Text } from './Text';

export type TabSpec = Record<string, { label: string; icon: LucideIcon }>;

function TabItem({ focused, label, Icon, onPress }: { focused: boolean; label: string; Icon: LucideIcon; onPress: () => void }) {
  const reduced = useReducedMotion();
  const pill = useAnimatedStyle(() => ({
    backgroundColor: color.bg.accentSubtle,
    opacity: reduced ? (focused ? 1 : 0) : withTiming(focused ? 1 : 0, { duration: duration.fast }),
    transform: [{ scaleX: reduced ? 1 : withTiming(focused ? 1 : 0.6, { duration: duration.base }) }],
  }));
  return (
    <PressableScale
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={label}
      onPress={onPress}
      haptic="selection"
      scaleTo={0.94}
      style={styles.item}
    >
      <View style={styles.indicator}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.pill, pill]} />
        {/* Above the pill: on web the transformed pill would otherwise paint over the icon. */}
        <View style={styles.icon}>
          <Icon size={22} strokeWidth={2} color={focused ? color.icon.accent : color.icon.secondary} />
        </View>
      </View>
      <Text variant={focused ? 'labelS' : 'caption'} color={focused ? color.text.primary : color.text.tertiary} numberOfLines={1}>
        {label}
      </Text>
    </PressableScale>
  );
}

/** Bottom Navigation (Figma 998:437), shared by the buyer and seller apps. */
export function BottomNavigation({ state, navigateToTab, tabs }: BottomTabBarProps & { tabs: TabSpec }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingBottom: insets.bottom }]}>
      {state.routes.map((route, index) => {
        const tab = tabs[route.name];
        if (!tab) return null;
        const focused = state.index === index;
        return (
          <TabItem
            key={route.key}
            focused={focused}
            label={tab.label}
            Icon={tab.icon}
            onPress={() => {
              if (!focused) navigateToTab(route.key);
            }}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: space.sm,
    paddingHorizontal: space.sm,
    backgroundColor: color.bg.surface,
    borderTopWidth: 1,
    borderTopColor: color.border.subtle,
  },
  item: { flex: 1, minWidth: 0, height: 56, alignItems: 'center', justifyContent: 'center', gap: space.xs },
  indicator: { width: 52, height: 30, alignItems: 'center', justifyContent: 'center' },
  icon: { zIndex: 1 },
  pill: { borderRadius: radius.full },
});
