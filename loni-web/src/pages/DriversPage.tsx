import { motion } from 'framer-motion';
import { DriverHero } from '../components/drivers/DriverHero';
import { SiteFooter } from '../components/footer/SiteFooter';
import { Header } from '../components/layout/Header';
import { WhyDriversSection } from '../components/drivers/WhyDriversSection';

export default function DriversPage() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="min-h-svh bg-white lg:p-5"
    >
      <Header />
      <main>
        <DriverHero />
        <WhyDriversSection />
      </main>
      <SiteFooter />
    </motion.div>
  );
}
