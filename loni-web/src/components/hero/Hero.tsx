'use client';

import { motion } from 'framer-motion';
import { ConnectedCard } from './ConnectedCard';
import { HeroArt } from './HeroArt';
import { Rating } from './Rating';
import { SocialPills } from './SocialPills';
import { StoreButtons } from './StoreButtons';

const rise = (delay: number, y = 30) => ({
  initial: { opacity: 0, y },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] as const },
});

/** The three strokes that "spark" off the end of "A Smoother" (77 × 108 in the design). */
function Spark({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 77 108" fill="none" className={className} aria-hidden="true">
      <g stroke="currentColor" strokeWidth="3.6" strokeLinecap="round">
        <path d="M19 2 2 76" />
        <path d="M33 65 9 89" />
        <path d="M75 85 13 106" />
      </g>
    </svg>
  );
}

/**
 * Landing-page hero, built from the Figma frame "Frame 1707481249" (1418 × 885).
 *
 * ≥ lg: the panel is a size container and every placement uses the design's numbers in
 *       `cqw` of its width (1 design px = 100 / 1418 cqw), so at a 1440 px window it lands
 *       on the design pixel for pixel and keeps its proportions on smaller or larger screens.
 *       It reaches up under the header (`-mt-14`) so it shows through the header's tab.
 * < lg: one column, as in the mobile design: text first, then the artwork with the
 *       "Connected through every step" card over its lower edge.
 */
export function Hero() {
  return (
    <section
      aria-labelledby="hero-title"
      className="relative overflow-hidden bg-blush lg:@container lg:-mt-14 lg:rounded-b-[23px]"
    >
      <div className="relative lg:h-[max(62.41cqw,52rem)]">
        {/* Instagram / Support pills: (38, 96) */}
        <div className="relative z-20 px-4 pt-9 sm:px-8 lg:absolute lg:top-[96px] lg:left-[38px] lg:p-0">
          <SocialPills />
        </div>

        {/* Text column ("Frame 1707481089"): 589 wide at (38, 265) */}
        <div className="relative z-20 px-4 pt-24 pb-12 font-inter sm:px-8 sm:pt-28 lg:absolute lg:top-[max(13rem,18.69cqw)] lg:left-[38px] lg:w-[589px] lg:p-0">
          <motion.p
            {...rise(0.2, 16)}
            className="text-sm leading-[29px] font-semibold tracking-[-0.2px] text-blush-deep uppercase"
          >
            Pregnancy - Birth - Postpartum
          </motion.p>

          <h1
            id="hero-title"
            className="mt-2.5 text-[2.85rem] leading-[1.013] font-bold tracking-[-0.026em] text-black min-[400px]:text-[3.15rem] sm:text-[4.25rem] lg:text-[clamp(3.6rem,5.5cqw,4.875rem)]"
          >
            <motion.span {...rise(0.3)} className="relative inline-block">
              A Smoother
              <Spark className="absolute top-[-0.22em] left-[calc(100%+0.25em)] h-[1.385em] w-auto text-blush-deep" />
            </motion.span>
            <motion.span {...rise(0.38)} className="block text-blush-deep">
              Motherhood
            </motion.span>
            <motion.span {...rise(0.46)} className="block">
              Journey
            </motion.span>
          </h1>

          <motion.p
            {...rise(0.52, 20)}
            className="mt-[21px] max-w-[488px] text-base leading-[29px] font-medium tracking-[-0.2px] text-slate-ink"
          >
            Track, learn, stay connected, and get the support you need all in one place.
          </motion.p>

          <StoreButtons className="mt-[21px]" />
          <Rating className="mt-[29px]" />
        </div>

        {/* Artwork ("Frame 2147226883"): 931 × 1065 at (487, 33); she runs 213 px past the bottom. */}
        {/* < lg: the artwork is drawn wider than the screen and cropped across her belly, as in the mobile design. */}
        <div className="relative h-[min(111vw,46rem)] overflow-hidden lg:static lg:h-auto lg:overflow-visible">
          <div className="absolute top-0 left-1/2 w-[150vw] max-w-[62rem] -translate-x-[54%] lg:top-auto lg:bottom-[-15.02cqw] lg:left-[34.34cqw] lg:w-[65.66cqw] lg:max-w-none lg:translate-x-0">
            <HeroArt className="relative w-full" />
          </div>
          <ConnectedCard className="absolute right-4 bottom-5 z-20 sm:right-8 sm:bottom-8 lg:hidden" />
        </div>

        {/* "Connected through every step": 282 × 115 at (1096, 85) */}
        <ConnectedCard className="absolute top-[5.99cqw] right-[2.82cqw] z-20 hidden lg:flex" />
      </div>
    </section>
  );
}
