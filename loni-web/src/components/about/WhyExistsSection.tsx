import type { CSSProperties, ReactNode } from 'react';
import { MotionConfig, motion } from 'framer-motion';
import { CarFront, HeartHandshake, UsersRound } from 'lucide-react';
import { AiBadgeIcon, NurseIcon } from '../icons/AboutIcons';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { WordReveal } from '../drivers/WordReveal';
import { px } from '../showcase/designUnits';
import { TagBadge } from '../ui/TagBadge';

// Slow, soft easing, like the other long-form pages.
const EASE = [0.22, 1, 0.36, 1] as const;

const HEADING = ['Maternity support', "shouldn't feel", 'fragmented.'];
const INTRO =
  "Too often, answers live in different places, a doctor here, an app there, a relative who knows someone, a drive you hope you don't need to arrange. LONI brings the whole picture into one thoughtful experience.";

interface Point {
  title: string[];
  text: string;
  icon: ReactNode;
}

const AI: Point = {
  title: ['AI when you need answers'],
  text: 'LUMA offers immediate guidance for the questions that come up at any hour.',
  icon: <AiBadgeIcon />,
};
const NURSES: Point = {
  title: ['Nurses when you need a', 'human'],
  text: "When an answer isn't enough, connect with a caring nurse through a voice call.",
  icon: <NurseIcon />,
};
const PEOPLE: Point = {
  title: ['People you trust when you', 'need support'],
  text: "Bring partners and family into the journey so you're surrounded by the people who matter.",
  icon: <UsersRound size={28} strokeWidth={1.5} aria-hidden="true" />,
};
const JOURNEY: Point = {
  title: ['We know every journey', 'is different.'],
  text: 'Share, ask, listen, and connect with other mothers on the same journey.',
  icon: <HeartHandshake size={28} strokeWidth={1.5} aria-hidden="true" />,
};
const TRANSPORT: Point = {
  title: ['Transportation when you', 'need to get there'],
  text: 'Connect with verified drivers when getting to the hospital is what matters.',
  icon: <CarFront size={28} strokeWidth={1.5} aria-hidden="true" />,
};

/** Reading order for phones. */
const ALL = [AI, NURSES, PEOPLE, JOURNEY, TRANSPORT];

/** Figma canvas of the desktop composition. */
const W = 1692;
const H = 1110;

const at = (x: number, y: number, extra?: CSSProperties): CSSProperties => ({
  position: 'absolute',
  left: px(x),
  top: px(y),
  ...extra,
});

/** Icon + title on top, description below; slides up and fades in. Sized in `em` (set font-size on it). */
function PointItem({
  point,
  index,
  className = '',
  style,
}: {
  point: Point;
  index: number;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: false, amount: 0.5 }}
      transition={{ duration: 1.3, delay: 0.1 + index * 0.12, ease: EASE }}
      className={`flex gap-[1.05em] ${className}`}
      style={style}
    >
      <motion.span
        initial={{ scale: 0.4, opacity: 0, rotate: -14 }}
        whileInView={{ scale: 1, opacity: 1, rotate: 0 }}
        viewport={{ once: false, amount: 0.5 }}
        transition={{ type: 'spring', stiffness: 80, damping: 14, delay: 0.35 + index * 0.12 }}
        className="mt-[0.15em] shrink-0 text-black [&>svg]:size-[2em]"
      >
        {point.icon}
      </motion.span>
      <div>
        <h3 className="text-[1.45em] font-normal leading-[1.3] text-black">
          {point.title.map((line) => (
            <span key={line}>
              <span className="lg:block lg:whitespace-nowrap">{line}</span>{' '}
            </span>
          ))}
        </h3>
        <p className="mt-[0.8em] max-w-[17.5em] leading-[1.6] text-neutral-600">{point.text}</p>
      </div>
    </motion.article>
  );
}

