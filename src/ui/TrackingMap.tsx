import { Bike, MapPin, Store } from 'lucide-react-native';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Path, Rect } from 'react-native-svg';
import type { DeliveryStatus } from '@/domain/types';
import { duration, easing } from '@/theme/motion';
import { color, elevation, radius } from '@/theme/tokens';

const H = 280;
const W = 402; // Figma frame width; the drawing scales with the screen.

/** Courier progress along the route, per delivery status. */
const progressFor: Record<DeliveryStatus, number> = {
  unassigned: 0,
  assigned: 0,
  picking_up: 0,
  delivering: 0.5,
  delivered: 1,
  failed: 0.5,
};

// Route from pickup (70,220) to drop-off (330,70), as in the Figma placeholder.
const ROUTE = 'M70 220 C 120 200, 140 170, 200 140 S 290 100, 330 70';
const point = (t: number) => {
  // Linear interpolation between the 3 anchor points is close enough for the marker.
  const pts: [number, number][] = [
    [70, 220],
    [200, 140],
    [330, 70],
  ];
  const seg = t < 0.5 ? 0 : 1;
  const local = t < 0.5 ? t / 0.5 : (t - 0.5) / 0.5;
  const [a, b] = [pts[seg]!, pts[seg + 1]!];
  return { x: a[0] + (b[0] - a[0]) * local, y: a[1] + (b[1] - a[1]) * local };
};

/**
 * Tracking map placeholder (Figma "Map" 1002:694: "Placeholder : remplacer par
 * la carte du SDK"). Shows pickup, drop-off and the courier moving with the
 * delivery status.
 */
export function TrackingMap({ status, width }: { status: DeliveryStatus; width: number }) {
  const reduced = useReducedMotion();
  const scale = width / W;
  const t = useSharedValue(progressFor[status]);
  useEffect(() => {
    t.set(reduced ? progressFor[status] : withTiming(progressFor[status], { duration: duration.slow * 2, easing: easing.standard }));
  }, [status, reduced, t]);
  const courier = useAnimatedStyle(() => {
    const v = t.value;
    const seg = v < 0.5 ? 0 : 1;
    const local = v < 0.5 ? v / 0.5 : (v - 0.5) / 0.5;
    const ax = seg === 0 ? 70 : 200;
    const ay = seg === 0 ? 220 : 140;
    const bx = seg === 0 ? 200 : 330;
    const by = seg === 0 ? 140 : 70;
    return {
      transform: [{ translateX: (ax + (bx - ax) * local) * scale - 18 }, { translateY: (ay + (by - ay) * local) * scale - 18 }],
    };
  });
  const showCourier = status !== 'unassigned';
  const start = point(0);
  const end = point(1);
  return (
    <View style={[styles.map, { height: H * scale }]} accessibilityLabel="Carte du trajet du livreur" accessibilityRole="image">
      <Svg width={width} height={H * scale} viewBox={`0 0 ${W} ${H}`}>
        <Rect width={W} height={H} fill={color.bg.surfaceSunken} />
        {/* Streets */}
        <Path d="M-10 60 L420 20" stroke="#fff" strokeWidth={14} />
        <Path d="M-10 170 L420 120" stroke="#fff" strokeWidth={12} />
        <Path d="M-10 250 L420 230" stroke="#fff" strokeWidth={10} />
        <Path d="M90 -10 L130 290" stroke="#fff" strokeWidth={10} />
        <Path d="M250 -10 L230 290" stroke="#fff" strokeWidth={12} />
        <Path d="M350 -10 L380 290" stroke="#fff" strokeWidth={8} />
        <Path d={ROUTE} stroke={color.bg.accent} strokeWidth={4} fill="none" strokeLinecap="round" />
      </Svg>
      <View style={[styles.pin, { backgroundColor: color.bg.inverse, left: start.x * scale - 16, top: start.y * scale - 16 }]}>
        <Store size={16} color={color.icon.inverse} strokeWidth={2} />
      </View>
      <View style={[styles.pin, { backgroundColor: color.bg.accent, left: end.x * scale - 16, top: end.y * scale - 16 }]}>
        <MapPin size={16} color={color.icon.inverse} strokeWidth={2} />
      </View>
      {showCourier ? (
        <Animated.View style={[styles.courier, courier]}>
          <Bike size={16} color={color.icon.accent} strokeWidth={2} />
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  map: { overflow: 'hidden', backgroundColor: color.bg.surfaceSunken },
  pin: { position: 'absolute', width: 32, height: 32, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  courier: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: color.bg.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...elevation[2],
  },
});
