export interface NavLinkItem {
  label: string;
  /** In-app route (rendered with react-router). */
  to?: string;
  /** In-page anchor / external link. */
  href?: string;
  /** Short line shown under the label in the For You menu. */
  description?: string;
}

export const NAV_LINKS: NavLinkItem[] = [
  { label: 'Home', to: '/' },
  { label: 'About Us', to: '/about' },
  { label: 'The journey', href: '#journey' },
  { label: 'Pricing', href: '#pricing' },
];

export const FOR_YOU_LINKS: NavLinkItem[] = [
  { label: 'Partners & Family', to: '/partners', description: 'Stay connected to someone you love.' },
  { label: 'Nurses', to: '/nurses', description: 'Support mothers when they need a human.' },
  { label: 'Drivers', to: '/drivers', description: 'Help mothers get where they need to be.' },
];
