/**
 * LONI colour system - one palette per scheme. Every screen reads colours through `useTheme()`
 * (context/ThemeContext.tsx) instead of hard-coding hex values, so light/dark/system works everywhere.
 *
 * Dark values come from the design's "observed palette": canvas #0A0D13, surface #0E1017, raised
 * surface #15171B (tip card, bottom navigation), card outline #464646, secondary text #9F9F9F,
 * muted text #6B6B6B. Brand accents (pink, recovery pink, nurse blue, amber, support green) are
 * identical in both schemes - they carry meaning ("one purpose per accent"), so they are NOT themed.
 */

export type ThemePreference = 'light' | 'dark' | 'system';
export type Scheme = 'light' | 'dark';

export interface Palette {
  /** Screen background. */
  bg: string;
  /** Very subtle tint used for inputs and quiet panels. */
  bgSoft: string;
  /** Grouped sections / grey panels sitting on `bg` (profile menu cards, comment panel). */
  surface: string;
  /** Raised cards on `bg` (tip card, list rows). */
  card: string;
  /** White chips / arrow circles that sit *inside* a `surface`. */
  elevated: string;
  /** Hairline dividers. */
  divider: string;
  /** Card and input outlines. */
  border: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  /** Bottom tab bar. */
  nav: string;
  /** Scrim behind modals. */
  overlay: string;
  /** Pale pink tint (selected rows, icon tiles). */
  primarySoft: string;
  danger: string;
  dangerSoft: string;
  /** Rose tint used for notices (privacy warning). */
  roseSoft: string;
  /** Text and outline colours that sit on `dangerSoft`. */
  dangerText: string;
  dangerBorder: string;
  /** Palest pink wash (secondary pink buttons). */
  blush: string;
  /** Disabled state of the primary pink button. */
  primaryDisabled: string;
  successSoft: string;
  /** Skeletons / image placeholders. */
  placeholder: string;
  /** Soft drop shadow colour (nearly invisible on dark). */
  shadow: string;
}

export const LIGHT: Palette = {
  bg: '#FFFFFF',
  bgSoft: '#F8F8F8',
  surface: '#F3F3F3',
  card: '#FFFFFF',
  elevated: '#FFFFFF',
  divider: '#E5E7EB',
  border: '#E5E7EB',
  text: '#000000',
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',
  nav: '#000000',
  overlay: 'rgba(0,0,0,0.35)',
  primarySoft: '#FDEAF4',
  danger: '#EF4444',
  dangerSoft: '#FEE2E2',
  roseSoft: '#FFE4E6',
  dangerText: '#B91C1C',
  dangerBorder: '#FCA5A5',
  blush: '#FFF1F2',
  primaryDisabled: '#F9C2D9',
  successSoft: '#ECFDF5',
  placeholder: '#EDEDED',
  shadow: '#000000',
};

export const DARK: Palette = {
  bg: '#0A0D13',
  bgSoft: '#0E1017',
  surface: '#15171B',
  card: '#15171B',
  elevated: '#23262D',
  divider: '#262A31',
  border: '#464646',
  text: '#FFFFFF',
  textSecondary: '#9F9F9F',
  textMuted: '#6B6B6B',
  nav: '#15171B',
  overlay: 'rgba(0,0,0,0.65)',
  primarySoft: '#2B1424',
  danger: '#F87171',
  dangerSoft: '#3A1A1D',
  roseSoft: '#3A1A22',
  dangerText: '#FCA5A5',
  dangerBorder: '#7F1D1D',
  blush: '#2B1424',
  primaryDisabled: '#5A1F42',
  successSoft: '#10281F',
  placeholder: '#1E2127',
  shadow: '#000000',
};

export const PALETTES: Record<Scheme, Palette> = { light: LIGHT, dark: DARK };

/** Brand accents - same in both schemes. */
export const BRAND = {
  pink: '#D62D88',
  pinkDeep: '#C93A86',
  recoveryPink: '#F68AA8',
  nurseBlue: '#2C4EDA',
  amber: '#FFA722',
  cream: '#FFEEC5',
  supportGreen: '#15B300',
} as const;
