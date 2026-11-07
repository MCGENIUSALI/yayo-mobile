import { X } from 'lucide-react-native';
import { memo, useEffect, useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { easing, pressScale, sheetMotion } from '@/theme/motion';
import { color, space } from '@/theme/tokens';
import { PressableScale } from './Pressable';
import { Text } from './Text';

/**
 * Bottom sheet (Figma B3 · Filtres, SC2 · Achat rapide): dimmed backdrop,
 * grabber, title + close button, optional sticky footer.
 *
 * Motion: one vertical slide (220 ms in, 180 ms out, no bounce) driving the
 * backdrop opacity, so nothing else animates at the same time. Drag the
 * grabber or the title down to close. Android Back closes it. `dismissible`
 * false keeps it open on a backdrop tap or a drag (form that would lose data):
 * the close button and Back still close it.
 */
export function Sheet({
  visible,
  onClose,
  title,
  children,
  footer,
  dismissible = true,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  dismissible?: boolean;
}) {
  const [mounted, setMounted] = useState(visible);
  if (visible && !mounted) setMounted(true);

  return (
    <Modal
      visible={mounted}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
      navigationBarTranslucent
    >
      {mounted ? (
        <SheetBody
          visible={visible}
          title={title}
          onClose={onClose}
          onClosed={() => setMounted(false)}
          footer={footer ? <Frozen visible={visible}>{footer}</Frozen> : undefined}
          dismissible={dismissible}
        >
          <Frozen visible={visible}>{children}</Frozen>
        </SheetBody>
      ) : null}
    </Modal>
  );
}

/** While sliding out, keep showing what was on screen: the caller may already have cleared its data. */
const Frozen = memo(
  function Frozen({ children }: { visible: boolean; children: ReactNode }) {
    return <>{children}</>;
  },
  (_prev, next) => !next.visible,
);

function SheetBody({
  visible,
  title,
  onClose,
  onClosed,
  footer,
  dismissible,
  children,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  onClosed: () => void;
  footer?: ReactNode;
  dismissible: boolean;
  children: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const { height: windowHeight } = useWindowDimensions();
  /** 0 = off screen, 1 = open. */
  const progress = useSharedValue(0);
  const drag = useSharedValue(0);
  const height = useSharedValue(windowHeight);

  useEffect(() => {
    if (visible) {
      drag.set(0);
      progress.set(withTiming(1, { duration: reduced ? 0 : sheetMotion.enter, easing: easing.enter }));
    } else {
      progress.set(
        withTiming(0, { duration: reduced ? 0 : sheetMotion.exit, easing: easing.exit }, (done) => {
          if (done) runOnJS(onClosed)();
        }),
      );
    }
    // onClosed only flips local state in Sheet; it does not need to restart the animation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, reduced]);

  const pan = Gesture.Pan()
    .enabled(dismissible)
    .activeOffsetY(8)
    .failOffsetX([-20, 20])
    .onUpdate((e) => {
      drag.set(Math.max(0, e.translationY));
    })
    .onEnd((e) => {
      if (drag.get() > height.get() * 0.25 || e.velocityY > 900) {
        runOnJS(onClose)();
      } else {
        drag.set(withTiming(0, { duration: sheetMotion.exit, easing: easing.standard }));
      }
    });

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(progress.get(), [0, 1], [height.get(), 0]) + drag.get() }],
  }));
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: progress.get() * interpolate(drag.get(), [0, height.get()], [1, 0], 'clamp'),
  }));

  return (
    <GestureHandlerRootView style={styles.fill}>
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'web' ? undefined : 'padding'}>
        <Animated.View style={[StyleSheet.absoluteFill, backdropStyle]}>
          <Pressable
            accessibilityLabel="Fermer"
            onPress={dismissible ? onClose : undefined}
            style={[StyleSheet.absoluteFill, styles.backdrop]}
          />
        </Animated.View>
        <Animated.View
          onLayout={(e) => height.set(e.nativeEvent.layout.height)}
          style={[styles.sheet, { paddingBottom: footer ? 0 : insets.bottom + space.lg }, sheetStyle]}
          accessibilityViewIsModal
        >
          <GestureDetector gesture={pan}>
            <View collapsable={false}>
              <View style={styles.grabberArea}>
                <View style={styles.grabber} />
              </View>
              <View style={styles.header}>
                <Text variant="h3" accessibilityRole="header" style={styles.title}>
                  {title}
                </Text>
                <PressableScale accessibilityLabel="Fermer" onPress={onClose} scaleTo={pressScale.icon} hitSlop={10} style={styles.close}>
                  <X size={24} color={color.icon.primary} strokeWidth={2} />
                </PressableScale>
              </View>
            </View>
          </GestureDetector>
          <View style={styles.body}>{children}</View>
          {footer ? <View style={[styles.footer, { paddingBottom: insets.bottom + space.lg }]}>{footer}</View> : null}
        </Animated.View>
      </KeyboardAvoidingView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { backgroundColor: 'rgba(10,10,11,0.5)' },
  sheet: {
    maxHeight: '92%',
    backgroundColor: color.bg.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  grabberArea: { paddingTop: space.sm, paddingBottom: space.xs, alignItems: 'center' },
  grabber: { width: 40, height: 4, borderRadius: 2, backgroundColor: color.border.default },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
    paddingHorizontal: space.screen,
    paddingTop: space.md,
    paddingBottom: space.sm,
  },
  title: { flex: 1 },
  close: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  body: { flexShrink: 1, paddingHorizontal: space.screen, gap: space.lg },
  footer: {
    flexDirection: 'row',
    gap: space.md,
    paddingHorizontal: space.screen,
    paddingTop: space.lg,
    marginTop: space.lg,
    borderTopWidth: 1,
    borderTopColor: color.border.subtle,
  },
});
