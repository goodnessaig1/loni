import { motion } from 'framer-motion';
import { AboutHero } from '../components/about/AboutHero';
import { SiteFooter } from '../components/footer/SiteFooter';
import { Header } from '../components/layout/Header';
import { VideoBanner } from '../components/about/VideoBanner';
import { MissionVision } from '../components/about/MissionVision';
import { TiltPhoto } from '../components/about/TiltPhoto';
import { WhyExistsSection } from '../components/about/WhyExistsSection';

export default function AboutPage() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="min-h-svh bg-white lg:p-3"
    >
      <Header />
      <main>
        <AboutHero />
        <WhyExistsSection />
        <TiltPhoto />
        <MissionVision />
        <VideoBanner />
      </main>
      <SiteFooter />
    </motion.div>
  );
}
