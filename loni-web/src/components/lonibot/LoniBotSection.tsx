import { motion, MotionConfig } from 'framer-motion';
import lonibot from '../../assets/lonibot.png';
import lonibotMobile from '../../assets/lonibot-mobile.webp';
import avatars from '../../assets/avatars.webp';
import { TagBadge } from '../ui/TagBadge';

const EASE = [0.22, 1, 0.36, 1] as const;

const BANNER_ALT = "LONI Bot AI interface on phone showing 'What's on your mind today?'";

/**
 * "Used and Tested by 1,000 People": plain avatars + bold text, sitting in the white notch cut into the
 * photo's bottom-left (no pill, no shadow). All sizes are in `cqw` of the banner, so it scales with it.
 */
function TestedBadge({ mobile = false, className = '' }: { mobile?: boolean; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.95 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: false, amount: 0.5 }}
      transition={{ duration: 0.6, delay: 0.35, ease: EASE }}
      className={`flex items-center font-bold leading-[1.15] text-black ${className}`}
      style={{ fontSize: mobile ? '3.7cqw' : 'max(1.17cqw, 10px)', gap: mobile ? '1.6cqw' : '1.26cqw' }}
    >
      <img
        src={avatars}
        alt=""
        draggable={false}
        className="w-auto shrink-0"
        style={{ height: mobile ? '7.1cqw' : 'max(2.8cqw, 22px)' }}
      />
      <span className={mobile ? 'max-w-[44cqw]' : 'whitespace-nowrap'}>Used and Tested by 1,000 People</span>
    </motion.div>
  );
}

/**
 * The "90x" statistic card: translucent white over the photo, no border or shadow. Figures and
 * description are spread top/bottom. Sized in `cqw` so it keeps the design's proportions at any width.
 */
function StatCard({ mobile = false, className = '' }: { mobile?: boolean; className?: string }) {
  const u = (desktop: number, phone: number) => `${mobile ? phone : desktop}cqw`;
  return (
    <motion.div
      initial={{ opacity: 0, x: 24, scale: 0.95 }}
      whileInView={{ opacity: 1, x: 0, scale: 1 }}
      viewport={{ once: false, amount: 0.4 }}
      transition={{ duration: 0.7, delay: 0.4, ease: EASE }}
      className={`flex flex-col justify-between bg-white/80 text-black backdrop-blur-[6px] ${className}`}
      style={{
        borderRadius: u(2.05, 5.3),
        padding: mobile ? '5cqw 5cqw 5.8cqw' : '1.75cqw 1.9cqw 2.4cqw',
        fontSize: u(1.3, 2.95),
      }}
    >
      <div>
        <div className="flex items-start" style={{ gap: u(0.4, 1) }}>
          <span
            className="shrink-0 rounded-full bg-black"
            style={{ width: u(0.8, 1.9), height: u(0.8, 1.9), marginTop: u(1.35, 3.1) }}
            aria-hidden="true"
          />
          <span className="font-light leading-none tracking-tight" style={{ fontSize: u(3.85, 8.8) }}>
            90<span className="font-normal" style={{ fontSize: '0.45em' }}>x</span>
          </span>
        </div>
        <h3 className="font-normal leading-snug" style={{ marginTop: u(0.5, 1.4), fontSize: u(1.68, 3.9) }}>
          More Accurate &amp; Precise
        </h3>
      </div>

      <p className="leading-[1.4]" style={{ maxWidth: u(24, 62) }}>
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
            {/* < lg: the design's own taller crop (its rounded corners and notch are in the image); the stat
                card sits on the photo and the badge in the notch. */}
            <div className="@container relative mx-auto max-w-[34rem] lg:hidden">
              <img
                src={lonibotMobile}
                alt={BANNER_ALT}
                width={396}
                height={364}
                decoding="async"
                draggable={false}
                className="block h-auto w-full select-none"
              />
              <StatCard mobile className="absolute left-[5.4cqw] top-[6cqw] h-[47.9cqw] w-[75.3cqw]" />
              <TestedBadge mobile className="absolute bottom-[1.6cqw] left-[13cqw]" />
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
              <TestedBadge className="absolute bottom-[1.15cqw] left-[7.9cqw]" />
              <StatCard className="absolute bottom-[1.7cqw] right-[1.8cqw] top-[1.8cqw] w-[27.6cqw]" />
            </div>
          </motion.div>
        </div>
      </section>
    </MotionConfig>
  );
}
