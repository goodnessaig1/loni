/** 5900 -> "₦5,900" */
export const naira = (amount: number): string => `₦${amount.toLocaleString('en-NG')}`;

/** ISO string -> "June 3, 2026" (device locale month names, fixed order so it matches the designs). */
export const longDate = (iso?: string | null): string => {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.toLocaleString('en-US', { month: 'long' })} ${d.getDate()}, ${d.getFullYear()}`;
};

/** ISO string -> "June 3" */
export const shortDate = (iso?: string | null): string => {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.toLocaleString('en-US', { month: 'long' })} ${d.getDate()}`;
};

export const planName = (plan?: string | null): string => (plan === 'annual' ? 'LoniPlus Annual' : 'LoniPlus Monthly');
