import type { ReactNode } from 'react';
import { motion } from 'framer-motion';

/**
 * The slightly tilted, dashed-edge label pill ("Emergency transportation").
 * Pops in with a spring and re-plays every time it scrolls into view.
 */
export function TagBadge({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8, rotate: -9 }}
      whileInView={{ opacity: 1, scale: 1, rotate: -3.09 }}
      viewport={{ once: false, amount: 0.8 }}
      transition={{ type: 'spring', stiffness: 260, damping: 18 }}
      whileHover={{ rotate: 0, scale: 1.05 }}
      className={`inline-flex items-center gap-3.5 rounded-full border-2 border-dashed border-pink-200 bg-white px-[17px] py-[10px] text-sm font-medium text-black shadow-sm sm:text-[15px] ${className}`}
    >
      <span className="size-1.5 shrink-0 rounded-full bg-black" aria-hidden="true" />
      <span>{children}</span>
    </motion.div>
  );
}
