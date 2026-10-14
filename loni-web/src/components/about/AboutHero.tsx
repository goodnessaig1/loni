import type { CSSProperties } from 'react';
import { MotionConfig, motion } from 'framer-motion';
import { Link } from 'react-router';
import { ArrowUpRight } from 'lucide-react';
import aboutPhoto from '../../assets/about/hero.webp';
import { SITE } from '../../config/site';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { CountUp } from '../pricing/CountUp';
import { px } from '../showcase/designUnits';

// Slow, soft easing, like the other long-form pages.
const EASE = [0.22, 1, 0.36, 1] as const;

const HEADING_LINES = ['To be there when you', 'need to know what to do', 'next.'];
const INTRO =
  'Loni gives every mother a trusted support system in her pocket, combining intelligent guidance, human nurse support, emergency assistance and a connected community to help her make informed decisions throughout pregnancy.';

/** Figma canvas of the desktop composition, measured from just under the header. */
const W = 1658;
const H = 1074;

const at = (x: number, y: number, extra?: CSSProperties): CSSProperties => ({
  position: 'absolute',
  left: px(x),
  top: px(y),
  ...extra,
});

function Heading({ className = '', style }: { className?: string; style?: CSSProperties }) {
  return (
    // The observer sits on the h1 (never translated); the lines slide up from behind a mask on desktop.
    <motion.h1
      id="about-title"
      initial="hide"
      whileInView="show"
      viewport={{ once: false, amount: 0.6 }}
      variants={{ hide: { opacity: 0 }, show: { opacity: 1, transition: { duration: 0.9 } } }}
      className={`font-medium tracking-[-0.025em] text-black ${className}`}
      style={style}
    >
      {HEADING_LINES.map((line, i) => (
        <span key={line}>
          <span className="inline lg:block lg:overflow-hidden lg:pb-[0.08em]">
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
    </motion.h1>
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
      <p className="text-justify text-black">{INTRO}</p>
      <Link
        to={SITE.exploreLoniHref}
        className="group mt-6 inline-flex items-center text-[0.8em] lg:mt-[1.9em]"
      >
        <span className="inline-flex h-[2.4em] items-center rounded-full bg-black px-[1.5em] font-semibold text-white transition-colors group-hover:bg-neutral-800">
          Explore Loni
        </span>
        <span className="-ml-px inline-flex size-[2.4em] items-center justify-center rounded-full bg-black text-white transition-colors group-hover:bg-neutral-800">
          <ArrowUpRight
            className="size-[1.1em] transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
            strokeWidth={2.4}
            aria-hidden="true"
          />
        </span>
      </Link>
    </motion.div>
  );
}

/** The photo: wipes open from the top while settling from a deep zoom (observer on the unclipped wrapper). */
function Photo({ className = '', style }: { className?: string; style?: CSSProperties }) {
  return (
    <motion.div
      initial="hide"
      whileInView="show"
      viewport={{ once: false, amount: 0.25 }}
      className={className}
      style={style}
    >
      <motion.div
        className="size-full overflow-hidden bg-neutral-100"
        style={{ borderRadius: '3.7% / 4.7%' }}
        variants={{
          hide: { clipPath: 'inset(0 0 100% 0)', opacity: 0.4, transition: { duration: 0.5 } },
          show: { clipPath: 'inset(0 0 0% 0)', opacity: 1, transition: { duration: 1.7, delay: 0.5, ease: EASE } },
        }}
      >
        <motion.img
          src={aboutPhoto}
          alt="A smiling expectant mother in a blue patterned dress relaxing in an armchair and looking at her phone"
          width={722}
          height={568}
          decoding="async"
          draggable={false}
          className="size-full select-none object-cover"
          variants={{
            hide: { scale: 1.25, transition: { duration: 0.5 } },
            show: { scale: 1, transition: { duration: 2.4, delay: 0.5, ease: EASE } },
          }}
        />
      </motion.div>
    </motion.div>
  );
}

/** Big light-grey figure over a small grey caption. `suffix` is the smaller "/7". */
function Stat({
  value,
  suffix,
  caption,
  index,
  className = '',
  style,
}: {
  value: number;
  suffix?: string;
  caption: string;
  index: number;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: false, amount: 0.8 }}
      transition={{ duration: 1.2, delay: 0.3 + index * 0.15, ease: EASE }}
      className={className}
      style={style}
    >
      <p className="font-light leading-none tracking-[-0.02em] text-neutral-300" style={{ fontSize: '2.5em' }}>
        <CountUp value={value} duration={2.2} pad={2} />
        {suffix && <span className="text-[0.5em] text-neutral-300">{suffix}</span>}
      </p>
      <p className="mt-[0.7em] text-neutral-500">{caption}</p>
    </motion.div>
  );
}

function Levels({ className = '', style }: { className?: string; style?: CSSProperties }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: false, amount: 0.8 }}
      transition={{ duration: 1.2, delay: 0.75, ease: EASE }}
      className={className}
      style={style}
    >
      <h2 className="text-[1.25em] font-medium leading-snug text-black">Levels of support</h2>
      <p className="mt-[0.5em] text-black">AI guidance &amp; human nurse support</p>
    </motion.div>
  );
}

function DesktopLayout() {
  return (
    <div
      className="@container relative mx-auto w-full max-w-[1658px] [--u:calc(100cqw/1658)]"
      style={{ aspectRatio: `${W} / ${H}` }}
    >
      <Heading style={at(60, 160, { fontSize: px(49), lineHeight: px(48) })} />
      <Intro style={at(769, 147, { width: px(820), fontSize: px(22.5), lineHeight: px(29.5) })} />
      <Photo style={at(769, 392, { width: px(820), height: px(644) })} />

      <Stat value={5} caption="Support pillars" index={0} style={at(60, 593, { fontSize: px(16.5) })} />
      <Stat value={24} suffix="/7" caption="Support ecosystem" index={1} style={at(60, 691, { fontSize: px(16.5) })} />
      <Levels style={at(60, 962, { fontSize: px(16.5) })} />
    </div>
  );
}

function StackedLayout() {
  return (
    <div className="mx-auto max-w-[34rem] px-5 pb-8 pt-10 sm:px-8 sm:pb-12 sm:pt-12">
      <Heading className="text-[2.1rem] leading-[1.15] sm:text-[2.6rem]" />
      <Intro className="mt-6 text-[0.95rem] leading-[1.6] sm:text-base" />
      <Photo className="mt-9 aspect-[722/568] w-full" />
      <div className="mt-10 grid grid-cols-2 gap-6 text-[0.95rem]">
        <Stat value={5} caption="Support pillars" index={0} />
        <Stat value={24} suffix="/7" caption="Support ecosystem" index={1} />
        <Levels className="col-span-2" />
      </div>
    </div>
  );
}

export function AboutHero() {
  const isDesktop = useMediaQuery('(min-width: 1024px)');

  return (
    <MotionConfig reducedMotion="user">
      <section aria-labelledby="about-title" className="relative overflow-hidden bg-white">
        {isDesktop ? <DesktopLayout /> : <StackedLayout />}
      </section>
    </MotionConfig>
  );
}
