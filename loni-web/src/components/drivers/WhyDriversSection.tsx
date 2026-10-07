import type { CSSProperties } from 'react';
import { MotionConfig, motion } from 'framer-motion';
import avatar1 from '../../assets/drivers/avatars/avatar-1.svg';
import avatar2 from '../../assets/drivers/avatars/avatar-2.svg';
import avatar3 from '../../assets/drivers/avatars/avatar-3.svg';
import avatar4 from '../../assets/drivers/avatars/avatar-4.svg';
import nightDriver from '../../assets/drivers/night-driver.webp';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { CountUp } from '../pricing/CountUp';
import { px } from '../showcase/designUnits';
import { TagBadge } from '../ui/TagBadge';
import { WordReveal } from './WordReveal';

// Slow, soft easing: this section is meant to feel unhurried.
const EASE = [0.22, 1, 0.36, 1] as const;

const AVATARS = [avatar1, avatar2, avatar3, avatar4];

const STATEMENT = [
  'LONI helps connect mothers with',
  'transportation when they need help getting',
  'to their chosen hospital. As a verified LONI',
  "driver, you play a real role in a mother's",
  'journey when it matters most.',
];

const CARDS = [
  {
    title: ['Be there when it', 'counts'],
    text: ['Help mothers reach their hospital', 'safely and with confidence.'],
  },
  {
    title: ['Verified and', 'trusted'],
    text: ['LONI verifies all drivers before they', 'can accept requests.'],
  },
  {
    title: ['Earn through', 'LONI'],
    text: ['Complete trips and receive payment', 'directly from LONI admin.'],
  },
];

/** Figma canvas of the desktop composition. */
const W = 1663;
const H = 900;

const at = (x: number, y: number, extra?: CSSProperties): CSSProperties => ({
  position: 'absolute',
  left: px(x),
  top: px(y),
  ...extra,
});

/** Overlapping circular photos that arrive one by one. */
function AvatarStack({ className = '', style }: { className?: string; style?: CSSProperties }) {
  return (
    <div className={`flex ${className}`} style={style}>
      {AVATARS.map((src, i) => (
        <motion.img
          key={src}
          src={src}
          alt=""
          width={49}
          height={49}
          draggable={false}
          initial={{ opacity: 0, scale: 0.4, x: -18 }}
          whileInView={{ opacity: 1, scale: 1, x: 0 }}
          viewport={{ once: false, amount: 0.9 }}
          transition={{ type: 'spring', stiffness: 70, damping: 15, delay: 0.3 + i * 0.18 }}
          className="size-[3.25em] shrink-0 select-none rounded-full lg:size-[1em]"
          style={{ marginLeft: i === 0 ? 0 : '-0.2em', zIndex: i }}
        />
      ))}
    </div>
  );
}

function Stat() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: false, amount: 0.8 }}
      transition={{ duration: 1.2, delay: 0.9, ease: EASE }}
    >
      <p className="text-neutral-500">Trusted by over</p>
      <p className="mt-[0.7em] flex items-baseline gap-[0.75em]">
        <span className="text-[2.3em] font-light leading-none tracking-[-0.02em] text-black">
          <CountUp value={20} duration={2.4} />+
        </span>
        <span className="text-neutral-500">clients across states</span>
      </p>
    </motion.div>
  );
}

function ValueCard({
  card,
  index,
  className = '',
  style,
}: {
  card: (typeof CARDS)[number];
  index: number;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 56 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: false, amount: 0.3 }}
      transition={{ duration: 1.3, delay: 0.1 + index * 0.2, ease: EASE }}
      whileHover={{ y: -6, transition: { duration: 0.5 } }}
      className={`flex flex-col justify-between rounded-[1.75em] bg-neutral-50 px-[1.9em] pb-[2em] pt-[1.95em] ${className}`}
      style={style}
    >
      <h3 className="text-[1.5em] font-medium leading-[1.25] text-black">
        {card.title.map((line) => (
          <span key={line}>
            <span className="lg:block lg:whitespace-nowrap">{line}</span>{' '}
          </span>
        ))}
      </h3>
      <p className="mt-10 text-[1em] leading-[1.45] text-neutral-600 lg:mt-0">
        {card.text.map((line) => (
          <span key={line}>
            <span className="lg:block lg:whitespace-nowrap">{line}</span>{' '}
          </span>
        ))}
      </p>
    </motion.article>
  );
}

