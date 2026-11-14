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

/** Three little strokes that "spark" off the end of the first headline line. */
function Spark({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 60 56" fill="none" className={className} aria-hidden="true">
      <path d="M14 2 6 30" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <path d="M26 30 14 40" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <path d="M58 26 22 48" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Landing-page hero: a soft blush panel with the headline, store buttons and rating
 * on the left and the portrait over pink hearts on the right.
 *
 * ≥ lg: two columns. The panel reaches up under the header (`-mt-14` + `pt-14`,
 *       3.5rem = the header bar height) so it shows through the header's tab.
 * < lg: one column. The text comes first, then the portrait, with the
 *       "Connected through every step" card overlapping its bottom edge.
 */
export function Hero() {
  return (
    <section
      aria-labelledby="hero-title"
      className="relative overflow-hidden bg-blush lg:-mt-14 lg:min-h-[max(44rem,calc(100svh_-_1.5rem))] lg:rounded-b-[28px] lg:pt-14"
    >
      <div className="relative z-20 px-5 pt-8 sm:px-8 lg:absolute lg:inset-x-0 lg:top-14 lg:px-10 lg:pt-11">
        <SocialPills />
      </div>

      <div className="lg:grid lg:min-h-[inherit] lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        {/* Text */}
        <div className="relative z-20 flex flex-col justify-center px-5 pt-14 pb-10 sm:px-8 sm:pt-16 lg:px-10 lg:pt-28 lg:pb-16 xl:pl-12">
          <motion.p
            {...rise(0.2, 16)}
            className="text-xs font-semibold tracking-wide text-blush-deep uppercase sm:text-[13px]"
          >
            Pregnancy - Birth - Postpartum
          </motion.p>

          <h1
            id="hero-title"
            className="mt-4 text-[2.9rem] leading-[1.05] font-bold tracking-[-0.03em] text-neutral-900 min-[400px]:text-[3.25rem] sm:text-[4rem] lg:text-[clamp(3.4rem,5vw,4.6rem)]"
          >
            <motion.span {...rise(0.3)} className="relative inline-block">
              A Smoother
              <Spark className="absolute -top-[0.55em] -right-[0.95em] size-[0.85em] text-blush-deep" />
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
            className="mt-5 max-w-[26rem] text-base leading-relaxed text-neutral-600 sm:text-[17px] lg:max-w-[30rem]"
          >
            Track, learn, stay connected, and get the support you need all in one place.
          </motion.p>

          <StoreButtons className="mt-7" />
          <Rating className="mt-8" />
        </div>

        {/* Portrait */}
        <div className="relative h-[27rem] min-[480px]:h-[32rem] sm:h-[36rem] md:h-[40rem] lg:h-auto">
          <HeroArt className="absolute inset-0 lg:inset-y-0 lg:right-0 lg:left-[-6%]" />
          <ConnectedCard className="absolute right-4 bottom-5 z-20 sm:right-8 sm:bottom-8 lg:top-6 lg:right-9 lg:bottom-auto" />
        </div>
      </div>
    </section>
  );
}
