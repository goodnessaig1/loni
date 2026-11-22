import { PageShell } from '../components/layout/PageShell';
import { PrivacySection } from '../components/partners/PrivacySection';
import { PartnerHowItWorksSection } from '../components/partners/PartnerHowItWorksSection';
import { PartnerHero } from '../components/partners/PartnerHero';
import { WhyPartnersSection } from '../components/partners/WhyPartnersSection';

export default function PartnersPage() {
  return (
    <PageShell>
      <PartnerHero />
      <WhyPartnersSection />
      <PartnerHowItWorksSection />
      <PrivacySection />
    </PageShell>
  );
}
