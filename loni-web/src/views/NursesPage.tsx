import { motion } from 'framer-motion';
import { SiteFooter } from '../components/footer/SiteFooter';
import { Header } from '../components/layout/Header';
import { NurseHero } from '../components/nurses/NurseHero';
import { NurseHowItWorksSection } from '../components/nurses/NurseHowItWorksSection';
import { WhyNursesSection } from '../components/nurses/WhyNursesSection';

export default function NursesPage() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="min-h-svh bg-white lg:p-3"
    >
      <Header />
      <main>
        <NurseHero />
        <WhyNursesSection />
        <NurseHowItWorksSection />
      </main>
      <SiteFooter />
    </motion.div>
  );
}
