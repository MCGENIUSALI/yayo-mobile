import { Check, CircleAlert, Clock, Info, Lock, type LucideIcon } from 'lucide-react-native';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp, FadeOutUp, ZoomIn, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { duration } from '@/theme/motion';
import { color, elevation, radius, space } from '@/theme/tokens';
import { Text } from './Text';

/* ---------- Alert (997:346) ---------- */

const alertTones = {
  info: { bg: color.bg.infoSubtle, title: color.text.info, body: color.text.secondary, icon: color.icon.info, Icon: Info },
  danger: { bg: color.bg.dangerSubtle, title: color.text.danger, body: color.text.secondary, icon: color.icon.danger, Icon: CircleAlert },
  warning: { bg: color.bg.warningSubtle, title: color.text.warning, body: color.text.secondary, icon: color.icon.warning, Icon: CircleAlert },
  escrow: { bg: color.bg.inverse, title: color.text.inverse, body: color.text.inverse, icon: color.icon.success, Icon: Info },
} as const;

export function Alert({
  tone,
  title,
  body,
  icon,
}: {
  tone: keyof typeof alertTones;
  title: string;
  body?: string;
  icon?: LucideIcon;
}) {
  const t = alertTones[tone];
  const Icon = icon ?? t.Icon;
  return (
    <View style={[styles.alert, { backgroundColor: t.bg }]} accessibilityRole="alert">
      <Icon size={20} color={t.icon} strokeWidth={2} />
      <View style={styles.flex}>
        <Text variant="labelM" color={t.title}>
          {title}
        </Text>
        {body ? (
          <Text variant="bodyS" color={t.body} style={tone === 'escrow' ? { opacity: 0.8 } : null}>
            {body}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

/* ---------- Hero icon (112 px circle on C4 / C5 / C6) ---------- */

export function HeroIcon({ icon: Icon, bg, fg, animate = true }: { icon: LucideIcon; bg: string; fg: string; animate?: boolean }) {
  const reduced = useReducedMotion();
  return (
    <Animated.View
      entering={animate && !reduced ? ZoomIn.springify().damping(14).stiffness(180) : undefined}
      style={[styles.hero, { backgroundColor: bg }]}
    >
      <Icon size={50.4} color={fg} strokeWidth={2} />
    </Animated.View>
  );
}

/* ---------- Timeline Step (1002:546) ---------- */

export type TimelineState = 'done' | 'current' | 'upcoming';

export function TimelineStep({
  title,
  description,
  state,
  icon: Icon,
  last = false,
}: {
  title: string;
  description: string;
  state: TimelineState;
  icon: LucideIcon;
  last?: boolean;
}) {
  const dotBg = state === 'done' ? color.bg.success : state === 'current' ? color.bg.accent : color.bg.surfaceSunken;
  const iconColor = state === 'upcoming' ? color.icon.secondary : color.icon.inverse;
  const StepIcon = state === 'done' ? Check : Icon;
  return (
    <View
      style={styles.step}
      accessible
      accessibilityLabel={`${title}, ${state === 'done' ? 'terminé' : state === 'current' ? 'en cours' : 'à venir'}. ${description}`}
    >
      <View style={styles.indicator}>
        <View style={[styles.stepDot, { backgroundColor: dotBg }]}>
          <StepIcon size={16} color={iconColor} strokeWidth={2} />
        </View>
        {!last ? (
          <View style={[styles.connector, { backgroundColor: state === 'done' ? color.border.success : color.border.default }]} />
        ) : null}
      </View>
      <View style={[styles.flex, { paddingBottom: space.xl }]}>
        <Text variant="labelM" color={state === 'upcoming' ? color.text.tertiary : color.text.primary}>
          {title}
        </Text>
        <Text variant="bodyS" color={color.text.secondary}>
          {description}
        </Text>
      </View>
    </View>
  );
}

/* ---------- Delivery Code (1002:547) ---------- */

export function DeliveryCode({ code }: { code: string }) {
  return (
    <View style={styles.code}>
      <View style={styles.inline}>
        <Lock size={18} color={color.icon.accent} strokeWidth={2} />
        <Text variant="labelM" color={color.text.accent}>
          Code de réception
        </Text>
      </View>
      <View style={styles.digits} accessible accessibilityLabel={`Code de réception : ${code.split('').join(' ')}`}>
        {code.split('').map((d, i) => (
          <View key={i} style={styles.digit}>
            <Text variant="code">{d}</Text>
          </View>
        ))}
      </View>
      <Text variant="bodyS" color={color.text.secondary} align="center">
        Donne ce code au livreur seulement quand tu as vérifié ton colis. Il déclenche le paiement au vendeur.
      </Text>
    </View>
  );
}

/* ---------- Countdown ---------- */

export function useCountdown(untilIso?: string) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!untilIso) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [untilIso]);
  const ms = untilIso ? Math.max(0, new Date(untilIso).getTime() - now) : 0;
  const s = Math.ceil(ms / 1000);
  return { ms, label: `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}` };
}

export function TimerPill({ label }: { label: string }) {
  return (
    <View style={styles.timer}>
      <Clock size={18} color={color.icon.secondary} strokeWidth={2} />
      <Text variant="labelM">{label}</Text>
    </View>
  );
}

/* ---------- Toasts ---------- */

type Toast = { id: number; message: string; tone: 'neutral' | 'danger' | 'success' };
const ToastContext = createContext<(message: string, tone?: Toast['tone']) => void>(() => undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();

  const show = useCallback((message: string, tone: Toast['tone'] = 'neutral') => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ id: Date.now(), message, tone });
    timer.current = setTimeout(() => setToast(null), 2600);
  }, []);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const value = useMemo(() => show, [show]);
  return (
    <ToastContext.Provider value={value}>
      {children}
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { paddingTop: insets.top + space.sm }]}>
        {toast ? (
          <Animated.View
            key={toast.id}
            entering={reduced ? undefined : FadeInUp.duration(duration.base)}
            exiting={reduced ? undefined : FadeOutUp.duration(duration.fast)}
            style={[styles.toast, toast.tone === 'danger' && { backgroundColor: color.text.danger }]}
            accessibilityLiveRegion="polite"
            accessibilityRole="alert"
          >
            {toast.tone === 'success' ? <Check size={18} color={color.icon.success} strokeWidth={2.5} /> : null}
            <Text variant="labelM" color={color.text.inverse} style={styles.flex}>
              {toast.message}
            </Text>
          </Animated.View>
        ) : null}
      </View>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);

