import type { CSSProperties, ElementType } from 'react';
import { motion } from 'framer-motion';

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * Text that fades, rises and un-blurs word by word as it scrolls into view (and reverses on the way
 * out). `lines` are laid out as separate block lines from `lg` up, and flow as one paragraph below.
 * The observer sits on the wrapper, which never moves, so it always fires.
 */
export function WordReveal({
  lines,
  as = 'p',
  id,
  className = '',
  style,
  stagger = 0.06,
  duration = 1.25,
}: {
  lines: string[];
  as?: 'p' | 'h2';
  id?: string;
  className?: string;
  style?: CSSProperties;
  stagger?: number;
  duration?: number;
}) {
  const Tag = motion[as] as ElementType;
  let index = 0;

  return (
    <Tag
      id={id}
      initial="hide"
      whileInView="show"
      viewport={{ once: false, amount: 0.35 }}
      variants={{ hide: { transition: { staggerChildren: 0.01, staggerDirection: -1 } }, show: {} }}
      className={className}
      style={style}
    >
      {lines.map((line) => (
        <span key={line} className="lg:block lg:whitespace-nowrap">
          {line.split(' ').map((word) => {
            const i = index++;
            return (
              <span key={`${i}-${word}`}>
                <motion.span
                  className="inline-block will-change-transform"
                  variants={{
                    hide: { opacity: 0, y: '0.5em', filter: 'blur(8px)', transition: { duration: 0.4 } },
                    show: {
                      opacity: 1,
                      y: 0,
                      filter: 'blur(0px)',
                      transition: { duration, delay: i * stagger, ease: EASE },
                    },
                  }}
                >
                  {word}
                </motion.span>{' '}
              </span>
            );
          })}
        </span>
      ))}
    </Tag>
  );
}
