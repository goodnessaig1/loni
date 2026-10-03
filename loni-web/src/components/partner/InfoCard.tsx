import type { CSSProperties, ReactNode } from 'react';
import { motion } from 'framer-motion';

interface Props {
  title: string;
  /** One entry per line on desktop; flows as a normal paragraph below lg. */
  lines: string[];
  icon: ReactNode;
  color: string;
  /** Which side the card slides in from. */
  from?: 'left' | 'right';
  delay?: number;
  className?: string;
  style?: CSSProperties;
}

/**
 * Coloured feature card with a black icon badge. Sized in `em` (set the font-size on the card) so the
 * whole thing scales with the desktop stage. Slides in on view, then floats gently.
 */
export function InfoCard({ title, lines, icon, color, from = 'right', delay = 0, className = '', style }: Props) {
  const offset = from === 'right' ? 56 : -56;

  return (
    <motion.div
      initial={{ opacity: 0, x: offset, scale: 0.92 }}
      whileInView={{ opacity: 1, x: 0, scale: 1 }}
      viewport={{ once: false, amount: 0.4 }}
      transition={{ type: 'spring', stiffness: 110, damping: 16, delay }}
      className={className}
      style={style}
    >
      <motion.div
        animate={{ y: [0, -7, 0] }}
        transition={{ duration: 5 + delay * 2, repeat: Infinity, ease: 'easeInOut' }}
        className="relative size-full rounded-[2.3em] px-[1.35em] pb-[1.2em] pt-[1.1em] text-white shadow-[0_18px_40px_-18px_rgb(0_0_0/0.35)]"
        style={{ backgroundColor: color }}
      >
        <span className="absolute right-[1.3em] top-[1.25em] inline-flex size-[2.05em] items-center justify-center rounded-full bg-black text-white">
          <span className="size-[1.2em] [&>svg]:size-full">{icon}</span>
        </span>

        <h3 className="pr-[3em] text-[1.13em] font-medium leading-[1.5]">{title}</h3>
        <p className="mt-[0.65em] leading-[1.65]">
          {lines.map((line) => (
            <span key={line}>
              <span className="lg:block lg:whitespace-nowrap">{line}</span>{' '}
            </span>
          ))}
        </p>
      </motion.div>
    </motion.div>
  );
}
