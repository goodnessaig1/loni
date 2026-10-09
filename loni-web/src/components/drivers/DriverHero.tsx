import heroPhoto from '../../assets/drivers/hero.webp';
import { SITE } from '../../config/site';
import { RoleHero } from '../roles/RoleHero';
import { TripCard } from './TripCard';

/** "For Drivers" hero: the shared role hero plus the frosted trip card at the bottom-right. */
export function DriverHero() {
  return (
    <RoleHero
      id="driver-hero"
      tag="For Drivers"
      heading={['Help a mother get', 'where she needs to be.']}
      intro={['Help LONI mums get to the hospital safe, fast and happy.']}
      photo={heroPhoto}
      primary={{ label: 'Join LONI as a Driver', href: SITE.driverSignupHref }}
      secondary={{ label: 'How it works', href: SITE.driverHowItWorksHref }}
      layout="top"
    >
      <TripCard className="mt-auto w-[72%] self-end text-[12px] sm:w-[60%] lg:absolute lg:bottom-[5.7%] lg:right-[2.1%] lg:mt-0 lg:w-[31.9%] lg:text-[min(1.24vw,1.4rem)]" />
    </RoleHero>
  );
}