/** A 1px rule that draws itself in (left→right, or top→bottom when `vertical`). */
function Rule({ vertical = false, delay = 0, className = '', style }: { vertical?: boolean; delay?: number; className?: string; style?: CSSProperties }) {
  return (
    <motion.span
      aria-hidden="true"
      initial={vertical ? { scaleY: 0 } : { scaleX: 0 }}
      whileInView={vertical ? { scaleY: 1 } : { scaleX: 1 }}
      viewport={{ once: false, amount: 0.3 }}
      transition={{ duration: 1.6, delay, ease: EASE }}
      className={`block bg-neutral-200 ${vertical ? 'origin-top' : 'origin-left'} ${className}`}
      style={style}
    />
  );
}

function Intro({ className = '', style }: { className?: string; style?: CSSProperties }) {
  return (
    <motion.p
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: false, amount: 0.6 }}
      transition={{ duration: 1.3, delay: 0.5, ease: EASE }}
      className={`text-black ${className}`}
      style={style}
    >
      {INTRO}
    </motion.p>
  );
}

function DesktopLayout() {
  const text = { fontSize: px(17) };
  return (
    <div
      className="@container relative mx-auto w-full max-w-[1692px] [--u:calc(100cqw/1692)]"
      style={{ aspectRatio: `${W} / ${H}` }}
    >
      <div style={at(69, 124)}>
        <TagBadge variant="green">Why LONI exists</TagBadge>
      </div>
      <WordReveal
        as="h2"
        id="why-exists-title"
        lines={HEADING}
        className="font-semibold tracking-[-0.02em] text-black"
        style={at(66, 212, { fontSize: px(53), lineHeight: px(65.5) })}
      />
      <Intro style={at(66, 441, { width: px(600), fontSize: px(19.5), lineHeight: px(38) })} />

      {/* Column A (middle) and column B (right), staggered down the page as in the design. */}
      <PointItem point={AI} index={0} style={at(800, 518, text)} />
      <Rule delay={0.6} style={at(804, 691, { width: px(362), height: 1 })} />
      <PointItem point={PEOPLE} index={1} style={at(800, 735, text)} />

      <Rule vertical delay={0.3} style={at(1204, 457, { width: 1, height: px(534) })} />

      <PointItem point={NURSES} index={2} style={at(1248, 376, text)} />
      <Rule delay={0.7} style={at(1246, 583, { width: px(369), height: 1 })} />
      <PointItem point={JOURNEY} index={3} style={at(1248, 627, text)} />
      <Rule delay={0.8} style={at(1246, 836, { width: px(369), height: 1 })} />
      <PointItem point={TRANSPORT} index={4} style={at(1248, 877, text)} />
    </div>
  );
}

function StackedLayout() {
  return (
    <div className="mx-auto max-w-[34rem] px-5 pb-16 pt-14 sm:px-8 sm:pb-20 sm:pt-20">
      <TagBadge variant="green">Why LONI exists</TagBadge>
      <WordReveal
        as="h2"
        id="why-exists-title"
        lines={HEADING}
        className="mt-8 text-[2.1rem] font-semibold leading-[1.2] tracking-[-0.02em] text-black sm:text-[2.5rem]"
      />
      <Intro className="mt-6 text-[0.95rem] leading-[1.75] sm:text-base" />

      <div className="mt-10 flex flex-col text-[0.9rem]">
        {ALL.map((point, i) => (
          <div key={point.title[0]}>
            {i > 0 && <Rule className="my-7 h-px w-full" />}
            <PointItem point={point} index={0} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function WhyExistsSection() {
  const isDesktop = useMediaQuery('(min-width: 1024px)');

  return (
    <MotionConfig reducedMotion="user">
      <section id="why-exists" aria-labelledby="why-exists-title" className="relative overflow-hidden bg-white">
        {isDesktop ? <DesktopLayout /> : <StackedLayout />}
      </section>
    </MotionConfig>
  );
}
