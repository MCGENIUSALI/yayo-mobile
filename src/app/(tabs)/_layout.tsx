import { Tabs, type BottomTabBarProps } from 'expo-router/tabs';
import { Bell, House, Package, Search, User, type LucideIcon } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { duration } from '@/theme/motion';
import { color, radius, space } from '@/theme/tokens';
import { PressableScale } from '@/ui/Pressable';
import { Text } from '@/ui/Text';

const TABS: Record<string, { label: string; icon: LucideIcon }> = {
  index: { label: 'Accueil', icon: House },
  explorer: { label: 'Explorer', icon: Search },
  commandes: { label: 'Commandes', icon: Package },
  alertes: { label: 'Alertes', icon: Bell },
  profil: { label: 'Profil', icon: User },
};

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
        <Icon size={22} strokeWidth={2} color={focused ? color.icon.accent : color.icon.secondary} />
      </View>
      <Text variant={focused ? 'labelS' : 'caption'} color={focused ? color.text.primary : color.text.tertiary} numberOfLines={1}>
        {label}
      </Text>
    </PressableScale>
  );
}

/** Bottom Navigation (Figma 998:437) — buyer: Accueil, Explorer, Commandes, Alertes, Profil. */
function BottomNavigation({ state, navigateToTab }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingBottom: insets.bottom }]}>
      {state.routes.map((route, index) => {
        const tab = TABS[route.name];
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

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <BottomNavigation {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: color.bg.canvas }, animation: 'shift' }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="explorer" />
      <Tabs.Screen name="commandes" />
      <Tabs.Screen name="alertes" />
      <Tabs.Screen name="profil" />
    </Tabs>
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
  pill: { borderRadius: radius.full },
});
