import heroPhoto from '../../assets/nurses/hero.webp';
import { SITE } from '../../config/site';
import { RoleHero } from '../roles/RoleHero';

/** "For Nurses" hero: copy anchored to the bottom-left, over the photo's dark vignette. */
export function NurseHero() {
  return (
    <RoleHero
      id="nurse-hero"
      tag="For Nurses"
      heading={['Your 5 minutes can make a', 'difference, and earn you money.']}
      intro={[
        'LONI instantly connects mothers with verified and experienced nurses through voice calls, giving them',
        'access to human support when an AI answer isn’t enough.',
      ]}
      photo={heroPhoto}
      primary={{ label: 'Join LONI as a Nurse', href: SITE.nurseSignupHref }}
      secondary={{ label: 'How it works', href: SITE.nurseHowItWorksHref }}
      layout="bottom"
      focusX="58%"
    />
  );
}
