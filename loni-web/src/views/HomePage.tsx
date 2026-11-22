import { PageShell } from '../components/layout/PageShell';
import { Hero } from '../components/hero/Hero';
import { IntroSection } from '../components/intro/IntroSection';
import { RoadsShowcase } from '../components/showcase/RoadsShowcase';
import { ProblemSection } from '../components/problem/ProblemSection';
import { EmergencySection } from '../components/emergency/EmergencySection';
import { LoniBotSection } from '../components/lonibot/LoniBotSection';
import { NurseSection } from '../components/nurse/NurseSection';
import { CommunitySection } from '../components/community/CommunitySection';
import { PartnerSection } from '../components/partner/PartnerSection';
import { JourneySection } from '../components/journey/JourneySection';
import { PricingSection } from '../components/pricing/PricingSection';

export default function HomePage() {
  return (
    <PageShell>
      <Hero />
      <IntroSection />
      <RoadsShowcase />
      <ProblemSection />
      <EmergencySection />
      <LoniBotSection />
      <NurseSection />
      <CommunitySection />
      <PartnerSection />
      <JourneySection />
      <PricingSection />
    </PageShell>
  );
}
