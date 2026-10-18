import { PixelRatio } from 'react-native';

/**
 * Ask Cloudinary for an image at the size it's shown (same file in both apps), in the best format
 * for the phone (WebP/AVIF) and compressed. A profile photo shown at 40 pt is ~120 px, not the
 * multi-megabyte original - much faster on mobile data. Non-Cloudinary URLs are returned as-is.
 */
export function cdnImage(url: string | null | undefined, displayWidth: number): string | undefined {
  if (!url) return undefined;
  const trimmed = url.trim();
  const marker = '/image/upload/';
  const at = trimmed.indexOf(marker);
  if (!trimmed.includes('res.cloudinary.com') || at === -1) return trimmed;
  const rest = trimmed.slice(at + marker.length);
  // Already transformed (e.g. "w_300,..."/): leave it alone.
  if (/^[a-z]{1,3}_[^/]+\//.test(rest) && !/^v\d+\//.test(rest)) return trimmed;
  const px = Math.min(2000, Math.round(PixelRatio.getPixelSizeForLayoutSize(displayWidth) / 50) * 50 || 100);
  return `${trimmed.slice(0, at + marker.length)}f_auto,q_auto,c_limit,w_${px}/${rest}`;
}
