import { motion } from 'framer-motion';
import { SiteFooter } from '../components/footer/SiteFooter';
import { Header } from '../components/layout/Header';
import { PrivacySection } from '../components/partners/PrivacySection';
import { PartnerHowItWorksSection } from '../components/partners/PartnerHowItWorksSection';
import { PartnerHero } from '../components/partners/PartnerHero';
import { WhyPartnersSection } from '../components/partners/WhyPartnersSection';

export default function PartnersPage() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="min-h-svh bg-white lg:p-3"
    >
      <Header />
      <main>
        <PartnerHero />
        <WhyPartnersSection />
        <PartnerHowItWorksSection />
        <PrivacySection />
      </main>
      <SiteFooter />
    </motion.div>
  );
}
