import type { MetadataRoute } from 'next';
import { ROUTES, type SeoRoute } from '../lib/seo/routes';
import { absoluteUrl } from '../lib/seo/url';

/** Every public, indexable page. Private flows (/verify) are deliberately left out. */
export default function sitemap(): MetadataRoute.Sitemap {
  return Object.values(ROUTES as Record<string, SeoRoute>).map((route) => ({
    url: absoluteUrl(route.path),
    lastModified: new Date(route.lastModified),
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
}
