import type { CSSProperties } from 'react';
import { MotionConfig, motion } from 'framer-motion';
import { BellIcon } from '../icons/BellIcon';
import { FlagIcon } from '../icons/FlagIcon';
import { SITE } from '../../config/site';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { ArrowPillButton } from '../ui/ArrowPillButton';
import { OutlinePill } from '../ui/OutlinePill';
import { TagBadge } from '../ui/TagBadge';
import { px } from '../showcase/designUnits';
import { InfoCard } from './InfoCard';
import connected from '../../assets/partner/connected.webp';

const EASE = [0.22, 1, 0.36, 1] as const;
const HEADING_LINES = ['We know you don’t', 'have to do this', 'alone.'];
const PARAGRAPH_LINES = [
  'Invite the people you trust to stay',
  'connected and support you throughout',
  'pregnancy, in ways that feel helpful, not',
  'overwhelming.',
];
const PILLS = ['Support Participation', 'Emergency Notifications'];

const MILESTONES = {
  title: 'Milestone visibility',
  lines: ['Trusted people see the journey milestones', 'that matter, when you choose to share', 'them.'],
  color: '#9333EA',
  icon: <FlagIcon />,
};
const UPDATES = {
  title: 'Relevant updates',
  lines: ['Stay in the loop without', 'overwhelming detail, only what’s', 'useful and wanted.'],
  color: '#EE6666',
  icon: <BellIcon />,
};

/** Figma canvas of the desktop composition. */
const W = 1452;
const H = 1056;

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
      id="partner-title"
      initial="hide"
      whileInView="show"
      viewport={{ once: false, amount: 0.6 }}
      variants={{ hide: { opacity: 0 }, show: { opacity: 1, transition: { duration: 0.3 } } }}
      className={`font-semibold tracking-[-0.02em] text-black ${className}`}
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

function Paragraph({ className = '', style }: { className?: string; style?: CSSProperties }) {
  return (
    <motion.p
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: false, amount: 0.6 }}
      transition={{ duration: 0.7, delay: 0.15, ease: EASE }}
      className={`text-neutral-950 ${className}`}
      style={style}
    >
      {PARAGRAPH_LINES.map((line) => (
        <span key={line}>
          <span className="lg:block lg:whitespace-nowrap">{line}</span>{' '}
        </span>
      ))}
    </motion.p>
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
      <ArrowPillButton href={SITE.partnerSupportHref}>Explore Partner Support</ArrowPillButton>
    </motion.div>
  );
}

function Phone({ className = '', style }: { className?: string; style?: CSSProperties }) {
  return (
    <motion.img
      src={connected}
      alt="The LONI invite screen: “Always Stay Connected!” with a partner email field and a Send Invite button"
      width={309}
      height={629}
      decoding="async"
      draggable={false}
      initial={{ opacity: 0, y: 70, rotate: 3, scale: 0.94 }}
      whileInView={{ opacity: 1, y: 0, rotate: 0, scale: 1 }}
      viewport={{ once: false, amount: 0.3 }}
      transition={{ duration: 0.9, ease: EASE }}
      className={`select-none ${className}`}
      style={style}
    />
  );
}

/** ≥ lg: the absolute-positioned Figma composition, scaled as one piece with the stage width. */
function DesktopLayout() {
  return (
    <div
      className="@container relative mx-auto w-full max-w-[1452px] [--u:calc(100cqw/1452)]"
      style={{ aspectRatio: `${W} / ${H}` }}
    >
      <div style={at(50, 108)}>
        <TagBadge variant="green">Partner &amp; family</TagBadge>
      </div>
      <Heading style={at(46, 188, { fontSize: px(49), lineHeight: px(57.5) })} />
      <Paragraph style={at(46, 456, { fontSize: px(17.6), lineHeight: px(33.3) })} />
      <Cta style={at(46, 612)} />

      <div style={at(46, 844, { fontSize: px(16.5), display: 'flex', flexDirection: 'column', gap: px(14) })}>
        {PILLS.map((label, i) => (
          <span key={label} className="self-start">
            <OutlinePill index={i}>{label}</OutlinePill>
          </span>
        ))}
      </div>

      <Phone style={at(542, 306, { width: px(309) })} />

      <InfoCard
        {...MILESTONES}
        delay={0.25}
        style={at(980, 491, { width: px(388), height: px(162), fontSize: px(16.4) })}
      />
      <InfoCard
        {...UPDATES}
        from="left"
        delay={0.4}
        style={at(929, 672, { width: px(310), height: px(163), fontSize: px(16.4) })}
      />
    </div>
  );
}

/** < lg: copy and CTA first, then the phone, pills and the two staggered cards. */
function StackedLayout() {
  return (
    <div className="mx-auto max-w-[34rem] px-5 pb-16 pt-14 sm:px-8 sm:pb-20 sm:pt-20">
      <TagBadge variant="green">Partner &amp; family</TagBadge>
      <Heading className="mt-7 text-[2rem] leading-[1.25] sm:text-4xl" />
      <Paragraph className="mt-6 text-base leading-8 sm:text-lg sm:leading-9" />
      <Cta className="mt-7" />

      <Phone className="mx-auto mt-12 w-[56%] max-w-[309px]" />

      <div className="mt-10 flex flex-col items-start gap-3 text-[15px]">
        {PILLS.map((label, i) => (
          <OutlinePill key={label} index={i}>
            {label}
          </OutlinePill>
        ))}
      </div>

      <div className="mt-8 flex flex-col gap-3 text-[14px]">
        <InfoCard {...MILESTONES} delay={0.1} className="ml-auto w-[88%]" />
        <InfoCard {...UPDATES} from="left" delay={0.2} className="w-[74%]" />
      </div>
    </div>
  );
}

export function PartnerSection() {
  const isDesktop = useMediaQuery('(min-width: 1024px)');

  return (
    <MotionConfig reducedMotion="user">
      <section aria-labelledby="partner-title" className="relative overflow-hidden bg-white lg:-mx-5">
        {isDesktop ? <DesktopLayout /> : <StackedLayout />}
      </section>
    </MotionConfig>
  );
}
