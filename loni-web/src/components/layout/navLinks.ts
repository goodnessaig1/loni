export interface NavLinkItem {
  label: string;
  /** In-app route (rendered with react-router). */
  to?: string;
  /** In-page anchor / external link. */
  href?: string;
}

export const NAV_LINKS: NavLinkItem[] = [
  { label: 'Home', to: '/' },
  { label: 'About Us', href: '#about' },
  { label: 'The journey', href: '#journey' },
  { label: 'Pricing', href: '#pricing' },
];

export const FOR_YOU_LINKS: NavLinkItem[] = [
  { label: 'Mothers', href: '#mothers' },
  { label: 'Partners', to: '/partners' },
  { label: 'Nurses', to: '/nurses' },
  { label: 'Drivers', to: '/drivers' },
];
