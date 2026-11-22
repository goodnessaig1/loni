'use client';

import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { SiteFooter } from '../footer/SiteFooter';
import { Header } from './Header';

/**
 * The frame every marketing page shares: a soft fade-in, the site header, `<main>` and the footer.
 * The page's sections are passed in as children, so they stay server-rendered where they can be.
 */
export function PageShell({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="min-h-svh bg-white lg:p-3"
    >
      <Header />
      <main id="main-content">{children}</main>
      <SiteFooter />
    </motion.div>
  );
}
