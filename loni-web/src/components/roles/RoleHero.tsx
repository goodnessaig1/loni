import type { ReactNode } from 'react';
import { MotionConfig, motion } from 'framer-motion';
import { ArrowDown, ArrowRight } from 'lucide-react';

const EASE = [0.22, 1, 0.36, 1] as const;

/** The Figma vignette: transparent around the people, black toward the edges. */
const VIGNETTE = 'radial-gradient(61.64% 60.72% at 62.02% 39.28%, rgba(0,0,0,0) 0%, #000 100%)';

interface Cta {
  label: string;
  href: string;
}

interface Props {
  /** Prefix for the heading id (`${id}-title`). */
  id: string;
  /** Pill above the heading, e.g. "For Drivers". */
  tag: string;
  heading: string[];
  /** One entry per line on desktop; flows as a paragraph below lg. */
  intro: string[];
  /** The photo, with its outline (rounded corners + header tab) in the alpha channel. */
  photo: string;
  /** Pink pill (with →). */
  primary?: Cta;
  /** White pill (with ↓), placed before `primary`. */
  secondary?: Cta;
  /** A single white pill with → (the partner hero's "Join LONI"). */
  lightCta?: Cta;
  /**
   * Where the copy sits on desktop: `top` (≈21% down, with a card at the bottom), `bottom` (all
   * anchored low-left), or `split` (heading low-left, intro + button low-right).
   */
  layout?: 'top' | 'bottom' | 'split';
  /** Horizontal focus of the photo when it is cropped on narrow screens (CSS `background-position-x`). */
  focusX?: string;
  /** Extra content, e.g. the driver hero's trip card. */
  children?: ReactNode;
}

/**
 * Shared hero for the role pages ("For Drivers", "For Nurses", "For Partners & Family").
 *
 * The photo carries its own outline in its alpha channel: rounded corners, plus a raised "tab" along
 * the top that lines up with the header's gap. It is used as a mask, so the vignette is clipped to the
 * same silhouette. Its transparent top band is 6.08% of its height:
 *  - ≥ lg the hero reaches up under the header (`-mt-14`), a black strip fills the header tab, and the
 *    photo starts exactly under the header (the `top` calc solves band = 6.08% of the photo's height);
 *  - < lg the header is a separate white bar, so the band (and the rounded top corners) are pushed out
 *    of view above the hero.
 */
