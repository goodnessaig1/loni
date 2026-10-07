import { MotionConfig, motion } from 'framer-motion';
import { ArrowDown, ArrowRight } from 'lucide-react';
import heroPhoto from '../../assets/drivers/hero.webp';
import { SITE } from '../../config/site';
import { TripCard } from './TripCard';

const EASE = [0.22, 1, 0.36, 1] as const;
const HEADING_LINES = ['Help a mother get', 'where she needs to be.'];

/** The Figma vignette: transparent around the driver's face, black toward the edges. */
const VIGNETTE = 'radial-gradient(61.64% 60.72% at 62.02% 39.28%, rgba(0,0,0,0) 0%, #000 100%)';

/**
 * "For Drivers" hero.
 *
 * The photo carries its own outline in its alpha channel: rounded corners, plus a raised "tab" along
 * the top that lines up with the header's gap. It is used as a mask, so the vignette is clipped to the
 * same silhouette. Its transparent top band is 6.08% of its height:
 *  - ≥ lg the hero reaches up under the header (`-mt-14`), a black strip fills the header tab, and the
 *    photo starts exactly under the header (the `top` calc solves band = 6.08% of the photo's height);
 *  - < lg the header is a separate white bar, so the band (and the rounded top corners) are pushed out
 *    of view above the hero.
 */
export function DriverHero() {
  return (
    <MotionConfig reducedMotion="user">
      <section
        aria-labelledby="driver-hero-title"
        className="relative flex min-h-[45.6rem] flex-col overflow-hidden rounded-b-[1.5rem] md:min-h-[52rem] lg:-mt-14 lg:min-h-[max(44rem,calc(100svh_-_2.5rem))] lg:rounded-b-[28px]"
      >
        {/* Fills the header's tab (the gap between its two white plates). */}
        <div aria-hidden="true" className="absolute inset-x-0 top-0 hidden h-14 bg-black lg:block" />

        <motion.div
          aria-hidden="true"
          initial={{ scale: 1.06, opacity: 0.5 }}
          whileInView={{ scale: 1, opacity: 1 }}
          viewport={{ once: false, amount: 0.3 }}
          transition={{ duration: 1.6, ease: EASE }}
          className="absolute inset-x-0 bottom-0 top-[-8.5%] [background-position:0_0,38%_0] [background-repeat:no-repeat] [background-size:100%_100%,cover] [mask-position:38%_0] [mask-repeat:no-repeat] [mask-size:cover] lg:top-[calc(3.5rem-0.0647*(100%-3.5rem))] lg:[background-position:0_0,50%_0] lg:[mask-position:50%_0]"
          style={{
            backgroundImage: `${VIGNETTE}, url(${heroPhoto})`,
            maskImage: `url(${heroPhoto})`,
            WebkitMaskImage: `url(${heroPhoto})`,
          }}
        />

        <div className="relative z-10 flex flex-1 flex-col px-4 pb-[0.95rem] pt-[8.1rem] text-[14px] text-white sm:px-8 lg:static lg:p-0 lg:text-[min(1.2vw,1.35rem)]">
          <div className="lg:absolute lg:left-[3.5%] lg:top-[21.2%]">
            <motion.span
              initial={{ opacity: 0, scale: 0.85, y: 12 }}
              whileInView={{ opacity: 1, scale: 1, y: 0 }}
              viewport={{ once: false, amount: 0.8 }}
              transition={{ type: 'spring', stiffness: 260, damping: 20 }}
              className="inline-flex h-[2.3em] items-center rounded-full border-x border-white bg-black px-[2.05em] text-[0.85em] font-bold"
            >
              For Drivers
            </motion.span>

            {/* The observer sits on the h1 (never translated); the lines slide up from behind a mask. */}
            <motion.h1
              id="driver-hero-title"
              initial="hide"
              whileInView="show"
              viewport={{ once: false, amount: 0.6 }}
              className="mt-[0.9em] max-w-[15.6rem] text-[2.9rem] font-semibold leading-none tracking-[-0.03em] sm:max-w-[30rem] lg:mt-[0.9em] lg:max-w-none lg:text-[3.87em] lg:leading-[0.95] lg:tracking-[-0.035em]"
            >
              {HEADING_LINES.map((line, i) => (
                <span key={line} className="block overflow-hidden pb-[0.08em]">
                  <motion.span
                    className="block"
                    variants={{
                      hide: { y: '110%', transition: { duration: 0.3 } },
                      show: { y: 0, transition: { duration: 0.8, delay: 0.1 + i * 0.12, ease: EASE } },
                    }}
                  >
                    {line}
                  </motion.span>
                </span>
              ))}
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: false, amount: 0.6 }}
              transition={{ duration: 0.7, delay: 0.4, ease: EASE }}
              className="mt-[1.3em] max-w-[17rem] leading-snug sm:max-w-md lg:max-w-none lg:text-[1.08em]"
            >
              Help LONI mums get to the hospital safe, fast and happy.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: false, amount: 0.6 }}
              transition={{ duration: 0.7, delay: 0.55, ease: EASE }}
              className="mt-[2.4em] flex flex-col items-start gap-[0.5em] lg:flex-row"
            >
              <a
                href={SITE.driverHowItWorksHref}
                className="group inline-flex h-[2.85em] items-center gap-[0.7em] rounded-full bg-white px-[2.1em] text-[0.97em] font-medium text-[#0b2a26] transition-transform hover:scale-[1.03] active:scale-[0.97] lg:h-[2.95em] lg:text-[1em]"
              >
                How it works
                <ArrowDown
                  className="size-[1.25em] transition-transform duration-200 group-hover:translate-y-0.5"
                  strokeWidth={2}
                  aria-hidden="true"
                />
              </a>
              <a
                href={SITE.driverSignupHref}
                className="group inline-flex h-[2.85em] items-center gap-[0.7em] rounded-full bg-brand px-[2em] text-[0.97em] font-medium text-white transition-transform hover:scale-[1.03] active:scale-[0.97] lg:h-[2.95em] lg:text-[1em]"
              >
                Join LONI as a Driver
                <ArrowRight
                  className="size-[1.25em] transition-transform duration-200 group-hover:translate-x-1"
                  strokeWidth={2}
                  aria-hidden="true"
                />
              </a>
            </motion.div>
          </div>

          <TripCard className="mt-auto w-[72%] self-end text-[12px] sm:w-[60%] lg:absolute lg:bottom-[5.7%] lg:right-[2.1%] lg:mt-0 lg:w-[31.9%] lg:text-[min(1.24vw,1.4rem)]" />
        </div>
      </section>
    </MotionConfig>
  );
}
