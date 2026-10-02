/** "9 min ago", "about 2 hours ago", "1 day ago" - no library, just the app's own vocabulary. */
export function relativeTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `about ${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

export function clockTime(iso: string | null | undefined): string {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

/** "about 2 hours ago · 11:24 AM" */
export function relativeTimeWithClock(iso: string | null | undefined): string {
  if (!iso) return '';
  return `${relativeTime(iso)} · ${clockTime(iso)}`;
}
