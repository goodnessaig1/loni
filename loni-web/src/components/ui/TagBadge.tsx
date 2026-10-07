import type { ReactNode } from 'react';
import { motion } from 'framer-motion';

/** Colourways for the filled, dashed-outline sticker badges. */
const STICKERS = {
  green: { body: 'bg-[#55AF33] shadow-[0_3px_0_#47753A]', ring: 'border-[#2F6B1F]/70' },
  pink: { body: 'bg-brand shadow-[0_3px_0_#9E1F66]', ring: 'border-[#7A1148]/60' },
} as const;

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
  variant?: 'default' | 'green' | 'pink';
}) {
  const sticker = variant === 'default' ? null : STICKERS[variant];

  if (sticker) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.8, rotate: -8 }}
        whileInView={{ opacity: 1, scale: 1, rotate: -3.09 }}
        viewport={{ once: false, amount: 0.8 }}
        transition={{ type: 'spring', stiffness: 260, damping: 18 }}
        whileHover={{ rotate: 0, scale: 1.05 }}
        className={`relative inline-flex select-none cursor-pointer ${className}`}
      >
        {/* Dashed outline, nudged down-right of the pill like the Figma sticker. */}
        <span
          className={`absolute -inset-0.5 rounded-full border-[2.5px] border-dashed ${sticker.ring}`}
          style={{ transform: 'translate(1px, 3px)' }}
          aria-hidden="true"
        />

        <span className={`relative inline-flex items-center gap-4 rounded-full px-5 py-3 text-[15px] font-semibold leading-snug tracking-[0.01em] text-white ${sticker.body}`}>
          <span className="size-[7px] shrink-0 rounded-full bg-white" aria-hidden="true" />
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
