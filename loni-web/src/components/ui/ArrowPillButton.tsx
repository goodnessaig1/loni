import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';

interface Props {
  href: string;
  children: ReactNode;
  className?: string;
}

/** Solid black pill with a detached circular arrow button (used for primary CTAs). */
export function ArrowPillButton({ href, children, className = '' }: Props) {
  return (
    <motion.a
      href={href}
      whileHover={{ scale: 1.04 }}
      whileTap={{ scale: 0.96 }}
      className={`group inline-flex items-center ${className}`}
    >
      <span className="-mr-0.5 inline-flex items-center rounded-full bg-black px-[22px] py-3 text-sm font-bold capitalize text-white transition-colors group-hover:bg-neutral-800">
        {children}
      </span>
      <span className="inline-flex size-11 items-center justify-center rounded-full bg-black text-white transition-colors group-hover:bg-neutral-800">
        <ArrowRight
          className="size-5 transition-transform duration-200 group-hover:translate-x-1"
          strokeWidth={2.5}
          aria-hidden="true"
        />
      </span>
    </motion.a>
  );
}
