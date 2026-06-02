/**
 * Stalkr Design System — single source of truth for all visual tokens.
 * Tactical glass aesthetic: near-black, #4ADE80 green, #60A5FA blue.
 */

export const C = {
  // ── Brand colours
  green:        '#4ADE80',
  greenDim:     'rgba(74,222,128,0.15)',
  greenBorder:  'rgba(74,222,128,0.35)',
  greenGlow:    'rgba(74,222,128,0.25)',

  blue:         '#60A5FA',
  blueDim:      'rgba(96,165,250,0.15)',
  blueBorder:   'rgba(96,165,250,0.35)',

  red:          '#EF4444',
  redDim:       'rgba(239,68,68,0.15)',
  redBorder:    'rgba(239,68,68,0.4)',

  amber:        '#F59E0B',
  amberDim:     'rgba(245,158,11,0.15)',

  // ── Neutrals
  bg:           '#080808',
  surface:      'rgba(255,255,255,0.05)',
  surfaceHover: 'rgba(255,255,255,0.08)',
  border:       'rgba(255,255,255,0.12)',
  borderFaint:  'rgba(255,255,255,0.07)',

  // ── Text
  textPrimary:  '#FFFFFF',
  textSub:      'rgba(255,255,255,0.6)',
  textMuted:    'rgba(255,255,255,0.35)',
  textGreen:    '#4ADE80',

  // ── Glass card (used with BlurView or plain bg)
  glass:        'rgba(12,12,18,0.92)',
  glassBorder:  'rgba(255,255,255,0.14)',
} as const;

export const R = {
  xs:  8,
  sm:  12,
  md:  16,
  lg:  22,
  xl:  28,
  pill: 999,
} as const;

export const T = {
  // Labels — ALL CAPS, letter-spaced
  micro:   { fontSize: 9,  fontWeight: '900' as const, letterSpacing: 1.4 },
  label:   { fontSize: 10, fontWeight: '900' as const, letterSpacing: 1.4 },
  caption: { fontSize: 11, fontWeight: '800' as const, letterSpacing: 1 },
  body:    { fontSize: 13, fontWeight: '600' as const, letterSpacing: 0.3 },
  subhead: { fontSize: 15, fontWeight: '800' as const, letterSpacing: 0.5 },
  title:   { fontSize: 18, fontWeight: '900' as const, letterSpacing: 0.8 },
  hero:    { fontSize: 22, fontWeight: '900' as const, letterSpacing: 0.5 },
} as const;

/** Glass card style — applies to View */
export const glassCard = {
  backgroundColor: C.glass,
  borderWidth: 1,
  borderColor: C.glassBorder,
  borderRadius: R.lg,
} as const;

/** Pill button base */
export const pillBase = {
  borderRadius: R.pill,
  paddingHorizontal: 16,
  paddingVertical: 11,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
};
