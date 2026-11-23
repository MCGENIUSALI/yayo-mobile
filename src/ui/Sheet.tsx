import { X } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, SlideInDown, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { duration, pressScale, spring } from '@/theme/motion';
import { color, space } from '@/theme/tokens';
import { PressableScale } from './Pressable';
import { Text } from './Text';

/**
 * Bottom sheet (Figma B3 · Filtres, SC2 · Achat rapide): dimmed backdrop that
 * closes on tap, grabber, title + close button, optional sticky footer.
 * Slides in with the sheet spring; appears instantly with reduced motion.
 */
export function Sheet({
  visible,
  onClose,
  title,
  children,
  footer,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      {visible ? (
        <SheetBody title={title} onClose={onClose} footer={footer}>
          {children}
        </SheetBody>
      ) : null}
    </Modal>
  );
}

function SheetBody({ title, onClose, footer, children }: { title: string; onClose: () => void; footer?: ReactNode; children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  return (
    <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Animated.View entering={reduced ? undefined : FadeIn.duration(duration.base)} style={StyleSheet.absoluteFill}>
        <Pressable accessibilityLabel="Fermer" onPress={onClose} style={[StyleSheet.absoluteFill, styles.backdrop]} />
      </Animated.View>
      <Animated.View
        entering={reduced ? undefined : SlideInDown.springify().damping(spring.sheet.damping).stiffness(spring.sheet.stiffness)}
        style={[styles.sheet, { paddingBottom: footer ? 0 : insets.bottom + space.lg }]}
        accessibilityViewIsModal
      >
        <View style={styles.grabber} />
        <View style={styles.header}>
          <Text variant="h3" accessibilityRole="header">
            {title}
          </Text>
          <PressableScale accessibilityLabel="Fermer" onPress={onClose} scaleTo={pressScale.icon} hitSlop={10} style={styles.close}>
            <X size={24} color={color.icon.primary} strokeWidth={2} />
          </PressableScale>
        </View>
        <View style={styles.body}>{children}</View>
        {footer ? <View style={[styles.footer, { paddingBottom: insets.bottom + space.lg }]}>{footer}</View> : null}
      </Animated.View>
    </KeyboardAvoidingView>
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
    paddingTop: space.sm,
  },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: color.border.default },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.screen,
    paddingTop: space.lg,
    paddingBottom: space.sm,
  },
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
