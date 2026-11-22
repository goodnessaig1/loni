import { PageShell } from '../components/layout/PageShell';
import { NurseHero } from '../components/nurses/NurseHero';
import { NurseHowItWorksSection } from '../components/nurses/NurseHowItWorksSection';
import { WhyNursesSection } from '../components/nurses/WhyNursesSection';

export default function NursesPage() {
  return (
    <PageShell>
      <NurseHero />
      <WhyNursesSection />
      <NurseHowItWorksSection />
    </PageShell>
  );
}
