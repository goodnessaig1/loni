import { SITE } from '../../config/site';

/** Absolute URL on the canonical origin. `absoluteUrl('/about')` → `https://lonimum.com/about`. */
export function absoluteUrl(path = '/'): string {
  return path === '/' ? `${SITE.url}/` : `${SITE.url}${path.startsWith('/') ? path : `/${path}`}`;
}
