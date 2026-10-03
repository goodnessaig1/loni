import type { Variants } from 'framer-motion';

const easeOut = [0.22, 1, 0.36, 1] as const;
const easeIn = [0.4, 0, 1, 1] as const;

/**
 * Every animated part of the showcase uses the same two variant names.
 * The stage runs `whileInView="show"`, so scrolling into view plays "show"
 * and scrolling back out plays "hide" - a true in/out animation, repeatable.
 */
export const stageVariants: Variants = { hide: {}, show: {} };

export const phoneVariants: Variants = {
  hide: { opacity: 0, y: 90, scale: 0.94, transition: { duration: 0.45, ease: easeIn } },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.9, ease: easeOut, delay: 0.05 } },
};

export const hubVariants: Variants = {
  hide: { opacity: 0, scale: 0.4, transition: { duration: 0.35, ease: easeIn } },
  show: { opacity: 1, scale: 1, transition: { duration: 0.8, ease: easeOut, delay: 0.1 } },
};

export const badgeVariants: Variants = {
  hide: { opacity: 0, scale: 0.5, y: 10, transition: { duration: 0.25 } },
  show: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 380, damping: 18, delay: 0.55 },
  },
};

/** A road "lays itself out" from the phone outwards, then fades back in on the way out. */
const ROAD_START = 0.3;
const ROAD_STAGGER = 0.14;
export const roadDelay = (index: number) => ROAD_START + index * ROAD_STAGGER;

export function roadVariants(side: 'left' | 'right', index: number): Variants {
  const collapsed = 'inset(0% 50% 0% 50%)';
  const open = side === 'left' ? 'inset(0% 50% 0% -10%)' : 'inset(0% -10% 0% 50%)';
  return {
    hide: { clipPath: collapsed, opacity: 0, transition: { duration: 0.45, ease: easeIn } },
    show: { clipPath: open, opacity: 1, transition: { duration: 1.15, ease: easeOut, delay: roadDelay(index) } },
  };
}

export const labelVariants = (index: number): Variants => ({
  hide: { opacity: 0, transition: { duration: 0.2 } },
  show: { opacity: 1, transition: { duration: 0.6, delay: roadDelay(index) + 0.7 } },
});

export const fadeVariants = (index: number): Variants => ({
  hide: { opacity: 0, transition: { duration: 0.3 } },
  show: { opacity: 1, transition: { duration: 0.8, delay: roadDelay(index) } },
});
