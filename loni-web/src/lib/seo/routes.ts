import type { MetadataRoute } from 'next';

/**
 * Every public, indexable page, with its search intent. One source of truth for page metadata, the
 * sitemap and breadcrumbs. Each page targets its own intent so pages don't compete for the same query.
 *
 * `lastModified` is the date the page's content last changed; update it when you change a page.
 */
export interface SeoRoute {
  path: string;
  /** Short name used in breadcrumbs. */
  name: string;
  /** <title> (the layout appends " | LONI" unless `absoluteTitle` is set). */
  title: string;
  absoluteTitle?: boolean;
  description: string;
  keywords: string[];
  lastModified: string;
  changeFrequency: NonNullable<MetadataRoute.Sitemap[number]['changeFrequency']>;
  priority: number;
  /** Schema.org page type for the WebPage node. */
  schemaType: 'WebPage' | 'AboutPage';
  /** Social-card headline (kept short so it fits the generated image). */
  ogHeadline: string;
}

export const ROUTES = {
  home: {
    path: '/',
    name: 'Home',
    // Primary intent: "pregnancy app" / "AI pregnancy companion" / "maternal health support in Nigeria".
    title: 'LONI – Pregnancy, Birth & Postpartum Support App | Your Companion Through Motherhood',
    absoluteTitle: true,
    description:
      'Track your pregnancy, get 24/7 AI guidance, talk to a verified nurse, request an emergency ride to hospital and keep your family connected. LONI supports mothers in Nigeria from pregnancy through postpartum.',
    keywords: [
      'pregnancy app',
      'AI pregnancy companion',
      'maternal health app Nigeria',
      'pregnancy support Nigeria',
      'postpartum support',
      "women's health app",
      'talk to a nurse',
    ],
    lastModified: '2026-11-15',
    changeFrequency: 'weekly',
    priority: 1,
    schemaType: 'WebPage',
    ogHeadline: 'A smoother motherhood journey',
  },
  about: {
    path: '/about',
    name: 'About Us',
    // Intent: brand / mission ("what is LONI", "maternal wellness support Nigeria").
    title: 'About LONI – Maternal Wellness Support for Every Mother',
    description:
      'Why LONI exists: a trusted support system in every mother’s pocket, combining AI guidance, human nurse support, emergency assistance and a connected community through pregnancy and postpartum.',
    keywords: ['about LONI', 'maternal wellness', 'maternal health Nigeria', 'pregnancy support platform'],
    lastModified: '2026-11-22',
    changeFrequency: 'monthly',
    priority: 0.8,
    schemaType: 'AboutPage',
    ogHeadline: 'A trusted support system in every mother’s pocket',
  },
  partners: {
    path: '/partners',
    name: 'For Partners & Family',
    // Intent: "how to support my pregnant wife/partner", "pregnancy app for partners".
    title: 'For Partners & Family – Support Her Through Pregnancy',
    description:
      'Stay close to her pregnancy journey. With LONI, partners and family can follow milestones she chooses to share, get emergency alerts and be there when she needs you.',
    keywords: ['support pregnant partner', 'pregnancy app for partners', 'pregnancy app for husbands', 'family pregnancy support'],
    lastModified: '2026-10-14',
    changeFrequency: 'monthly',
    priority: 0.7,
    schemaType: 'WebPage',
    ogHeadline: 'Stay close to her pregnancy journey',
  },
  nurses: {
    path: '/nurses',
    name: 'For Nurses',
    // Intent: nurse recruitment ("nurse jobs Nigeria remote", "earn as a nurse online").
    title: 'For Nurses – Support Mothers by Voice Call and Earn with LONI',
    description:
      'Join LONI as a verified nurse. Take short voice calls from mothers when an AI answer isn’t enough, give real human support and earn money.',
    keywords: ['nurse jobs Nigeria', 'remote nursing jobs', 'telehealth nurse', 'maternal health nurse', 'join LONI as a nurse'],
    lastModified: '2026-10-14',
    changeFrequency: 'monthly',
    priority: 0.7,
    schemaType: 'WebPage',
    ogHeadline: 'Your 5 minutes can make a difference',
  },
  drivers: {
    path: '/drivers',
    name: 'For Drivers',
    // Intent: driver recruitment ("driver jobs Lagos", "drive with LONI").
    title: 'For Drivers – Help Mothers Get to Hospital Safely with LONI',
    description:
      'Drive with LONI and help mothers get to the hospital safe, fast and happy. See ride requests nearby, earn on every trip and get trained to support expectant mothers.',
    keywords: ['driver jobs Nigeria', 'drive with LONI', 'emergency ride to hospital', 'maternity transport'],
    lastModified: '2026-10-14',
    changeFrequency: 'monthly',
    priority: 0.7,
    schemaType: 'WebPage',
    ogHeadline: 'Help a mother get where she needs to be',
  },
  privacy: {
    path: '/privacy',
    name: 'Privacy Policy',
    title: 'Privacy Policy',
    description: 'How LONI collects, uses and protects your personal and health-related information, and the choices you have.',
    keywords: ['LONI privacy policy'],
    lastModified: '2026-10-14',
    changeFrequency: 'yearly',
    priority: 0.3,
    schemaType: 'WebPage',
    ogHeadline: 'Privacy Policy',
  },
  terms: {
    path: '/terms',
    name: 'Terms of Service',
    title: 'Terms of Service',
    description: 'The terms that govern your use of the LONI app and services, including LONI Plus subscriptions.',
    keywords: ['LONI terms of service'],
    lastModified: '2026-10-14',
    changeFrequency: 'yearly',
    priority: 0.3,
    schemaType: 'WebPage',
    ogHeadline: 'Terms of Service',
  },
  disclaimer: {
    path: '/disclaimer',
    name: 'Medical Disclaimer',
    title: 'Medical Disclaimer',
    description:
      'LONI provides support and information and is not a substitute for professional medical advice, diagnosis, treatment or emergency care.',
    keywords: ['LONI medical disclaimer'],
    lastModified: '2026-10-14',
    changeFrequency: 'yearly',
    priority: 0.3,
    schemaType: 'WebPage',
    ogHeadline: 'Medical Disclaimer',
  },
} as const satisfies Record<string, SeoRoute>;

export type RouteKey = keyof typeof ROUTES;

/** Routes that exist but must never be indexed (private flows). */
export const PRIVATE_PATHS = ['/verify'] as const;
