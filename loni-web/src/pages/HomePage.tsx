import { motion } from 'framer-motion';
import { Header } from '../components/layout/Header';
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

export default function HomePage() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="min-h-svh bg-white lg:p-5"
    >
      <Header />
      <main>
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
      </main>
    </motion.div>
  );
}
