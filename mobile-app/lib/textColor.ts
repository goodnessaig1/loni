import { StyleProp, StyleSheet, TextStyle } from 'react-native';

/** A NativeWind class that sets the text *colour* (as opposed to size/alignment: text-lg, text-center ...). */
const COLOR_CLASS =
  /(^|\s)text-(?:white|black|transparent|current|inherit|\[#|\[rgb|(?:gray|slate|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|primary|secondary|accent|surface|background)(?:-|\s|$))/;

/**
 * Whether the caller already chose a colour (inline `style.color` or a `text-<colour>` class). If not,
 * <HelixaText>/<CalText> fall back to the theme's text colour, so unstyled text is readable in dark mode.
 */
export function hasExplicitColor(style: StyleProp<TextStyle>, className?: string): boolean {
  if (StyleSheet.flatten(style)?.color != null) return true;
  return !!className && COLOR_CLASS.test(className);
}

/**
 * In dark mode, greys/blacks written as Tailwind classes (text-black, text-gray-500 ...) would be
 * unreadable on a dark canvas, so they are re-pointed at the theme's text colours. Light mode never
 * calls this, so its output is byte-for-byte what the class said. Accent colours (text-white,
 * text-[#D62D88] ...) are never touched.
 */
export function darkTextOverride(
  className: string | undefined,
  colors: { text: string; textSecondary: string; textMuted: string },
): string | undefined {
  if (!className) return undefined;
  let out: string | undefined;
  for (const token of className.split(/\s+/)) {
    if (/^text-(black|(gray|zinc|neutral|slate|stone)-(700|800|900|950))$/.test(token)) out = colors.text;
    else if (/^text-(gray|zinc|neutral|slate|stone)-(500|600)$/.test(token)) out = colors.textSecondary;
    else if (/^text-(gray|zinc|neutral|slate|stone)-(200|300|400)$/.test(token)) out = colors.textMuted;
  }
  return out;
}
