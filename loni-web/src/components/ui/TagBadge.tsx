import type { ReactNode } from 'react';
import { motion } from 'framer-motion';

/**
 * The slightly tilted, dashed-edge label pill ("Emergency transportation").
 * Pops in with a spring and re-plays every time it scrolls into view.
 */
export function TagBadge({
  children,
  className = '',
  variant = 'default',
}: {
  children: ReactNode;
  className?: string;
  variant?: 'default' | 'green';
}) {
  const isGreen = variant === 'green';

  if (isGreen) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.8, rotate: -8 }}
        whileInView={{ opacity: 1, scale: 1, rotate: -3.09 }}
        viewport={{ once: false, amount: 0.8 }}
        transition={{ type: 'spring', stiffness: 260, damping: 18 }}
        whileHover={{ rotate: 0, scale: 1.05 }}
        className={`relative inline-flex select-none cursor-pointer ${className}`}
      >
        {/* Offset dashed border background layer */}
        <span
          className="absolute inset-0 rounded-[70px] border-2 border-dashed border-[#095100] opacity-[0.81]"
          style={{
            transform: 'translate(3.59px, 3.59px)',
            borderStyle: 'dashed',
          }}
          aria-hidden="true"
        />

        {/* Top main pill badge */}
        <span
          className="relative inline-flex items-center gap-[14px] rounded-[70px] bg-[#15B300] px-[17px] py-[10px] text-xs font-semibold text-white shadow-sm sm:text-sm"
          style={{
            borderWidth: '1px 1px 0px 1px',
            borderStyle: 'solid',
            borderColor: '#0C6800A3',
          }}
        >
          <span className="size-2.5 shrink-0 rounded-full bg-white" aria-hidden="true" />
          <span>{children}</span>
        </span>
      </motion.div>
    );
  }

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
