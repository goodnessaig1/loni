import type { CSSProperties, ReactNode } from 'react';
import { MotionConfig, motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { GaugeIcon, MoneyBagIcon, MotherIcon, ShieldPersonIcon, SirenIcon } from '../icons/TrainingIcons';
import { SITE } from '../../config/site';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { px } from '../showcase/designUnits';
import { TagBadge } from '../ui/TagBadge';

// Slow, soft easing, like the rest of the driver page.
const EASE = [0.22, 1, 0.36, 1] as const;

const HEADING_LINES = ['We’ll show you what you need', 'to know before you drive.'];
const INTRO_LINES = [
  'LONI driver training prepares you to provide safe, professional and',
  'respectful support to every mother you transport.',
];

interface Topic {
  title: string;
  lines: string[];
  icon: ReactNode;
}

const TOPICS: Topic[] = [
  {
    title: 'Basic driving rules',
    lines: ['LONI’s standards for professional and safe driving', 'on every trip.'],
    icon: <GaugeIcon />,
  },
  {
    title: 'Picking up a mother safely',
    lines: ['How to respectfully and safely assist a mother', 'into and out of the vehicle.'],
    icon: <MotherIcon />,
  },
  {
    title: 'Emergency transport expectations',
    lines: ['What to expect during an emergency trip and', 'how to respond appropriately.'],
    icon: <SirenIcon />,
  },
  {
    title: 'Driver safety',
    lines: ['Your personal safety and the safety of your', 'passenger during every trip.'],
    icon: <ShieldPersonIcon />,
  },
  {
    title: 'No direct payment',
    lines: ['Drivers never accept payment directly from', 'mothers. All payments come from LONI.'],
    icon: <MoneyBagIcon />,
  },
  {
    title: 'LONI payment rules',
    lines: ['How driver payments work and when to expect', 'them.'],
    icon: <MoneyBagIcon />,
  },
];

/** Figma canvas of the desktop composition; cards are 502 × 352 on a 3-column grid. */
const W = 1630;
const H = 1140;
const CARD_W = 502;
const CARD_H = 352;
const COL_X = [53, 565, 1076] as const;
const ROW_Y = [341, 706] as const;

const at = (x: number, y: number, extra?: CSSProperties): CSSProperties => ({
  position: 'absolute',
  left: px(x),
  top: px(y),
  ...extra,
});

function Heading({ className = '', style }: { className?: string; style?: CSSProperties }) {
  return (
    // The observer sits on the h2 (never translated); the lines slide up from behind a mask.
    <motion.h2
      id="training-title"
      initial="hide"
      whileInView="show"
      viewport={{ once: false, amount: 0.6 }}
      variants={{ hide: { opacity: 0 }, show: { opacity: 1, transition: { duration: 0.9 } } }}
      className={`font-medium tracking-[-0.02em] text-black ${className}`}
      style={style}
    >
      {HEADING_LINES.map((line, i) => (
        <span key={line}>
          <span className="inline lg:block lg:overflow-hidden lg:pb-[0.1em]">
            <motion.span
              className="inline lg:block"
              variants={{
                hide: { y: '110%', transition: { duration: 0.4 } },
                show: { y: 0, transition: { duration: 1.3, delay: 0.1 + i * 0.18, ease: EASE } },
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

function Intro({ className = '', style }: { className?: string; style?: CSSProperties }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: false, amount: 0.6 }}
      transition={{ duration: 1.3, delay: 0.4, ease: EASE }}
      className={className}
      style={style}
    >
      <p>
        {INTRO_LINES.map((line) => (
          <span key={line}>
            <span className="lg:block lg:whitespace-nowrap">{line}</span>{' '}
          </span>
        ))}
      </p>
      <a
        href={SITE.driverTrainingHref}
        className="group mt-5 inline-flex h-[2.7em] items-center gap-[1.1em] rounded-full bg-black px-[1.6em] text-[0.92em] font-semibold text-white transition-transform duration-300 hover:scale-[1.04] active:scale-[0.97] lg:mt-[0.85em]"
      >
        Read more
        <ArrowRight
          className="size-[1.3em] transition-transform duration-300 group-hover:translate-x-1"
          strokeWidth={2.2}
          aria-hidden="true"
        />
      </a>
    </motion.div>
  );
}

/** One training topic: icon tile on top, title and two-line description pinned to the bottom. Sized in `em`. */
function TopicCard({
  topic,
  index,
  className = '',
  style,
}: {
  topic: Topic;
  index: number;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <motion.article
      initial="hide"
      whileInView="show"
      viewport={{ once: false, amount: 0.3 }}
      whileHover={{ y: -6, transition: { duration: 0.5 } }}
      variants={{
        hide: { opacity: 0, y: 56, transition: { duration: 0.4 } },
        show: { opacity: 1, y: 0, transition: { duration: 1.3, delay: 0.1 + (index % 3) * 0.2 + Math.floor(index / 3) * 0.15, ease: EASE } },
      }}
      className={`group flex flex-col justify-between rounded-[2em] bg-neutral-50 px-[1.8em] pb-[1.8em] pt-[1.9em] ${className}`}
      style={style}
    >
      <motion.span
        variants={{
          hide: { scale: 0.5, rotate: -12, opacity: 0, transition: { duration: 0.3 } },
          show: {
            scale: 1,
            rotate: 0,
            opacity: 1,
            transition: { type: 'spring', stiffness: 80, damping: 14, delay: 0.5 + (index % 3) * 0.2 },
          },
        }}
        className="inline-flex size-[3.8em] items-center justify-center rounded-[1em] bg-white text-black transition-transform duration-500 group-hover:rotate-[-6deg] group-hover:scale-110 [&>svg]:size-[1.9em]"
      >
        {topic.icon}
      </motion.span>

      <div>
        <h3 className="text-[1.5em] font-medium leading-[1.25] text-black">{topic.title}</h3>
        <p className="mt-[0.9em] leading-[1.45] text-neutral-600">
          {topic.lines.map((line) => (
            <span key={line}>
              <span className="lg:block lg:whitespace-nowrap">{line}</span>{' '}
            </span>
          ))}
        </p>
      </div>
    </motion.article>
  );
}

function DesktopLayout() {
  return (
    <div
      className="@container relative mx-auto w-full max-w-[1630px] [--u:calc(100cqw/1630)]"
      style={{ aspectRatio: `${W} / ${H}` }}
    >
      <div style={at(56, 46)}>
        <TagBadge variant="pink">Driver Training</TagBadge>
      </div>
      <Heading style={at(53, 154, { fontSize: px(42), lineHeight: px(53) })} />
      <Intro style={at(991, 117, { fontSize: px(19.5), lineHeight: px(37), width: px(620) })} />

      {TOPICS.map((topic, i) => (
        <TopicCard
          key={topic.title}
          topic={topic}
          index={i}
          style={{
            ...at(COL_X[i % 3], ROW_Y[Math.floor(i / 3)], { width: px(CARD_W), height: px(CARD_H) }),
            fontSize: px(16.5),
          }}
        />
      ))}
    </div>
  );
}

function StackedLayout() {
  return (
    <div className="mx-auto max-w-[34rem] px-5 pb-16 pt-12 sm:px-8 sm:pb-20 sm:pt-16">
      <TagBadge variant="pink">Driver Training</TagBadge>
      <Heading className="mt-7 text-[1.9rem] leading-[1.25] sm:text-4xl" />
      <Intro className="mt-5 text-[0.95rem] leading-[1.7] sm:text-base" />

      <div className="mt-9 flex flex-col gap-3 text-[0.95rem]">
        {TOPICS.map((topic, i) => (
          <TopicCard key={topic.title} topic={topic} index={i} className="min-h-[17rem]" />
        ))}
      </div>
    </div>
  );
}

export function TrainingSection() {
  const isDesktop = useMediaQuery('(min-width: 1024px)');

  return (
    <MotionConfig reducedMotion="user">
      <section id="driver-training" aria-labelledby="training-title" className="relative overflow-hidden bg-white">
        {isDesktop ? <DesktopLayout /> : <StackedLayout />}
      </section>
    </MotionConfig>
  );
}
