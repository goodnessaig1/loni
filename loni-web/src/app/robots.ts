import type { MetadataRoute } from 'next';
import { PRIVATE_PATHS } from '../lib/seo/routes';
import { absoluteUrl } from '../lib/seo/url';

/**
 * Crawl rules. robots.txt is advice, not access control: /verify is also `noindex` in its metadata
 * and response headers. CSS, JS, images and /_next assets stay crawlable so pages render for bots.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: [...PRIVATE_PATHS, '/api/'] }],
    sitemap: absoluteUrl('/sitemap.xml'),
  };
}