/**
 * The night-time driver photo: wipes open from the top while the picture settles from a deep zoom.
 * The observer sits on the outer wrapper - an element clipped to nothing never reports as in view.
 */
function PhotoCard({ className = '', style }: { className?: string; style?: CSSProperties }) {
  return (
    <motion.div
      initial="hide"
      whileInView="show"
      viewport={{ once: false, amount: 0.3 }}
      className={className}
      style={style}
    >
      <motion.div
        className="size-full overflow-hidden rounded-[1.5em] bg-black"
        variants={{
          hide: { clipPath: 'inset(0 0 100% 0 round 1.5em)', opacity: 0.4, transition: { duration: 0.5 } },
          show: { clipPath: 'inset(0 0 0% 0 round 1.5em)', opacity: 1, transition: { duration: 1.6, delay: 0.7, ease: EASE } },
        }}
      >
        <motion.img
          src={nightDriver}
          alt="A LONI driver at night, city lights reflected in the car window"
          width={1408}
          height={1145}
          decoding="async"
          draggable={false}
          className="size-full select-none object-cover"
          variants={{
            hide: { scale: 1.25, transition: { duration: 0.5 } },
            show: { scale: 1, transition: { duration: 2.4, delay: 0.7, ease: EASE } },
          }}
        />
      </motion.div>
    </motion.div>
  );
}

function DesktopLayout() {
  return (
    <div
      className="@container relative mx-auto w-full max-w-[1663px] [--u:calc(100cqw/1663)]"
      style={{ aspectRatio: `${W} / ${H}` }}
    >
      <div style={at(55, 70)}>
        <TagBadge variant="pink">Why Drivers Matter</TagBadge>
      </div>

      <AvatarStack style={at(53, 190, { fontSize: px(52) })} />
      <div style={at(53, 262, { fontSize: px(18.5) })}>
        <Stat />
      </div>

      <WordReveal
        as="h2"
        id="why-drivers-title"
        lines={STATEMENT}
        className="font-medium tracking-[-0.01em] text-black"
        style={at(711, 79, { fontSize: px(41.5), lineHeight: px(54.5) })}
      />

      {CARDS.map((card, i) => (
        <ValueCard
          key={card.title[0]}
          card={card}
          index={i}
          style={{ ...at(53 + i * 381, 466, { width: px(361), height: px(326) }), fontSize: px(16) }}
        />
      ))}
      <PhotoCard style={{ ...at(1195, 460, { width: px(415), height: px(337) }), fontSize: px(16) }} />
    </div>
  );
}

function StackedLayout() {
  return (
    <div className="mx-auto max-w-[34rem] px-5 pb-16 pt-14 sm:px-8 sm:pb-20 sm:pt-20">
      <TagBadge variant="pink">Why Drivers Matter</TagBadge>

      <WordReveal
        as="h2"
        id="why-drivers-title"
        lines={STATEMENT}
        className="mt-8 text-[1.65rem] font-medium leading-[1.35] tracking-[-0.01em] text-black sm:text-[1.9rem]"
      />

      <div className="mt-8 text-[1rem]">
        <AvatarStack />
        <div className="mt-5">
          <Stat />
        </div>
      </div>

      <div className="mt-10 flex flex-col gap-3 text-[0.95rem]">
        {CARDS.map((card, i) => (
          <ValueCard key={card.title[0]} card={card} index={i} className="min-h-[14rem]" />
        ))}
        <PhotoCard className="aspect-[359/292] text-[1rem]" />
      </div>
    </div>
  );
}

export function WhyDriversSection() {
  const isDesktop = useMediaQuery('(min-width: 1024px)');

  return (
    <MotionConfig reducedMotion="user">
      <section id="why-drivers" aria-labelledby="why-drivers-title" className="relative overflow-hidden bg-white">
        {isDesktop ? <DesktopLayout /> : <StackedLayout />}
      </section>
    </MotionConfig>
  );
}
