/**
 * YA YO design tokens, copied 1:1 from the Figma variables of
 * "marketplace-YAYO" (collection `yy-*`, page 07_App_Mobile_User_Stories).
 * Never hardcode a colour, radius or spacing in a screen: import from here.
 */

export const color = {
  text: {
    primary: '#0a0a0b',
    secondary: '#56565d',
    tertiary: '#76767e',
    inverse: '#ffffff',
    accent: '#db6200',
    success: '#007a64',
    info: '#12519a',
    warning: '#a36d00',
    danger: '#c42a23',
  },
  bg: {
    canvas: '#fafafa',
    surface: '#ffffff',
    surfaceMuted: '#f5f5f6',
    surfaceSunken: '#eeeef0',
    brand: '#0a0a0b',
    inverse: '#0a0a0b',
    accent: '#fb7800',
    accentSubtle: '#fff4e6',
    success: '#00957a',
    successSubtle: '#e6f7f3',
    info: '#1f7ae0',
    infoSubtle: '#eaf3ff',
    warningSubtle: '#fff8e1',
    dangerSubtle: '#feecec',
  },
  border: {
    subtle: '#eeeef0',
    default: '#e2e2e5',
    strong: '#c9c9ce',
    focus: '#0a0a0b',
    accent: '#fb7800',
    success: '#00957a',
  },
  icon: {
    primary: '#0a0a0b',
    secondary: '#76767e',
    disabled: '#a1a1a8',
    inverse: '#ffffff',
    accent: '#fb7800',
    success: '#00957a',
    info: '#1f7ae0',
    warning: '#f5a400',
    danger: '#e5372f',
  },
  /** Focus/Accent effect: 3 px ring, #FB7800 at 25 %. */
  focusRing: 'rgba(251,120,0,0.25)',
} as const;

export const space = {
  '2xs': 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  /** Screen horizontal padding used by every content area in Figma. */
  screen: 24,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  full: 999,
} as const;

/** Elevation/1 and Elevation/2 (two drop shadows in Figma, approximated by one native shadow + Android elevation). */
export const elevation = {
  1: {
    shadowColor: '#0a0a0d',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 1,
  },
  2: {
    shadowColor: '#0a0a0d',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
} as const;

export const font = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
} as const;

type TypeStyle = {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  letterSpacing: number;
};

/** Figma letter spacing is in % of the font size. */
const ls = (size: number, percent: number) => (size * percent) / 100;

/** Text styles, named exactly like the Figma text styles. */
export const type = {
  display: { fontFamily: font.bold, fontSize: 32, lineHeight: 40, letterSpacing: ls(32, -1) },
  h1: { fontFamily: font.bold, fontSize: 28, lineHeight: 36, letterSpacing: ls(28, -0.5) },
  h2: { fontFamily: font.bold, fontSize: 24, lineHeight: 32, letterSpacing: ls(24, -0.5) },
  h3: { fontFamily: font.semibold, fontSize: 20, lineHeight: 28, letterSpacing: 0 },
  h4: { fontFamily: font.semibold, fontSize: 18, lineHeight: 24, letterSpacing: 0 },
  bodyL: { fontFamily: font.regular, fontSize: 16, lineHeight: 24, letterSpacing: 0 },
  bodyM: { fontFamily: font.regular, fontSize: 14, lineHeight: 20, letterSpacing: 0 },
  bodyS: { fontFamily: font.regular, fontSize: 12, lineHeight: 16, letterSpacing: 0 },
  labelL: { fontFamily: font.semibold, fontSize: 16, lineHeight: 24, letterSpacing: 0 },
  labelM: { fontFamily: font.semibold, fontSize: 14, lineHeight: 20, letterSpacing: 0 },
  labelS: { fontFamily: font.medium, fontSize: 12, lineHeight: 16, letterSpacing: 0 },
  caption: { fontFamily: font.medium, fontSize: 11, lineHeight: 14, letterSpacing: 0 },
  priceL: { fontFamily: font.bold, fontSize: 24, lineHeight: 32, letterSpacing: ls(24, -0.5) },
  priceM: { fontFamily: font.bold, fontSize: 16, lineHeight: 24, letterSpacing: 0 },
  priceS: { fontFamily: font.bold, fontSize: 14, lineHeight: 20, letterSpacing: 0 },
  priceStrike: { fontFamily: font.regular, fontSize: 12, lineHeight: 16, letterSpacing: 0 },
  code: { fontFamily: font.bold, fontSize: 32, lineHeight: 40, letterSpacing: ls(32, -1) },
} as const satisfies Record<string, TypeStyle>;

export type TypeVariant = keyof typeof type;

/** Minimum touch target (Figma "Icon Button" description: ≥ 44 px). */
export const HIT = 44;
