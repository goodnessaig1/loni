import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, ArrowUpRight } from 'lucide-react';

interface Props {
  href: string;
  children: ReactNode;
  className?: string;
  /** `dark`: black pill on light backgrounds. `light`: white pill (with a ↗ arrow) for coloured sections. */
  variant?: 'dark' | 'light';
}

const PILL = {
  dark: 'bg-black px-[22px] py-3 text-sm font-bold capitalize text-white group-hover:bg-neutral-800',
  light: 'bg-white px-6 py-3 text-[15px] font-semibold text-black group-hover:bg-neutral-100',
} as const;

const CIRCLE = {
  dark: 'bg-black text-white group-hover:bg-neutral-800',
  light: 'bg-white text-black group-hover:bg-neutral-100',
} as const;

/** Pill with a detached circular arrow button (used for primary CTAs). */
export function ArrowPillButton({ href, children, className = '', variant = 'dark' }: Props) {
  const Arrow = variant === 'light' ? ArrowUpRight : ArrowRight;
  return (
    <motion.a
      href={href}
      whileHover={{ scale: 1.04 }}
      whileTap={{ scale: 0.96 }}
      className={`group inline-flex items-center ${className}`}
    >
      <span className={`-mr-0.5 inline-flex items-center rounded-full transition-colors ${PILL[variant]}`}>
        {children}
      </span>
      <span className={`inline-flex size-11 items-center justify-center rounded-full transition-colors ${CIRCLE[variant]}`}>
        <Arrow
          className={`size-5 transition-transform duration-200 ${
            variant === 'light' ? 'group-hover:translate-x-0.5 group-hover:-translate-y-0.5' : 'group-hover:translate-x-1'
          }`}
          strokeWidth={2.5}
          aria-hidden="true"
        />
      </span>
    </motion.a>
  );
}
