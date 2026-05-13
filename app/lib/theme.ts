// Lume design language — minimal, luxe. Apple Fitness x Nike.
export const colors = {
  bg: '#0A0A0A',
  surface: '#141416',
  surfaceElevated: '#1C1C1F',
  hairline: 'rgba(255,255,255,0.08)',
  text: '#F5F5F7',
  textDim: 'rgba(245,245,247,0.56)',
  textFaint: 'rgba(245,245,247,0.32)',
  accent: '#D7FF1E',     // volt
  accentInk: '#0A0A0A',  // text on accent
  danger: '#FF453A',
  protein: '#F5F5F7',
  carbs: '#9A9AA0',
  fat: '#5A5A60',
} as const;

export const space = {
  xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48,
} as const;

export const radius = {
  sm: 8, md: 16, lg: 24, pill: 999,
} as const;

export const type = {
  hero: { fontSize: 88, fontWeight: '600' as const, letterSpacing: -3 },
  display: { fontSize: 44, fontWeight: '600' as const, letterSpacing: -1.2 },
  title: { fontSize: 22, fontWeight: '600' as const, letterSpacing: -0.4 },
  body: { fontSize: 16, fontWeight: '400' as const, letterSpacing: -0.1 },
  label: { fontSize: 10, fontWeight: '600' as const, letterSpacing: 1.5, textTransform: 'uppercase' as const },
  mono: { fontSize: 13, fontWeight: '500' as const, letterSpacing: 0 },
};

export const motion = {
  spring: { damping: 18, stiffness: 220, mass: 0.9 },
  fast: 180,
  base: 260,
};
