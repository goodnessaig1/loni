import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';

const EASE = [0.22, 1, 0.36, 1] as const;

/** ₦ amount with the faded ".00" and the "/Annual" suffix. Sized in `em` (big number = 2.93em). */
export function Price({ children, fadedClass }: { children: ReactNode; fadedClass: string }) {
  return (
    <div className="flex items-baseline gap-[0.45em]">
      <span className="text-[2.2em] font-bold leading-none tracking-[-0.02em] lg:text-[2.93em]">
        ₦{children}
        <span className={`font-medium ${fadedClass}`}>.00</span>
      </span>
      <span className="text-[1.07em]">/Annual</span>
    </div>
  );
}

/** One "✓ feature" row that slides in with a stagger. */
export function Feature({
  children,
  index,
  badgeClass,
}: {
  children: ReactNode;
  index: number;
  /** Classes for the circle behind the check (colour + size). */
  badgeClass: string;
}) {
  return (
    <motion.li
      initial={{ opacity: 0, x: -14 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: false, amount: 0.8 }}
      transition={{ duration: 0.5, delay: 0.15 + index * 0.07, ease: EASE }}
      className="flex items-center gap-[0.7em]"
    >
      <span className={`inline-flex shrink-0 items-center justify-center rounded-full ${badgeClass}`}>
        <Check className="size-[62%]" strokeWidth={3} aria-hidden="true" />
      </span>
      <span>{children}</span>
    </motion.li>
  );
}
