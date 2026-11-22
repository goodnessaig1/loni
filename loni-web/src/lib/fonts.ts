import { Archivo_Narrow, DM_Sans, Inter, Public_Sans } from 'next/font/google';

/** Body face for the whole site. */
export const publicSans = Public_Sans({
  subsets: ['latin'],
  style: ['normal', 'italic'],
  display: 'swap',
  variable: '--font-public-sans',
});

/** Hero copy and store buttons. */
export const inter = Inter({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  display: 'swap',
  variable: '--font-inter-face',
});

/** Hero pills, rating and the connected card. */
export const dmSans = DM_Sans({
  subsets: ['latin'],
  axes: ['opsz'],
  display: 'swap',
  variable: '--font-dm-sans',
});

/** Condensed face for the nurse section's text ribbon. */
export const archivoNarrow = Archivo_Narrow({
  subsets: ['latin'],
  weight: '700',
  display: 'swap',
  variable: '--font-archivo-narrow',
});

export const fontVariables = [publicSans.variable, inter.variable, dmSans.variable, archivoNarrow.variable].join(' ');
