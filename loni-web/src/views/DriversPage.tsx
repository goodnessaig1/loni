import { PageShell } from '../components/layout/PageShell';
import { DriverHero } from '../components/drivers/DriverHero';
import { DriverEarningsSection } from '../components/drivers/DriverEarningsSection';
import { RequestVisibilitySection } from '../components/drivers/RequestVisibilitySection';
import { TrainingSection } from '../components/drivers/TrainingSection';
import { WhyDriversSection } from '../components/drivers/WhyDriversSection';

export default function DriversPage() {
  return (
    <PageShell>
      <DriverHero />
      <WhyDriversSection />
      <RequestVisibilitySection />
      <DriverEarningsSection />
      <TrainingSection />
    </PageShell>
  );
}
