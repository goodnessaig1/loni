import type { Metadata } from 'next';
import { SITE } from '../../config/site';
import { ROUTES, type RouteKey, type SeoRoute } from './routes';
import { absoluteUrl } from './url';

/**
 * Page metadata from the route registry: unique title and description, canonical URL, Open Graph and
 * X card. The social image comes from the route's `opengraph-image.tsx` file, which Next adds itself.
 */
export function pageMetadata(key: RouteKey): Metadata {
  const route: SeoRoute = ROUTES[key];
  const url = absoluteUrl(route.path);
  const socialTitle = route.absoluteTitle ? route.title : `${route.title} | ${SITE.name}`;

  return {
    title: route.absoluteTitle ? { absolute: route.title } : route.title,
    description: route.description,
    keywords: route.keywords,
    alternates: { canonical: url },
    openGraph: {
      type: 'website',
      url,
      siteName: SITE.name,
      locale: SITE.locale,
      title: socialTitle,
      description: route.description,
    },
    twitter: {
      card: 'summary_large_image',
      title: socialTitle,
      description: route.description,
    },
  };
}

/** For private flows (e.g. the partner invite link): never indexed, never followed. */
export const NO_INDEX: Metadata['robots'] = {
  index: false,
  follow: false,
  nocache: true,
  googleBot: { index: false, follow: false, noimageindex: true },
};
