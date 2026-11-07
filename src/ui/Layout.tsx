import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color, radius, space } from '@/theme/tokens';

/**
 * Screen background + keyboard handling. Header and bottom bar own their safe areas.
 * Android draws edge-to-edge (SDK 54+), so the window no longer resizes for the
 * keyboard: the screen pads itself on both platforms, which keeps the focused
 * field and the bottom bar buttons above the keyboard.
 */
export function Screen({
  children,
  background = color.bg.canvas,
}: {
  children: ReactNode;
  background?: string;
}) {
  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: background }]}
      behavior={Platform.OS === 'web' ? undefined : 'padding'}
    >
      {children}
    </KeyboardAvoidingView>
  );
}

/** Scrollable content area with the Figma screen padding (24 / 16). */
export function Content({
  children,
  gap = space.lg,
  style,
  topInset = false,
  top = space.lg,
}: {
  children: ReactNode;
  gap?: number;
  style?: StyleProp<ViewStyle>;
  /** Top padding below the header / status bar (Figma: 16 by default, 40–56 on result screens). */
  top?: number;
  /** Add the status-bar inset (screens without a Top App Bar). */
  topInset?: boolean;
}) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[
        styles.content,
        { gap, paddingTop: (topInset ? insets.top : 0) + top },
        style,
      ]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  );
}

/** Sticky bottom bar (Figma "Bottom bar"): border-top, 16/24/8 padding + home-indicator inset. */
export function BottomBar({
  children,
  direction = 'column',
  background = color.bg.surface,
  bordered = true,
}: {
  children: ReactNode;
  direction?: 'row' | 'column';
  background?: string;
  bordered?: boolean;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.bottom,
        {
          flexDirection: direction,
          backgroundColor: background,
          borderTopWidth: bordered ? StyleSheet.hairlineWidth * 2 : 0,
          paddingBottom: Math.max(insets.bottom, space.sm),
          alignItems: direction === 'row' ? 'center' : 'stretch',
          gap: direction === 'row' ? space.screen : space.md,
        },
      ]}
    >
      {children}
    </View>
  );
}

export function Card({ children, style, gap = space.md }: { children: ReactNode; style?: StyleProp<ViewStyle>; gap?: number }) {
  return <View style={[styles.card, { gap }, style]}>{children}</View>;
}

export function Divider() {
  return <View style={styles.divider} />;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: space.screen, paddingBottom: space.screen },
  bottom: {
    borderTopColor: color.border.subtle,
    paddingTop: space.lg,
    paddingHorizontal: space.screen,
  },
  card: {
    backgroundColor: color.bg.surface,
    borderRadius: radius.lg,
    padding: space.lg,
    overflow: 'hidden',
  },
  divider: { height: 1, backgroundColor: color.border.subtle, alignSelf: 'stretch' },
});
