import type { CSSProperties } from 'react';
import { MotionConfig, motion } from 'framer-motion';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { TagBadge } from '../ui/TagBadge';
import { px } from '../showcase/designUnits';
import { JourneyCard } from './JourneyCard';
import { JourneySwirl } from './JourneySwirl';

const EASE = [0.22, 1, 0.36, 1] as const;
const HEADING_LINES = ['We provide support that', 'grows with you.'];

const STEPS = [
  { title: 'Pregnancy', lines: ['Track your journey and get daily', 'guidance from day one.'] },
  { title: 'Birth Preparation', lines: ['Checklists, plans and support as your', 'due date nears.'] },
  { title: 'Delivery', lines: ['Your people and transportation close', 'when it matters.'] },
  { title: 'Postpartum', lines: ['Continue receiving care and support', 'after delivery.'] },
  { title: 'When Things Takes A Turn', lines: ['When the unexpected happens, LONI', 'knows what to do.'] },
];

/** Figma canvas of the desktop composition and where each of the five cards sits in it. */
const W = 1435;
const H = 1031;
const CARD_W = 315;
const CARD_H = 305;
const CARD_POS: ReadonlyArray<readonly [number, number]> = [
  [421, 339],
  [748, 339],
  [1075, 339],
  [748, 657],
  [1075, 657],
];

const at = (x: number, y: number, extra?: CSSProperties): CSSProperties => ({
  position: 'absolute',
  left: px(x),
  top: px(y),
  ...extra,
});

function Heading({ className = '', style }: { className?: string; style?: CSSProperties }) {
  return (
    // The observer sits on the h2 (never translated); lines are only masked/stacked from lg up.
    <motion.h2
      id="journey-title"
      initial="hide"
      whileInView="show"
      viewport={{ once: false, amount: 0.6 }}
      variants={{ hide: { opacity: 0 }, show: { opacity: 1, transition: { duration: 0.3 } } }}
      className={`font-semibold tracking-[-0.02em] text-white ${className}`}
      style={style}
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
  );
}

/** The little outlined square that sits beside card 4 in the design. */
function Marker({ className = '', style }: { className?: string; style?: CSSProperties }) {
  return (
    <motion.span
      aria-hidden="true"
      initial={{ opacity: 0, scale: 0.4 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: false, amount: 1 }}
      transition={{ type: 'spring', stiffness: 260, damping: 16, delay: 0.5 }}
      className={`block rounded-md border-[1.5px] border-white/90 ${className}`}
      style={style}
    />
  );
}

/** ≥ lg: the absolute-positioned Figma composition, scaled as one piece with the stage width. */
function DesktopLayout() {
  return (
    <div
      className="@container relative mx-auto w-full max-w-[1435px] [--u:calc(100cqw/1435)]"
      style={{ aspectRatio: `${W} / ${H}` }}
    >
      <JourneySwirl className="left-0 top-[calc(var(--u)*638)] w-[calc(var(--u)*605)]" />
      <div style={at(50, 98)}>
        <TagBadge>The full journey</TagBadge>
      </div>
      <Heading className="z-10" style={at(48, 181, { fontSize: px(48.5), lineHeight: px(57) })} />

      {STEPS.map((step, i) => (
        <JourneyCard
          key={step.title}
          step={i + 1}
          index={i}
          {...step}
          style={at(CARD_POS[i][0], CARD_POS[i][1], {
            width: px(CARD_W),
            height: px(CARD_H),
            fontSize: px(14.5),
          })}
        />
      ))}
      <Marker style={at(695, 667, { width: px(23), height: px(23) })} />
    </div>
  );
}

/** < lg: heading, then the five cards stacked; cards 4 and 5 are indented where the marker sits. */
function StackedLayout() {
  return (
    <div className="relative mx-auto max-w-[34rem] px-5 pb-20 pt-14 sm:px-8 sm:pt-20">
      <TagBadge>The full journey</TagBadge>
      <Heading className="mt-7 max-w-[16rem] text-[2rem] leading-[1.25] sm:max-w-none sm:text-4xl" />

      <div className="relative mt-8 flex flex-col gap-2.5 text-[14px] sm:text-[15px]">
        {STEPS.slice(0, 3).map((step, i) => (
          <JourneyCard key={step.title} step={i + 1} index={i} {...step} className="min-h-[13.5rem]" />
        ))}
        <div className="relative ml-[14%] flex flex-col gap-2.5 sm:ml-[16%]">
          <Marker className="absolute -left-8 top-2.5 size-[18px] sm:-left-9 sm:size-5" />
          {STEPS.slice(3).map((step, i) => (
            <JourneyCard key={step.title} step={i + 4} index={i + 3} {...step} className="min-h-[13.5rem]" />
          ))}
        </div>
      </div>
    </div>
  );
}

export function JourneySection() {
  const isDesktop = useMediaQuery('(min-width: 1024px)');

  return (
    <MotionConfig reducedMotion="user">
      <section id="journey" aria-labelledby="journey-title" className="relative overflow-hidden bg-brand lg:-mx-5">
        {/* Same ribbon on both layouts; on desktop it is anchored in the stage's coordinates instead. */}
        {!isDesktop && <JourneySwirl className="-bottom-6 -left-[8%] w-[92%] sm:w-[70%]" />}
        {isDesktop ? <DesktopLayout /> : <StackedLayout />}
      </section>
    </MotionConfig>
  );
}
