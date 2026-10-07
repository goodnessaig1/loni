import { motion, MotionConfig } from 'framer-motion';
import lonibot from '../../assets/lonibot.png';
import avatars from '../../assets/avatars.webp';
import { TagBadge } from '../ui/TagBadge';

const EASE = [0.22, 1, 0.36, 1] as const;

export function LoniBotSection() {
  return (
    <MotionConfig reducedMotion="user">
      <section
        aria-labelledby="lonibot-title"
        className="relative overflow-hidden bg-white text-neutral-900 lg:-mx-5"
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

          {/* Feature Banner Graphic. `@container` so the badge can scale with the banner (cqw units). */}
          <motion.div
            initial={{ opacity: 0, y: 32, scale: 0.98 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: false, amount: 0.25 }}
            transition={{ duration: 0.8, delay: 0.15, ease: EASE }}
            className="@container relative mt-12 lg:mt-16"
          >
            <img
              src={lonibot}
              alt="LONI Bot AI interface on phone showing 'What's on your mind today?'"
              width={1348}
              height={410}
              loading="lazy"
              decoding="async"
              draggable={false}
              className="block h-auto w-full select-none"
            />

            {/*
              The photo has a cut-out in its bottom-left corner (x 6.7%–34.9%, bottom 17%). From lg the
              badge sits wholly inside it, scaled with the banner; below lg the cut-out is too small, so
              the badge drops under the photo instead of straddling the edge.
            */}
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.95 }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              viewport={{ once: false, amount: 0.5 }}
              transition={{ duration: 0.6, delay: 0.35, ease: EASE }}
              className="mt-4 lg:absolute lg:bottom-[1.15cqw] lg:left-[8.6cqw] lg:mt-0 lg:text-[length:max(0.85cqw,9px)]"
            >
              <div className="inline-flex items-center gap-2.5 rounded-full border border-neutral-100/90 bg-white px-4 py-2 text-xs font-semibold text-neutral-900 shadow-md lg:gap-[1.3em] lg:px-[1.6em] lg:py-[0.9em] lg:text-[1em]">
                <img src={avatars} alt="" className="h-5.5 w-auto shrink-0 lg:h-[1.75em]" draggable={false} />
                <span className="whitespace-nowrap">Used and Tested by 1,000 People</span>
              </div>
            </motion.div>

            {/* Right side floating statistic card */}
            <motion.div
              initial={{ opacity: 0, x: 24, scale: 0.95 }}
              whileInView={{ opacity: 1, x: 0, scale: 1 }}
              viewport={{ once: false, amount: 0.4 }}
              transition={{ duration: 0.7, delay: 0.4, ease: EASE }}
              className="mt-6 max-w-sm rounded-[1.75rem] border border-neutral-100 bg-white/95 p-6 shadow-xl backdrop-blur-md sm:p-7 lg:absolute lg:right-8 lg:top-1/2 lg:mt-0 lg:w-[22rem] lg:-translate-y-1/2"
            >
              <div className="flex items-center gap-2.5">
                <span className="size-2.5 shrink-0 rounded-full bg-black" aria-hidden="true" />
                <span className="text-4xl font-light tracking-tight text-neutral-950 sm:text-5xl">
                  90<span className="text-2xl font-normal sm:text-3xl">x</span>
                </span>
              </div>

              <h3 className="mt-2 text-base font-semibold leading-snug text-neutral-900 sm:text-lg">
                More Accurate &amp; Precise
              </h3>

              <p className="mt-8 text-xs leading-relaxed text-neutral-600 sm:mt-12 sm:text-sm">
                LONI Bot helps understanding common symptoms and what to watch for.
              </p>
            </motion.div>
          </motion.div>
        </div>
      </section>
    </MotionConfig>
  );
}
