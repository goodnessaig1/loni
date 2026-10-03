import type { CSSProperties } from 'react';
import { MotionConfig, motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { SITE } from '../../config/site';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { ArrowPillButton } from '../ui/ArrowPillButton';
import { TagBadge } from '../ui/TagBadge';
import { px } from '../showcase/designUnits';
import { NurseCardStack } from './NurseCardStack';
import { TextRibbon } from './TextRibbon';
import { DESKTOP_RIBBON, MOBILE_RIBBON } from './ribbonPath';

const EASE = [0.22, 1, 0.36, 1] as const;
const HEADING_LINES = ['We know some', 'moments call for', 'a human.'];
const PILLS = ['Human Voice Support', 'Your Privacy Protected'];
const PARAGRAPH_LINES = [
  'When you need more than an AI answer, LONI',
  'connects you with a nurse through a voice call.',
  'No typing it out, no waiting,  just a real person',
  'who listens and supports you.',
];

/** Figma canvas of the desktop composition (the card is 446 × 825 inside it). */
const W = 1624;
const H = 1122;

const at = (x: number, y: number, extra?: CSSProperties): CSSProperties => ({
  position: 'absolute',
  left: px(x),
  top: px(y),
  ...extra,
});

function Heading({ className = '', style }: { className?: string; style?: CSSProperties }) {
  return (
    // The observer sits on the h2 (never translated) - observing the masked inner lines would never fire.
    <motion.h2
      id="nurse-title"
      initial="hide"
      whileInView="show"
      viewport={{ once: false, amount: 0.6 }}
      className={`font-semibold tracking-[-0.02em] text-black ${className}`}
      style={style}
    >
      {HEADING_LINES.map((line, i) => (
        <span key={line} className="block overflow-hidden whitespace-nowrap pb-[0.08em]">
          <motion.span
            className="block"
            variants={{
              hide: { y: '110%', transition: { duration: 0.3 } },
              show: { y: 0, transition: { duration: 0.7, delay: i * 0.1, ease: EASE } },
            }}
          >
            {line}
          </motion.span>
        </span>
      ))}
    </motion.h2>
  );
}

function Pills({ className = '', style }: { className?: string; style?: CSSProperties }) {
  return (
    <div className={`flex flex-col items-start ${className}`} style={style}>
      {PILLS.map((label, i) => (
        <motion.span
          key={label}
          initial={{ opacity: 0, x: -24 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: false, amount: 0.8 }}
          transition={{ duration: 0.55, delay: 0.25 + i * 0.1, ease: EASE }}
          className="inline-flex h-[2.55em] items-center rounded-full border-[1.5px] border-black bg-white px-[2.4em] font-medium text-black"
        >
          {label}
        </motion.span>
      ))}
    </div>
  );
}

function JoinNurseButton({ className = '', style }: { className?: string; style?: CSSProperties }) {
  return (
    <motion.a
      href={SITE.joinNurseHref}
      initial={{ opacity: 0, scale: 0.8 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: false, amount: 0.8 }}
      transition={{ type: 'spring', stiffness: 260, damping: 20, delay: 0.7 }}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.96 }}
      className={`z-20 inline-flex h-[3.35em] items-center gap-[0.8em] whitespace-nowrap rounded-full bg-black px-[2.5em] font-semibold text-white shadow-lg ${className}`}
      style={style}
    >
      Join LONI As A Nurse
      <ArrowRight className="size-[1.3em]" strokeWidth={2.25} aria-hidden="true" />
    </motion.a>
  );
}

function Cta({ className = '', style }: { className?: string; style?: CSSProperties }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: false, amount: 0.8 }}
      transition={{ duration: 0.6, delay: 0.2, ease: EASE }}
      className={className}
      style={style}
    >
      <ArrowPillButton href={SITE.talkToNurseHref}>Talk To A Nurse</ArrowPillButton>
    </motion.div>
  );
}

const paragraphMotion = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: false, amount: 0.6 },
  transition: { duration: 0.7, delay: 0.15, ease: EASE },
} as const;

/** ≥ lg: the absolute-positioned Figma composition, scaled as one piece with the stage width. */
function DesktopLayout() {
  return (
    <div
      className="@container relative mx-auto w-full max-w-[1624px] [--u:calc(100cqw/1624)]"
      style={{ aspectRatio: `${W} / ${H}` }}
    >
      <TextRibbon d={DESKTOP_RIBBON} viewBox={`0 0 ${W} ${H}`} strokeWidth={74} fontSize={36} speed={70} />

      <div style={at(58, 150)}>
        <TagBadge variant="green">Nurse Support</TagBadge>
      </div>
      <Heading className="z-10" style={at(58, 243, { fontSize: px(53), lineHeight: px(64) })} />
      <Pills style={at(56, 468, { fontSize: px(18), gap: px(15) })} />

      <div style={{ position: 'absolute', left: px(628), top: px(182), width: px(446), height: px(825) }}>
        <NurseCardStack />
      </div>
      <JoinNurseButton style={at(960, 666, { fontSize: px(15.5) })} />

      <motion.p
        {...paragraphMotion}
        className="text-neutral-950"
        style={at(1139, 780, { fontSize: px(18.2), lineHeight: px(37.5) })}
      >
        {PARAGRAPH_LINES.map((line) => (
          <span key={line} className="block whitespace-pre">
            {line}
          </span>
        ))}
      </motion.p>
      <Cta style={at(1139, 957)} />
    </div>
  );
}

/** < lg: copy first, then the card + ribbon, then the paragraph and CTA. */
function StackedLayout() {
  return (
    <div className="mx-auto max-w-[34rem] px-5 pb-16 pt-14 sm:px-8 sm:pb-20 sm:pt-20">
      <TagBadge variant="green">Nurse Support</TagBadge>
      <Heading className="mt-7 text-[2rem] leading-[1.25] sm:text-4xl" />
      <Pills className="mt-7 gap-3 text-[15px]" />

      <div className="relative mx-auto mt-12 aspect-[400/560] w-full max-w-[26rem]">
        <TextRibbon d={MOBILE_RIBBON} viewBox="0 0 400 560" strokeWidth={46} fontSize={24} speed={50} />
        <div className="absolute left-[20%] top-[9%] aspect-[393/727] w-[60%]">
          <NurseCardStack />
        </div>
        <JoinNurseButton className="absolute right-0 top-[55%] text-[13px]" />
      </div>

      <motion.p {...paragraphMotion} className="mt-8 text-base leading-8 text-neutral-950 sm:text-lg sm:leading-9">
        When you need more than an AI answer, LONI connects you with a nurse through a voice call. No typing it out, no
        waiting, just a real person who listens and supports you.
      </motion.p>
      <Cta className="mt-8" />
    </div>
  );
}

export function NurseSection() {
  const isDesktop = useMediaQuery('(min-width: 1024px)');

  return (
    <MotionConfig reducedMotion="user">
      <section id="nurses" aria-labelledby="nurse-title" className="relative overflow-hidden bg-white lg:-mx-5">
        {isDesktop ? <DesktopLayout /> : <StackedLayout />}
      </section>
    </MotionConfig>
  );
}
