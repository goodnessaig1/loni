import { SITE, isRealUrl } from '../../config/site';
import { ROUTES, type RouteKey, type SeoRoute } from './routes';
import { absoluteUrl } from './url';

/**
 * Schema.org graph builders. Everything here must match what the page visibly says: no ratings,
 * prices, certifications or store listings that aren't real. Store and social links are only added
 * once `SITE` holds real URLs for them.
 */

const ORG_ID = absoluteUrl('/#organization');
const WEBSITE_ID = absoluteUrl('/#website');
const APP_ID = absoluteUrl('/#app');

type Node = Record<string, unknown>;

export function organizationNode(): Node {
  const sameAs = [SITE.instagramUrl].filter(isRealUrl);
  return {
    '@type': 'Organization',
    '@id': ORG_ID,
    name: SITE.name,
    url: absoluteUrl('/'),
    logo: { '@type': 'ImageObject', url: absoluteUrl('/fav.png'), width: 168, height: 168 },
    description: SITE.description,
    email: SITE.supportEmail,
    contactPoint: { '@type': 'ContactPoint', contactType: 'customer support', email: SITE.supportEmail },
    areaServed: { '@type': 'Country', name: 'Nigeria' },
    ...(sameAs.length ? { sameAs } : {}),
  };
}

export function websiteNode(): Node {
  return {
    '@type': 'WebSite',
    '@id': WEBSITE_ID,
    url: absoluteUrl('/'),
    name: SITE.name,
    description: SITE.description,
    inLanguage: 'en',
    publisher: { '@id': ORG_ID },
  };
}

/** The LONI app, only once it has a real store listing to point to. */
export function mobileAppNode(): Node | null {
  const stores = [
    { href: SITE.appStoreHref, os: 'iOS' },
    { href: SITE.playStoreHref, os: 'Android' },
  ].filter((s) => isRealUrl(s.href));
  if (!stores.length) return null;
  return {
    '@type': 'MobileApplication',
    '@id': APP_ID,
    name: SITE.name,
    description: SITE.description,
    applicationCategory: 'HealthApplication',
    operatingSystem: stores.map((s) => s.os).join(', '),
    url: absoluteUrl('/'),
    installUrl: stores.map((s) => s.href),
    publisher: { '@id': ORG_ID },
  };
}

export function breadcrumbNode(key: RouteKey): Node | null {
  if (key === 'home') return null;
  const route = ROUTES[key];
  return {
    '@type': 'BreadcrumbList',
    '@id': `${absoluteUrl(route.path)}#breadcrumb`,
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: ROUTES.home.name, item: absoluteUrl('/') },
      { '@type': 'ListItem', position: 2, name: route.name, item: absoluteUrl(route.path) },
    ],
  };
}

export function webPageNode(key: RouteKey): Node {
  const route: SeoRoute = ROUTES[key];
  const url = absoluteUrl(route.path);
  const breadcrumb = breadcrumbNode(key);
  return {
    '@type': route.schemaType,
    '@id': `${url}#webpage`,
    url,
    name: route.absoluteTitle ? route.title : `${route.title} | ${SITE.name}`,
    description: route.description,
    inLanguage: 'en',
    dateModified: route.lastModified,
    isPartOf: { '@id': WEBSITE_ID },
    about: { '@id': ORG_ID },
    ...(breadcrumb ? { breadcrumb: { '@id': breadcrumb['@id'] } } : {}),
  };
}

/** Site-wide graph, rendered once from the root layout. */
export function siteGraph(): Node {
  const app = mobileAppNode();
  return { '@context': 'https://schema.org', '@graph': [organizationNode(), websiteNode(), ...(app ? [app] : [])] };
}

/** Per-page graph: the page itself and its breadcrumb trail. */
export function pageGraph(key: RouteKey): Node {
  const breadcrumb = breadcrumbNode(key);
  return { '@context': 'https://schema.org', '@graph': [webPageNode(key), ...(breadcrumb ? [breadcrumb] : [])] };
}
