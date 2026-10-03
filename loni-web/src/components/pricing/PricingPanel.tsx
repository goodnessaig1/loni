import { motion } from 'framer-motion';
import { Star } from 'lucide-react';
import { SITE } from '../../config/site';
import logoDark from '../../assets/pricing/logo-dark.webp';
import logoLight from '../../assets/pricing/logo-light.webp';
import { CountUp } from './CountUp';
import { Feature, Price } from './PlanParts';

const EASE = [0.22, 1, 0.36, 1] as const;

const FREE_FEATURES = ['AI Nurse — limited daily questions', 'Pregnancy Journey Tracker', 'Daily pregnancy tips'];
const PLUS_FEATURES = [
  '7 Days free trial',
  'Unlimited Loni AI conversations',
  'Priority Emergency ride dispatch',
  'Personalized pregnancy insights',
  'Unlimited personalized nutrition plans',
  'and many more',
];

/** Plan logo, a 55 × 33 crop of the brand mark. */
function PlanLogo({ src }: { src: string }) {
  return <img src={src} alt="LONI" width={55} height={33} draggable={false} className="h-[2.2em] w-auto select-none self-start" />;
}

function FreePlan() {
  return (
    <div className="flex flex-col lg:absolute lg:bottom-[4.67em] lg:left-[4.87em] lg:top-[4.67em] lg:w-[30.6em]">
      <PlanLogo src={logoLight} />
      <h3 className="mt-[1.15em] text-[1.6em] font-semibold leading-[1.3]">Free</h3>
      <p className="mt-[0.9em] leading-[1.4] text-white/90 lg:max-w-[17.4em]">Everything you need to begin your journey.</p>

      <div className="mt-[0.8em]">
        <Price fadedClass="text-white/45">0</Price>
      </div>

      <hr className="mt-[2.5em] border-0 border-t border-white/40" />
      <h4 className="mt-[1.8em] text-[0.97em] font-semibold">What’s included:</h4>
      <ul className="mt-[1.27em] flex flex-col gap-[1.13em] text-[0.97em]">
        {FREE_FEATURES.map((f, i) => (
          <Feature key={f} index={i} badgeClass="size-[1.52em] bg-white/25 text-white">
            {f}
          </Feature>
        ))}
      </ul>

      <motion.a
        href={SITE.downloadHref}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className="mt-8 inline-flex h-[3.7em] items-center justify-center rounded-full bg-white text-[1.07em] font-semibold text-brand lg:mt-auto lg:h-[3.93em]"
      >
        Get Started
      </motion.a>
    </div>
  );
}

function PlusPlan() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 60, scale: 0.96 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: false, amount: 0.2 }}
      transition={{ duration: 0.85, delay: 0.15, ease: EASE }}
      className="mt-5 flex flex-col rounded-[1.4rem] bg-white px-5 pb-6 pt-5 text-black lg:absolute lg:bottom-[1.73em] lg:right-[1.67em] lg:top-[1.8em] lg:mt-0 lg:w-[36.9em] lg:rounded-[4.2em] lg:px-[3.2em] lg:pb-[2.9em] lg:pt-[2.87em]"
    >
      <div className="flex items-start justify-between">
        <PlanLogo src={logoDark} />
        <motion.span
          initial={{ opacity: 0, scale: 0.6 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: false, amount: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 16, delay: 0.7 }}
          className="inline-flex items-center gap-[0.55em] rounded-full border border-neutral-200 bg-white px-[1.1em] py-[0.55em] text-[0.97em] font-medium text-neutral-500 shadow-[0_0_0_3px_rgb(0_0_0/0.04)] lg:-translate-y-[0.2em]"
        >
          <Star className="size-[1.05em] fill-[#F5A524] text-[#F5A524]" aria-hidden="true" />
          Most Popular
        </motion.span>
      </div>

      <h3 className="mt-[1.15em] text-[1.6em] font-semibold leading-[1.3]">LONI Plus</h3>
      <p className="mt-[0.9em] leading-[1.4] text-neutral-800 lg:max-w-[18em]">More support, exactly when you need it.</p>

      <div className="mt-[0.8em]">
        <Price fadedClass="text-neutral-300">
          <CountUp value={5900} />
        </Price>
      </div>

      <hr className="mt-[2.5em] border-0 border-t border-neutral-300 lg:w-[28.5em]" />
      <h4 className="mt-[1.8em] text-[0.97em] font-semibold">All Starter features, plus:</h4>
      <ul className="mt-[1.27em] flex flex-col gap-[1.13em] text-[0.97em] text-neutral-800">
        {PLUS_FEATURES.map((f, i) => (
          <Feature key={f} index={i} badgeClass="size-[1.4em] bg-neutral-100 text-black">
            {f}
          </Feature>
        ))}
      </ul>

      <motion.a
        href={SITE.downloadHref}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className="mt-8 inline-flex h-[3.7em] items-center justify-center rounded-full bg-black text-[1.07em] font-semibold text-white lg:mt-auto lg:h-[3.9em]"
      >
        Start Free 7-Day Trial
      </motion.a>
    </motion.div>
  );
}

/** The pink panel holding both plans. Font-size set by the parent; everything inside scales in `em`. */
export function PricingPanel({ className = '' }: { className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 70 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: false, amount: 0.1 }}
      transition={{ duration: 0.9, ease: EASE }}
      className={`relative rounded-[1.8rem] bg-brand p-5 text-[14px] text-white lg:rounded-[4.7em] lg:p-0 ${className}`}
    >
      <FreePlan />
      <PlusPlan />
    </motion.div>
  );
}
