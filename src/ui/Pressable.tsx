import * as Haptics from 'expo-haptics';
import { useCallback } from 'react';
import { Platform, Pressable as RNPressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from 'react-native-reanimated';
import { pressScale, spring } from '@/theme/motion';

const AnimatedPressable = Animated.createAnimatedComponent(RNPressable);

export type HapticKind = 'none' | 'selection' | 'light' | 'medium' | 'success' | 'warning';

export function haptic(kind: HapticKind) {
  if (kind === 'none' || Platform.OS === 'web') return;
  // Fire-and-forget: a device without haptics must never break a press.
  const run = (): Promise<void> => {
    switch (kind) {
      case 'selection':
        return Haptics.selectionAsync();
      case 'light':
        return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      case 'medium':
        return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      case 'success':
        return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      case 'warning':
        return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
  };
  run().catch(() => undefined);
}

export interface PressableScaleProps extends Omit<PressableProps, 'style'> {
  style?: StyleProp<ViewStyle>;
  /** Scale reached while pressed. */
  scaleTo?: number;
  haptic?: HapticKind;
}

/**
 * Touch feedback used by every tappable element: a short native-driven scale
 * (UI thread, no re-render) + optional haptic. Disabled when the OS asks for
 * reduced motion.
 */
export function PressableScale({
  scaleTo = pressScale.button,
  haptic: hapticKind = 'none',
  onPressIn,
  onPressOut,
  onPress,
  style,
  disabled,
  ...rest
}: PressableScaleProps) {
  const reduced = useReducedMotion();
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const handleIn = useCallback<NonNullable<PressableProps['onPressIn']>>(
    (e) => {
      if (!reduced) scale.set(withSpring(scaleTo, spring.press));
      onPressIn?.(e);
    },
    [onPressIn, reduced, scale, scaleTo],
  );
  const handleOut = useCallback<NonNullable<PressableProps['onPressOut']>>(
    (e) => {
      scale.set(withSpring(1, spring.press));
      onPressOut?.(e);
    },
    [onPressOut, scale],
  );
  const handlePress = useCallback<NonNullable<PressableProps['onPress']>>(
    (e) => {
      haptic(hapticKind);
      onPress?.(e);
    },
    [hapticKind, onPress],
  );

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPressIn={handleIn}
      onPressOut={handleOut}
      onPress={handlePress}
      style={[style, animated]}
      {...rest}
    />
  );
}
