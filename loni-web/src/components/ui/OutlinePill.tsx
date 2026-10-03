import type { ReactNode } from 'react';
import { motion } from 'framer-motion';

/** Black-outlined white label pill. Sized in `em`, so the parent's font-size scales it. Slides in from the left. */
export function OutlinePill({ children, index = 0 }: { children: ReactNode; index?: number }) {
  return (
    <motion.span
      initial={{ opacity: 0, x: -24 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: false, amount: 0.8 }}
      transition={{ duration: 0.55, delay: 0.2 + index * 0.1, ease: [0.22, 1, 0.36, 1] }}
      className="inline-flex h-[2.5em] items-center rounded-full border-[1.5px] border-black bg-white px-[2.2em] font-medium text-black"
    >
      {children}
    </motion.span>
  );
}
