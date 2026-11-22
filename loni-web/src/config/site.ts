/** Canonical origin. Override with NEXT_PUBLIC_SITE_URL (e.g. for a staging deploy); no trailing slash. */
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://lonimum.com').replace(/\/+$/, '');

// TODO: replace the placeholder hrefs with the real store / social / support links.
// Structured data only lists the store and social links once they are real URLs (see src/lib/seo/jsonld.ts).
export const SITE = {
  name: 'LONI',
  url: SITE_URL,
  tagline: 'Your Companion Through Motherhood',
  description:
    'LONI is a pregnancy, birth and postpartum support app for mothers in Nigeria: AI guidance, verified nurses on call, emergency rides to hospital and family who stay connected, in one place.',
  locale: 'en_NG',
  themeColor: '#D62D88',
  instagramUrl: 'https://www.instagram.com/',
  supportEmail: 'support@lonimum.com',
  supportHref: 'mailto:support@lonimum.com',
  downloadHref: '#download',
  appStoreHref: '#download',
  playStoreHref: '#download',
  joinDriverHref: '#drivers',
  joinNurseHref: '#nurses',
  talkToNurseHref: '#talk-to-a-nurse',
  joinCommunityHref: '#community',
  partnerSupportHref: '#partners',
  exploreLoniPlusHref: '#pricing',
  driverHowItWorksHref: '#how-it-works',
  driverSignupHref: '#join-driver',
  driverTrainingHref: '#training-guide',
  nurseHowItWorksHref: '#how-it-works',
  partnerJoinHref: '#join-partner',
  exploreLoniHref: '/',
  nurseSignupHref: '#join-nurse',
  privacyHref: '#privacy',
  termsHref: '#terms',
  disclaimerHref: '#disclaimer',
} as const;

/** True for a real, absolute link (not a `#placeholder` or the bare instagram.com home page). */
export function isRealUrl(href: string): boolean {
  return /^https?:\/\/[^/]+\/.+/.test(href);
}
