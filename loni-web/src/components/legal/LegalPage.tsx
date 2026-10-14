import { motion } from 'framer-motion';
import { SiteFooter } from '../footer/SiteFooter';
import { Header } from '../layout/Header';
import { LegalDocument } from './LegalDocument';

type Props = Parameters<typeof LegalDocument>[0];

/** A full legal page: site header, the document, site footer. */
export function LegalPage(props: Props) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="min-h-svh bg-white lg:p-3"
    >
      <Header />
      <main>
        <LegalDocument {...props} />
      </main>
      <SiteFooter />
    </motion.div>
  );
}
