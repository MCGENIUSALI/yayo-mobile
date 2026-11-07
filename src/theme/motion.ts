import { Easing } from 'react-native-reanimated';

/**
 * Motion tokens. Every animation in the app picks its timing here so that
 * presses, sheets, tabs and status changes feel like one system.
 * Reduced motion is honoured by the components (see usePressScale / FadeIn helpers).
 */
export const duration = {
  instant: 90,
  fast: 160,
  base: 240,
  slow: 360,
} as const;

export const easing = {
  standard: Easing.bezier(0.2, 0, 0, 1),
  enter: Easing.bezier(0, 0, 0, 1),
  exit: Easing.bezier(0.3, 0, 1, 1),
} as const;

export const spring = {
  /** Press feedback: quick, no visible overshoot. */
  press: { damping: 22, stiffness: 420, mass: 0.6 },
  /** Selection / toggles: slight settle. */
  select: { damping: 18, stiffness: 260, mass: 0.8 },
} as const;

/** Bottom sheets: one short slide, no bounce (smooth on mid-range Android). */
export const sheetMotion = {
  enter: 220,
  exit: 180,
} as const;

export const pressScale = {
  button: 0.97,
  card: 0.985,
  icon: 0.92,
} as const;

/** Stagger between list items entering the screen. */
export const stagger = 40;
