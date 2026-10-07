import type { CSSProperties } from 'react';
import { MotionConfig, motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { px } from '../showcase/designUnits';
import { TagBadge } from '../ui/TagBadge';

export interface Detail {
  title: string;
  text: string;
}

export interface CardAsset {
  src: string;
  alt: string;
}

type Point = readonly [number, number];

/** Where everything sits in the Figma canvas (1 design px = `--u`). `list` and `card` are [x, y, width]. */
export interface DetailCanvas {
  w: number;
  h: number;
  badge: Point;
  heading: Point;
  intro: Point;
  list: readonly [number, number, number];
  card: readonly [number, number, number];
  headingSize: number;
  headingLh: number;
  introSize: number;
  introLh: number;
}

export interface DetailSectionProps {
  id: string;
  titleId: string;
  badge: string;
  heading: string[];
  intro: string[];
  details: Detail[];
  card: CardAsset;
  canvas: DetailCanvas;
}

// Slow, soft easing, like the rest of the driver page.
const EASE = [0.22, 1, 0.36, 1] as const;

const at = (x: number, y: number, extra?: CSSProperties): CSSProperties => ({
  position: 'absolute',
  left: px(x),
  top: px(y),
  ...extra,
});

function Heading({
  id,
  lines,
  className = '',
  style,
}: {
  id: string;
  lines: string[];
  className?: string;
  style?: CSSProperties;
}) {
  return (
    // The observer sits on the h2 (never translated); the lines slide up from behind a mask.
    <motion.h2
      id={id}
      initial="hide"
      whileInView="show"
      viewport={{ once: false, amount: 0.6 }}
      variants={{ hide: { opacity: 0 }, show: { opacity: 1, transition: { duration: 0.9 } } }}
      className={`font-medium tracking-[-0.02em] text-black ${className}`}
      style={style}
    >
      {lines.map((line, i) => (
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

function Intro({ lines, className = '', style }: { lines: string[]; className?: string; style?: CSSProperties }) {
  return (
    <motion.p
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: false, amount: 0.6 }}
      transition={{ duration: 1.3, delay: 0.4, ease: EASE }}
      className={`text-black ${className}`}
      style={style}
    >
      {lines.map((line) => (
        <span key={line}>
          <span className="lg:block lg:whitespace-nowrap">{line}</span>{' '}
        </span>
      ))}
    </motion.p>
  );
}

/** "→ Pickup location / See exactly…" rows separated by lines that draw themselves in. Sized in `em`. */
function DetailList({
  details,
  className = '',
  style,
}: {
  details: Detail[];
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <ul className={className} style={style}>
      {details.map((item, i) => (
        <motion.li
          key={item.title}
          initial="hide"
          whileInView="show"
          viewport={{ once: false, amount: 0.7 }}
          variants={{
            hide: { opacity: 0, x: -28, transition: { duration: 0.4 } },
            show: { opacity: 1, x: 0, transition: { duration: 1.2, delay: 0.1 + i * 0.12, ease: EASE } },
          }}
          className="group relative py-6 pl-12 lg:h-[8.6em] lg:py-0 lg:pl-0"
        >
          <ArrowRight
            className="absolute left-0 top-[1.9rem] size-6 transition-transform duration-500 ease-out group-hover:translate-x-2 lg:left-[0.36em] lg:top-[3.5em] lg:size-[1.6em]"
            strokeWidth={1.75}
            aria-hidden="true"
          />
          <h3 className="text-[1.1rem] font-medium leading-snug transition-colors duration-500 group-hover:text-brand lg:absolute lg:left-[3.667em] lg:top-[1.75em] lg:text-[1.2em] lg:leading-[1.3]">
            {item.title}
          </h3>
          <p className="mt-2 text-[0.95rem] leading-snug lg:absolute lg:left-[4.4em] lg:top-[4.95em] lg:mt-0 lg:text-[1em] lg:leading-[1.4]">
            {item.text}
          </p>
          {i < details.length - 1 && (
            <motion.span
              aria-hidden="true"
              variants={{
                hide: { scaleX: 0, transition: { duration: 0.4 } },
                show: { scaleX: 1, transition: { duration: 1.5, delay: 0.3 + i * 0.12, ease: EASE } },
              }}
              className="absolute bottom-0 left-0 h-[1.5px] w-full origin-left bg-neutral-900"
            />
          )}
        </motion.li>
      ))}
    </ul>
  );
}

function CardImage({
  card,
  className = '',
  style,
}: {
  card: CardAsset;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <motion.img
      src={card.src}
      alt={card.alt}
      width={664}
      height={733}
      decoding="async"
      draggable={false}
      initial={{ opacity: 0, y: 80, scale: 0.94 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: false, amount: 0.25 }}
      transition={{ duration: 1.6, delay: 0.2, ease: EASE }}
      className={`select-none ${className}`}
      style={style}
    />
  );
}

function DesktopLayout({ props }: { props: DetailSectionProps }) {
  const { canvas: c } = props;
  return (
    <div
      className="@container relative mx-auto w-full"
      style={{ aspectRatio: `${c.w} / ${c.h}`, maxWidth: c.w, ['--u' as string]: `calc(100cqw / ${c.w})` }}
    >
      <div style={at(...c.badge)}>
        <TagBadge variant="pink">{props.badge}</TagBadge>
      </div>
      <Heading
        id={props.titleId}
        lines={props.heading}
        style={at(c.heading[0], c.heading[1], { fontSize: px(c.headingSize), lineHeight: px(c.headingLh) })}
      />
      <Intro
        lines={props.intro}
        style={at(c.intro[0], c.intro[1], { fontSize: px(c.introSize), lineHeight: px(c.introLh) })}
      />

      <DetailList details={props.details} style={at(c.list[0], c.list[1], { width: px(c.list[2]), fontSize: px(16.5) })} />
      <CardImage card={props.card} style={at(c.card[0], c.card[1], { width: px(c.card[2]) })} />
    </div>
  );
}

function StackedLayout({ props }: { props: DetailSectionProps }) {
  return (
    <div className="mx-auto max-w-[34rem] px-5 pb-16 pt-12 sm:px-8 sm:pb-20 sm:pt-16">
      <TagBadge variant="pink">{props.badge}</TagBadge>
      <Heading id={props.titleId} lines={props.heading} className="mt-7 text-[1.9rem] leading-[1.25] sm:text-4xl" />
      <Intro lines={props.intro} className="mt-5 text-[0.95rem] leading-[1.7] sm:text-base" />
      <DetailList details={props.details} className="mt-8 border-t border-transparent" />
      <CardImage card={props.card} className="mt-10 w-full" />
    </div>
  );
}

export function DetailSection(props: DetailSectionProps) {
  const isDesktop = useMediaQuery('(min-width: 1024px)');

  return (
    <MotionConfig reducedMotion="user">
      <section id={props.id} aria-labelledby={props.titleId} className="relative overflow-hidden bg-white">
        {isDesktop ? <DesktopLayout props={props} /> : <StackedLayout props={props} />}
      </section>
    </MotionConfig>
  );
}
