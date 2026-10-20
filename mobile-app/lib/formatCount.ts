/** 61 -> "61", 6200 -> "6.2K", 17000 -> "17K", 1_250_000 -> "1.3M". `lowercase` gives "17k" (the viewers pill). */
export function formatCount(n: number, lowercase = false): string {
  const safe = Math.max(0, Math.floor(n || 0));
  const out = (value: number, unit: 'K' | 'M') => {
    const text = value >= 10 || Number.isInteger(value) ? Math.round(value).toString() : value.toFixed(1);
    return text + (lowercase ? unit.toLowerCase() : unit);
  };
  if (safe >= 1_000_000) return out(safe / 1_000_000, 'M');
  if (safe >= 1_000) return out(safe / 1_000, 'K');
  return String(safe);
}
