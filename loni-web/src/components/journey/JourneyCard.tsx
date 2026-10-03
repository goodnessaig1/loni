import type { CSSProperties } from 'react';
import { motion } from 'framer-motion';

const EASE = [0.22, 1, 0.36, 1] as const;

interface Props {
  step: number;
  title: string;
  /** One entry per line on desktop; flows as a normal paragraph below lg. */
  lines: string[];
  /** Position in the reveal sequence (staggers the entrance). */
  index: number;
  className?: string;
  style?: CSSProperties;
}

/**
 * One white stage card ("1 Pregnancy"). Sized in `em`: set the font-size on the card and the whole
 * thing scales, which is how the desktop stage keeps the Figma proportions. Cards rise in one after
 * another as they enter view and lift slightly on hover.
 */
export function JourneyCard({ step, title, lines, index, className = '', style }: Props) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 56, scale: 0.95 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: false, amount: 0.25 }}
      transition={{ duration: 0.75, delay: (index % 3) * 0.12, ease: EASE }}
      whileHover={{ y: -6 }}
      className={`flex flex-col justify-between rounded-[1.8em] bg-white px-[2em] pb-[2.25em] pt-[1.15em] text-black shadow-[0_1px_0_rgb(255_255_255/0.5)] ${className}`}
      style={style}
    >
      <span className="block text-[5.4em] font-normal leading-none tracking-[-0.02em] lg:text-[8.3em]" aria-hidden="true">
        {step}
      </span>

      <div>
        <h3 className="text-[1.2em] font-medium leading-snug lg:text-[1.41em]">
          <span className="sr-only">{step}. </span>
          {title}
        </h3>
        <p className="mt-[0.7em] text-[0.93em] leading-[1.65] text-neutral-700 lg:mt-[0.95em] lg:text-[1em] lg:leading-[1.65]">
          {lines.map((line) => (
            <span key={line}>
              <span className="lg:block lg:whitespace-nowrap">{line}</span>{' '}
            </span>
          ))}
        </p>
      </div>
    </motion.article>
  );
}
