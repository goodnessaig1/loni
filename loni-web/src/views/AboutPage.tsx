import { PageShell } from '../components/layout/PageShell';
import { AboutHero } from '../components/about/AboutHero';
import { VideoBanner } from '../components/about/VideoBanner';
import { MissionVision } from '../components/about/MissionVision';
import { TiltPhoto } from '../components/about/TiltPhoto';
import { WhyExistsSection } from '../components/about/WhyExistsSection';

export default function AboutPage() {
  return (
    <PageShell>
      <AboutHero />
      <WhyExistsSection />
      <TiltPhoto />
      <MissionVision />
      <VideoBanner />
    </PageShell>
  );
}
