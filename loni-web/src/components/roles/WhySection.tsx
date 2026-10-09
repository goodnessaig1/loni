import type { CSSProperties } from 'react';
import { MotionConfig, motion } from 'framer-motion';
import avatar1 from '../../assets/drivers/avatars/avatar-1.svg';
import avatar2 from '../../assets/drivers/avatars/avatar-2.svg';
import avatar3 from '../../assets/drivers/avatars/avatar-3.svg';
import avatar4 from '../../assets/drivers/avatars/avatar-4.svg';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { CountUp } from '../pricing/CountUp';
import { px } from '../showcase/designUnits';
import { TagBadge } from '../ui/TagBadge';
import { WordReveal } from '../drivers/WordReveal';

// Slow, soft easing: these sections are meant to feel unhurried.
const EASE = [0.22, 1, 0.36, 1] as const;

const AVATARS = [avatar1, avatar2, avatar3, avatar4];

export interface ValueCardContent {
  title: string[];
  text: string[];
}

type Point = readonly [number, number];

/** Where everything sits in the Figma canvas (1 design px = `--u`). */
export interface WhyCanvas {
  w: number;
  h: number;
  badge: Point;
  avatars: Point;
  /** "Trusted by over 20+ clients" block, top-left corner. */
  stat: Point;
  statement: Point;
  statementSize: number;
  statementLh: number;
  /** x of the first card and the pitch to the next one. */
  cardsX: Point;
  cardsY: number;
  card: Point;
  cardFont: number;
  photo: readonly [number, number, number, number];
}

export interface WhySectionProps {
  id: string;
  titleId: string;
  badge: string;
  statement: string[];
  cards: ValueCardContent[];
  photo: { src: string; alt: string; width: number; height: number };
  canvas: WhyCanvas;
}

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
  card: ValueCardContent;
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
function PhotoCard({
  photo,
  className = '',
  style,
}: {
  photo: WhySectionProps['photo'];
  className?: string;
  style?: CSSProperties;
}) {
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
          src={photo.src}
          alt={photo.alt}
          width={photo.width}
          height={photo.height}
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

function DesktopLayout({ props }: { props: WhySectionProps }) {
  const c = props.canvas;
  return (
    <div
      className="@container relative mx-auto w-full"
      style={{ aspectRatio: `${c.w} / ${c.h}`, maxWidth: c.w, ['--u' as string]: `calc(100cqw / ${c.w})` }}
    >
      <div style={at(...c.badge)}>
        <TagBadge variant="pink">{props.badge}</TagBadge>
      </div>

      <AvatarStack style={at(...c.avatars, { fontSize: px(52) })} />
      <div style={at(...c.stat, { fontSize: px(18.5) })}>
        <Stat />
      </div>

      <WordReveal
        as="h2"
        id={props.titleId}
        lines={props.statement}
        className="font-medium tracking-[-0.01em] text-black"
        style={at(...c.statement, { fontSize: px(c.statementSize), lineHeight: px(c.statementLh) })}
      />

      {props.cards.map((card, i) => (
        <ValueCard
          key={card.title[0]}
          card={card}
          index={i}
          style={{ ...at(c.cardsX[0] + i * c.cardsX[1], c.cardsY, { width: px(c.card[0]), height: px(c.card[1]) }), fontSize: px(c.cardFont) }}
        />
      ))}
      <PhotoCard
        photo={props.photo}
        style={{ ...at(c.photo[0], c.photo[1], { width: px(c.photo[2]), height: px(c.photo[3]) }), fontSize: px(c.cardFont) }}
      />
    </div>
  );
}

function StackedLayout({ props }: { props: WhySectionProps }) {
  return (
    <div className="mx-auto max-w-[34rem] px-5 pb-16 pt-14 sm:px-8 sm:pb-20 sm:pt-20">
      <TagBadge variant="pink">{props.badge}</TagBadge>

      <WordReveal
        as="h2"
        id={props.titleId}
        lines={props.statement}
        className="mt-8 text-[1.65rem] font-medium leading-[1.35] tracking-[-0.01em] text-black sm:text-[1.9rem]"
      />

      <div className="mt-8 text-[1rem]">
        <AvatarStack />
        <div className="mt-5">
          <Stat />
        </div>
      </div>

      <div className="mt-10 flex flex-col gap-3 text-[0.95rem]">
        {props.cards.map((card, i) => (
          <ValueCard key={card.title[0]} card={card} index={i} className="min-h-[14rem]" />
        ))}
        <PhotoCard photo={props.photo} className="aspect-[359/292] text-[1rem]" />
      </div>
    </div>
  );
}

/**
 * "Why it matters" block shared by the role pages: pink tag, overlapping avatars with the trust stat,
 * a large statement, three value cards and a photo card. Slow, soft animations throughout.
 */
export function WhySection(props: WhySectionProps) {
  const isDesktop = useMediaQuery('(min-width: 1024px)');

  return (
    <MotionConfig reducedMotion="user">
      <section id={props.id} aria-labelledby={props.titleId} className="relative overflow-hidden bg-white">
        {isDesktop ? <DesktopLayout props={props} /> : <StackedLayout props={props} />}
      </section>
    </MotionConfig>
  );
}
