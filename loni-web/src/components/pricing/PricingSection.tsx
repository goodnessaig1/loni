import { MotionConfig, motion } from 'framer-motion';
import { TagBadge } from '../ui/TagBadge';
import { PricingPanel } from './PricingPanel';

const EASE = [0.22, 1, 0.36, 1] as const;
const HEADING_LINES = ['Start free. Get more support', 'when you need it.'];
const INTRO_LINES = [
  'Every mother starts free. When you want more support —',
  'more conversations, human nurses, priority help — LONI Plus',
  'is there.',
];

/** Figma canvas of the desktop composition (1 design px = `--u`). */
const W = 1484;
const H = 1180;

export function PricingSection() {
  return (
    <MotionConfig reducedMotion="user">
      <section aria-labelledby="pricing-title" className="relative overflow-hidden bg-black text-white lg:-mx-5">
        {/* Below lg this is a normal stacked column; from lg it is the absolutely-positioned Figma stage. */}
        <div className="@container relative mx-auto w-full max-w-[1484px] px-5 pb-16 pt-14 sm:px-8 sm:pb-20 sm:pt-20 lg:p-0 lg:[--u:calc(100cqw/1484)]">
          <div className="lg:absolute lg:left-[calc(var(--u)*54)] lg:top-[calc(var(--u)*90)]">
            <TagBadge variant="green">Free vs Plus</TagBadge>
          </div>

          {/* The observer sits on the h2 (never translated); lines are only masked/stacked from lg up. */}
          <motion.h2
            id="pricing-title"
            initial="hide"
            whileInView="show"
            viewport={{ once: false, amount: 0.6 }}
            variants={{ hide: { opacity: 0 }, show: { opacity: 1, transition: { duration: 0.3 } } }}
            className="mt-7 text-[1.75rem] font-semibold leading-[1.3] tracking-[-0.02em] sm:text-4xl lg:absolute lg:left-[calc(var(--u)*52)] lg:top-[calc(var(--u)*171)] lg:mt-0 lg:text-[length:calc(var(--u)*49)] lg:leading-[calc(var(--u)*58)]"
          >
            {HEADING_LINES.map((line, i) => (
              <span key={line}>
                <span className="inline lg:block lg:overflow-hidden lg:whitespace-nowrap lg:pb-[0.08em]">
                  <motion.span
                    className="inline lg:block"
                    variants={{
                      hide: { y: '110%', transition: { duration: 0.3 } },
                      show: { y: 0, transition: { duration: 0.7, delay: i * 0.1, ease: EASE } },
                    }}
                  >
                    {line}
                  </motion.span>
                </span>{' '}
              </span>
            ))}
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: false, amount: 0.6 }}
            transition={{ duration: 0.7, delay: 0.2, ease: EASE }}
            className="mt-5 text-sm leading-7 sm:text-base lg:absolute lg:left-[calc(var(--u)*946)] lg:top-[calc(var(--u)*185)] lg:mt-0 lg:text-[length:calc(var(--u)*17.5)] lg:leading-[calc(var(--u)*34)]"
          >
            {INTRO_LINES.map((line) => (
              <span key={line}>
                <span className="lg:block lg:whitespace-nowrap">{line}</span>{' '}
              </span>
            ))}
          </motion.p>

          <PricingPanel className="mt-10 lg:absolute lg:left-[calc(var(--u)*148)] lg:top-[calc(var(--u)*353)] lg:mt-0 lg:h-[calc(var(--u)*768)] lg:w-[calc(var(--u)*1194)] lg:text-[length:calc(var(--u)*15)]" />

          {/* Reserves the canvas height on desktop (everything above is absolutely positioned). */}
          <div className="hidden lg:block" style={{ aspectRatio: `${W} / ${H}` }} aria-hidden="true" />
        </div>
      </section>
    </MotionConfig>
  );
}
