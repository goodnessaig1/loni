import { motion, MotionConfig } from 'framer-motion';
import lonibot from '../../assets/lonibot.png';
import avatars from '../../assets/avatars.webp';
import { TagBadge } from '../ui/TagBadge';

const EASE = [0.22, 1, 0.36, 1] as const;

const BANNER_ALT = "LONI Bot AI interface on phone showing 'What's on your mind today?'";

/** "Used and Tested by 1,000 People". `compact` is the plain, two-line version that sits in the phone notch. */
function TestedBadge({ compact = false, className = '' }: { compact?: boolean; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.95 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: false, amount: 0.5 }}
      transition={{ duration: 0.6, delay: 0.35, ease: EASE }}
      className={className}
    >
      {compact ? (
        <div className="flex items-center gap-2 text-[11.5px] font-semibold leading-tight text-neutral-950">
          <img src={avatars} alt="" className="h-6 w-auto shrink-0" draggable={false} />
          <span className="max-w-[8.5rem]">Used and Tested by 1,000 People</span>
        </div>
      ) : (
        <div className="inline-flex items-center gap-[1.3em] rounded-full border border-neutral-100/90 bg-white px-[1.6em] py-[0.9em] text-[1em] font-semibold text-neutral-900 shadow-md">
          <img src={avatars} alt="" className="h-[1.75em] w-auto shrink-0" draggable={false} />
          <span className="whitespace-nowrap">Used and Tested by 1,000 People</span>
        </div>
      )}
    </motion.div>
  );
}

/** The "90x" statistic card. `compact` is the smaller one that overlaps the photo on phones. */
function StatCard({ compact = false, className = '' }: { compact?: boolean; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 24, scale: 0.95 }}
      whileInView={{ opacity: 1, x: 0, scale: 1 }}
      viewport={{ once: false, amount: 0.4 }}
      transition={{ duration: 0.7, delay: 0.4, ease: EASE }}
      className={`border border-neutral-100 bg-white/95 backdrop-blur-md ${
        compact ? 'rounded-[1.4rem] p-[1.4em] text-[13px] shadow-lg' : 'rounded-[1.75rem] p-7 shadow-xl'
      } ${className}`}
    >
      <div className="flex items-center gap-2.5">
        <span className={`shrink-0 rounded-full bg-black ${compact ? 'size-2' : 'size-2.5'}`} aria-hidden="true" />
        <span
          className={`font-light tracking-tight text-neutral-950 ${compact ? 'text-[2.6em] leading-none' : 'text-5xl'}`}
        >
          90<span className={`font-normal ${compact ? 'text-[0.65em]' : 'text-3xl'}`}>x</span>
        </span>
      </div>

      <h3
        className={`font-semibold leading-snug text-neutral-900 ${compact ? 'mt-[0.7em] text-[1.1em] font-medium' : 'mt-2 text-lg'}`}
      >
        More Accurate &amp; Precise
      </h3>

      <p className={`leading-relaxed text-neutral-600 ${compact ? 'mt-[2em] text-[0.95em] text-neutral-800' : 'mt-12 text-sm'}`}>
        LONI Bot helps understanding common symptoms and what to watch for.
      </p>
    </motion.div>
  );
}

export function LoniBotSection() {
  return (
    <MotionConfig reducedMotion="user">
      <section
        aria-labelledby="lonibot-title"
        className="relative overflow-hidden bg-white text-neutral-900 lg:-mx-3"
      >
        <div className="mx-auto max-w-[90rem] px-5 py-16 sm:px-8 sm:py-20 lg:px-14 lg:py-24">
          {/* Header grid */}
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1.2fr)_1fr] lg:items-end lg:gap-12">
            <div>
              <TagBadge variant="green">LONI Bot</TagBadge>
              <motion.h2
                id="lonibot-title"
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: false, amount: 0.4 }}
                transition={{ duration: 0.7, delay: 0.1, ease: EASE }}
                className="mt-6 text-[2.25rem] font-bold leading-[1.18] tracking-tight text-neutral-950 sm:text-4xl lg:text-[2.85rem] lg:leading-[1.2]"
              >
                We provide an AI companion for the questions that can&apos;t wait.
              </motion.h2>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: false, amount: 0.4 }}
              transition={{ duration: 0.7, delay: 0.2, ease: EASE }}
              className="flex flex-col gap-6 lg:pb-1"
            >
              <p className="max-w-[32rem] text-base leading-[1.75] text-neutral-600 sm:text-lg">
                Loni is here whenever a question comes to mind, day or night. It offers support and guidance so you can
                feel less alone with the uncertainty.
              </p>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  className="inline-flex items-center rounded-full border border-neutral-800 bg-white px-5 py-2.5 text-sm font-semibold text-neutral-900 shadow-sm transition-all hover:bg-neutral-900 hover:text-white"
                >
                  Pregnancy Questions
                </button>
                <button
                  type="button"
                  className="inline-flex items-center rounded-full border border-neutral-800 bg-white px-5 py-2.5 text-sm font-semibold text-neutral-900 shadow-sm transition-all hover:bg-neutral-900 hover:text-white"
                >
                  Daily Support
                </button>
              </div>
            </motion.div>
          </div>

          {/* Feature banner. Phones get the cropped, taller frame from the mobile design; lg+ the wide one. */}
          <motion.div
            initial={{ opacity: 0, y: 32, scale: 0.98 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: false, amount: 0.25 }}
            transition={{ duration: 0.8, delay: 0.15, ease: EASE }}
            className="mt-12 lg:mt-16"
          >
            {/* < lg: a near-square crop on the phone; the stat card sits on the photo and the badge in a notch. */}
            <div className="relative mx-auto aspect-[1.09] max-w-[34rem] overflow-hidden rounded-[1.75rem] lg:hidden">
              <img
                src={lonibot}
                alt={BANNER_ALT}
                width={1348}
                height={410}
                loading="lazy"
                decoding="async"
                draggable={false}
                className="absolute inset-0 size-full select-none object-cover object-[74%_center]"
              />
              <StatCard compact className="absolute left-[5%] top-[7%] w-[76%]" />
              <div aria-hidden="true" className="absolute bottom-0 left-[10%] right-[18%] h-[14%] rounded-t-[1.1rem] bg-white" />
              <TestedBadge compact className="absolute bottom-[2%] left-[12.5%]" />
            </div>

            {/* ≥ lg: the wide banner. `@container` so the badge scales with it (cqw units). */}
            <div className="@container relative hidden lg:block">
              <img
                src={lonibot}
                alt={BANNER_ALT}
                width={1348}
                height={410}
                loading="lazy"
                decoding="async"
                draggable={false}
                className="block h-auto w-full select-none"
              />
              {/* The photo's bottom-left cut-out (x 6.7%–34.9%, bottom 17%) holds the badge, scaled with the banner. */}
              <TestedBadge className="absolute bottom-[1.15cqw] left-[8.6cqw] text-[length:max(0.85cqw,9px)]" />
              <StatCard className="absolute right-8 top-1/2 w-[22rem] -translate-y-1/2" />
            </div>
          </motion.div>
        </div>
      </section>
    </MotionConfig>
  );
}