/** Standard list-item entrance: short fade/slide, staggered, skipped with reduced motion. */
export function useEnter(index = 0) {
  const reduced = useReducedMotion();
  return reduced ? undefined : FadeInDown.duration(duration.base).delay(Math.min(index, 6) * 40);
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0, gap: space['2xs'] },
  inline: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  alert: {
    flexDirection: 'row',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderRadius: radius.md,
    alignSelf: 'stretch',
  },
  hero: { width: 112, height: 112, borderRadius: 56, alignItems: 'center', justifyContent: 'center' },
  step: { flexDirection: 'row', gap: space.md },
  indicator: { alignItems: 'center', gap: space.xs },
  stepDot: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  connector: { width: 2, flex: 1, minHeight: 8 },
  code: {
    backgroundColor: color.bg.accentSubtle,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: color.border.accent,
    borderRadius: radius.lg,
    padding: space.xl,
    gap: space.md,
    alignItems: 'center',
  },
  digits: { flexDirection: 'row', gap: 10 },
  digit: {
    width: 52,
    height: 60,
    borderRadius: radius.md,
    backgroundColor: color.bg.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderRadius: radius.full,
    backgroundColor: color.bg.surface,
  },
  toast: {
    marginHorizontal: space.screen,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: color.bg.inverse,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    ...elevation[2],
  },
});
