import type { CSSProperties, ReactNode } from 'react';
import { MotionConfig, motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { px } from '../showcase/designUnits';
import { TagBadge } from '../ui/TagBadge';

// Slow, soft easing, like the rest of the role pages.
const EASE = [0.22, 1, 0.36, 1] as const;

export interface Topic {
  title: string;
  /** One entry per line on desktop; flows as a paragraph below lg. */
  lines: string[];
  icon: ReactNode;
}

/** [x, y, width, height] in Figma design px. */
export type Rect = readonly [number, number, number, number];

export interface TopicGridProps {
  id: string;
  titleId: string;
  badge: string;
  heading: string[];
  intro: string[];
  /** Optional black pill under the intro. */
  cta?: { label: string; href: string };
  topics: Topic[];
  /** Optional photo tile that takes the last grid slot. */
  photo?: { src: string; alt: string; width: number; height: number };
  canvas: {
    w: number;
    h: number;
    badge: readonly [number, number];
    heading: readonly [number, number];
    headingSize: number;
    headingLh: number;
    intro: readonly [number, number, number];
    introSize: number;
    introLh: number;
    /** One rect per topic, then the photo's. */
    rects: Rect[];
    cardFont: number;
  };
}

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
    // The observer sits on the h2 (never translated); the lines slide up from behind a mask on desktop.
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

function Intro({
  lines,
  cta,
  className = '',
  style,
}: {
  lines: string[];
  cta?: TopicGridProps['cta'];
  className?: string;
  style?: CSSProperties;
}) {
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
        {lines.map((line) => (
          <span key={line}>
            <span className="lg:block lg:whitespace-nowrap">{line}</span>{' '}
          </span>
        ))}
      </p>
      {cta && (
        <a
          href={cta.href}
          className="group mt-5 inline-flex h-[2.7em] items-center gap-[1.1em] rounded-full bg-black px-[1.6em] text-[0.92em] font-semibold text-white transition-transform duration-300 hover:scale-[1.04] active:scale-[0.97] lg:mt-[0.85em]"
        >
          {cta.label}
          <ArrowRight
            className="size-[1.3em] transition-transform duration-300 group-hover:translate-x-1"
            strokeWidth={2.2}
            aria-hidden="true"
          />
        </a>
      )}
    </motion.div>
  );
}

/** One topic: icon tile on top, title and description pinned to the bottom. Sized in `em`. */
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
        show: {
          opacity: 1,
          y: 0,
          transition: { duration: 1.3, delay: 0.1 + (index % 3) * 0.2 + Math.floor(index / 3) * 0.15, ease: EASE },
        },
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

/** Photo tile: wipes open from the top while the picture settles from a deep zoom (observer on the unclipped wrapper). */
function PhotoTile({
  photo,
  className = '',
  style,
}: {
  photo: NonNullable<TopicGridProps['photo']>;
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

function DesktopLayout({ props }: { props: TopicGridProps }) {
  const c = props.canvas;
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
        style={at(...c.heading, { fontSize: px(c.headingSize), lineHeight: px(c.headingLh) })}
      />
      <Intro
        lines={props.intro}
        cta={props.cta}
        style={at(c.intro[0], c.intro[1], { fontSize: px(c.introSize), lineHeight: px(c.introLh), width: px(c.intro[2]) })}
      />

      {props.topics.map((topic, i) => {
        const [x, y, w, h] = c.rects[i];
        return (
          <TopicCard
            key={topic.title}
            topic={topic}
            index={i}
            style={{ ...at(x, y, { width: px(w), height: px(h) }), fontSize: px(c.cardFont) }}
          />
        );
      })}
      {props.photo && (
        <PhotoTile
          photo={props.photo}
          style={(() => {
            const [x, y, w, h] = c.rects[props.topics.length];
            return { ...at(x, y, { width: px(w), height: px(h) }), fontSize: px(c.cardFont) };
          })()}
        />
      )}
    </div>
  );
}

function StackedLayout({ props }: { props: TopicGridProps }) {
  return (
    <div className="mx-auto max-w-[34rem] px-5 pb-16 pt-12 sm:px-8 sm:pb-20 sm:pt-16">
      <TagBadge variant="pink">{props.badge}</TagBadge>
      <Heading id={props.titleId} lines={props.heading} className="mt-7 text-[1.9rem] leading-[1.25] sm:text-4xl" />
      <Intro lines={props.intro} cta={props.cta} className="mt-5 text-[0.95rem] leading-[1.7] sm:text-base" />

      <div className="mt-9 flex flex-col gap-3 text-[0.8rem]">
        {props.topics.map((topic, i) => (
          <TopicCard key={topic.title} topic={topic} index={i} className="min-h-[13.5rem]" />
        ))}
        {props.photo && <PhotoTile photo={props.photo} className="aspect-[445/302] text-[1rem]" />}
      </div>
    </div>
  );
}

/**
 * Heading + intro (+ optional button) over a grid of icon cards, optionally ending with a photo tile.
 * Shared by the driver training section and the partner "how it works" section.
 */
export function TopicGridSection(props: TopicGridProps) {
  const isDesktop = useMediaQuery('(min-width: 1024px)');

  return (
    <MotionConfig reducedMotion="user">
      <section id={props.id} aria-labelledby={props.titleId} className="relative overflow-hidden bg-white">
        {isDesktop ? <DesktopLayout props={props} /> : <StackedLayout props={props} />}
      </section>
    </MotionConfig>
  );
}
