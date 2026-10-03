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

          {/* Feature Banner Graphic */}
          <motion.div
            initial={{ opacity: 0, y: 32, scale: 0.98 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: false, amount: 0.25 }}
            transition={{ duration: 0.8, delay: 0.15, ease: EASE }}
            className="relative mt-12 overflow-hidden rounded-[2rem] sm:rounded-[2.5rem] lg:mt-16"
          >
            {/* Feature Image background */}
            <div className="relative w-full overflow-hidden">
              <img
                src={lonibot}
                alt="LONI Bot AI interface on phone showing 'What's on your mind today?'"
                width={1348}
                height={410}
                loading="lazy"
                decoding="async"
                draggable={false}
                className="h-auto w-full select-none object-cover"
              />

              {/* Bottom-left badge over the transparent notch cut-out */}
              <motion.div
                initial={{ opacity: 0, y: 16, scale: 0.95 }}
                whileInView={{ opacity: 1, y: 0, scale: 1 }}
                viewport={{ once: false, amount: 0.5 }}
                transition={{ duration: 0.6, delay: 0.35, ease: EASE }}
                className="absolute bottom-2.5 left-2.5 sm:bottom-4 sm:left-4 lg:bottom-5 lg:left-6"
              >
                <div className="inline-flex items-center gap-3 rounded-full bg-white px-4 py-2 text-xs font-semibold text-neutral-900 shadow-md sm:px-5 sm:py-2.5 sm:text-sm border border-neutral-100/80">
                  <img src={avatars} alt="" className="h-5 sm:h-6 w-auto shrink-0" draggable={false} />
                  <span>Used and Tested by 1,000 People</span>
                </div>
              </motion.div>

              {/* Right side floating statistic card */}
              <motion.div
                initial={{ opacity: 0, x: 24, scale: 0.95 }}
                whileInView={{ opacity: 1, x: 0, scale: 1 }}
                viewport={{ once: false, amount: 0.4 }}
                transition={{ duration: 0.7, delay: 0.4, ease: EASE }}
                className="right-4 top-1/2 mt-6 max-w-sm rounded-[1.75rem] border border-neutral-100 bg-white/95 p-6 shadow-xl backdrop-blur-md sm:right-6 sm:p-7 sm:mt-0 lg:absolute lg:right-8 lg:mt-0 lg:-translate-y-1/2 lg:w-[22rem]"
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
            </div>
          </motion.div>
        </div>
      </section>
    </MotionConfig>
  );
}