export function RoleHero({
  id,
  tag,
  heading,
  intro,
  photo,
  primary,
  secondary,
  lightCta,
  layout = 'top',
  focusX = '38%',
  children,
}: Props) {
  const titleId = `${id}-title`;
  const top = layout === 'top';
  const split = layout === 'split';

  const pill = (
    <motion.span
      initial={{ opacity: 0, scale: 0.85, y: 12 }}
      whileInView={{ opacity: 1, scale: 1, y: 0 }}
      viewport={{ once: false, amount: 0.8 }}
      transition={{ type: 'spring', stiffness: 260, damping: 20 }}
      className="inline-flex h-[2.3em] items-center rounded-full border-x border-white bg-black px-[2.05em] text-[0.85em] font-bold"
    >
      {tag}
    </motion.span>
  );

  // The observer sits on the h1 (never translated); the lines slide up from behind a mask.
  const title = (
    <motion.h1
      id={titleId}
      initial="hide"
      whileInView="show"
      viewport={{ once: false, amount: 0.6 }}
      className={`mt-[0.9em] font-semibold leading-none tracking-[-0.03em] sm:max-w-[30rem] lg:mt-[0.9em] lg:max-w-none lg:text-[3.87em] lg:leading-[0.95] lg:tracking-[-0.035em] ${
        top ? 'max-w-[15.6rem] text-[2.9rem]' : split ? 'max-w-[19rem] text-[3.1rem]' : 'max-w-[21rem] text-[2.35rem]'
      }`}
    >
      {heading.map((line, i) => (
        <span key={line} className="block overflow-hidden pb-[0.08em]">
          <motion.span
            className="block"
            variants={{
              hide: { y: '110%', transition: { duration: 0.3 } },
              show: { y: 0, transition: { duration: 0.8, delay: 0.1 + i * 0.12, ease: EASE } },
            }}
          >
            {line}
          </motion.span>
        </span>
      ))}
    </motion.h1>
  );

  const introText = (
    <motion.p
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: false, amount: 0.6 }}
      transition={{ duration: 0.7, delay: 0.4, ease: EASE }}
      className={`mt-[1.3em] leading-snug lg:max-w-none lg:leading-[1.3] ${
        split ? 'max-w-[20rem] sm:max-w-md lg:mt-0 lg:text-[1em]' : 'max-w-[17rem] sm:max-w-md lg:text-[1.08em]'
      }`}
    >
      {intro.map((line) => (
        <span key={line}>
          <span className="lg:block lg:whitespace-nowrap">{line}</span>{' '}
        </span>
      ))}
    </motion.p>
  );

  const buttons = (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: false, amount: 0.6 }}
      transition={{ duration: 0.7, delay: 0.55, ease: EASE }}
      className={`flex flex-col items-start gap-[0.5em] lg:flex-row ${split ? 'mt-[1.8em] lg:mt-[1.2em]' : 'mt-[2.4em]'}`}
    >
      {secondary && (
        <a
          href={secondary.href}
          className="group inline-flex h-[2.85em] items-center gap-[0.7em] rounded-full bg-white px-[2.1em] text-[0.97em] font-medium text-[#0b2a26] transition-transform hover:scale-[1.03] active:scale-[0.97] lg:h-[2.95em] lg:text-[1em]"
        >
          {secondary.label}
          <ArrowDown
            className="size-[1.25em] transition-transform duration-200 group-hover:translate-y-0.5"
            strokeWidth={2}
            aria-hidden="true"
          />
        </a>
      )}
      {primary && (
        <a
          href={primary.href}
          className="group inline-flex h-[2.85em] items-center gap-[0.7em] rounded-full bg-brand px-[2em] text-[0.97em] font-medium text-white transition-transform hover:scale-[1.03] active:scale-[0.97] lg:h-[2.95em] lg:text-[1em]"
        >
          {primary.label}
          <ArrowRight
            className="size-[1.25em] transition-transform duration-200 group-hover:translate-x-1"
            strokeWidth={2}
            aria-hidden="true"
          />
        </a>
      )}
      {lightCta && (
        <a
          href={lightCta.href}
          className="group inline-flex h-[2.85em] items-center gap-[0.8em] rounded-full bg-white px-[2.1em] text-[0.97em] font-semibold text-black transition-transform hover:scale-[1.03] active:scale-[0.97] lg:h-[3.05em] lg:px-[2.2em] lg:text-[1em]"
        >
          {lightCta.label}
          <ArrowRight
            className="size-[1.25em] transition-transform duration-200 group-hover:translate-x-1"
            strokeWidth={2.2}
            aria-hidden="true"
          />
        </a>
      )}
    </motion.div>
  );

  return (
    <MotionConfig reducedMotion="user">
      <section
        aria-labelledby={titleId}
        className="relative flex min-h-[45.6rem] flex-col overflow-hidden rounded-b-[1.5rem] bg-black md:min-h-[52rem] lg:-mt-14 lg:min-h-[max(44rem,calc(100svh_-_1.5rem))] lg:rounded-b-[28px] lg:pt-14"
      >
        <motion.div
          aria-hidden="true"
          initial={{ scale: 1.06, opacity: 0.5 }}
          whileInView={{ scale: 1, opacity: 1 }}
          viewport={{ once: false, amount: 0.3 }}
          transition={{ duration: 1.6, ease: EASE }}
          className="absolute inset-0 bg-cover bg-no-repeat"
          style={{
            backgroundImage: `${VIGNETTE}, url(${photo})`,
            backgroundPosition: `var(--focus-x) center`,
            ['--focus-x' as string]: focusX,
          }}
        />

        <div
          className={`relative z-10 flex flex-1 flex-col px-4 text-[14px] text-white sm:px-8 lg:static lg:p-0 lg:text-[min(1.2vw,1.35rem)] ${
            top ? 'pb-[0.95rem] pt-[8.1rem]' : 'justify-end pb-8 pt-40'
          }`}
        >
          {split ? (
            <>
              <div className="lg:absolute lg:bottom-[11.8%] lg:left-[2.75%]">
                {pill}
                {title}
              </div>
              <div className="lg:absolute lg:bottom-[11.8%] lg:left-[63.5%]">
                {introText}
                {buttons}
              </div>
            </>
          ) : (
            <div
              className={
                top ? 'lg:absolute lg:left-[3.5%] lg:top-[21.2%]' : 'lg:absolute lg:bottom-[8.9%] lg:left-[2.65%]'
              }
            >
              {pill}
              {title}
              {introText}
              {buttons}
            </div>
          )}

          {children}
        </div>
      </section>
    </MotionConfig>
  );
}
