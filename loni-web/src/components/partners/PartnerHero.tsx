import heroPhoto from '../../assets/partners/hero.webp';
import { SITE } from '../../config/site';
import { RoleHero } from '../roles/RoleHero';

/** "For Partners & Family" hero: heading low-left, intro and a white "Join LONI" button low-right. */
export function PartnerHero() {
  return (
    <RoleHero
      id="partner-hero"
      tag="For Partners & Family"
      heading={['We know she matters', 'to you. Stay close to', 'her journey.']}
      intro={[
        'Pregnancy is a journey you don’t have to watch from the',
        'sidelines. Stay connected, support her milestones and be',
        'there when she needs you.',
      ]}
      photo={heroPhoto}
      lightCta={{ label: 'Join LONI', href: SITE.partnerJoinHref }}
      layout="split"
      focusX="50%"
    />
  );
}
