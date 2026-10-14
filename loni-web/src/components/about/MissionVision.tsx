import type { CSSProperties } from 'react';
import { MotionConfig, motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import missionPhoto from '../../assets/about/mission.webp';
import visionPhoto from '../../assets/about/vision.webp';
import { SITE } from '../../config/site';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { px } from '../showcase/designUnits';

// Slow, soft easing, like the rest of the About page.
const EASE = [0.22, 1, 0.36, 1] as const;

const MISSION = [
  'We exist to make maternal support more important, more connected and more human.',
  'Giving mothers access to the right information, the right people and the right help when it matters most.',
];
const VISION = [
  'To become the trusted source of support for every mother, everywhere.',
  'We envision a world where no mother is left to navigate pregnancy through scattered information, generic internet searches and uncertain answers.',
];

/** The big heading: slides up from behind a mask (the observer sits on the unmoving h2). */
function Title({ id, children, className = '', style }: { id: string; children: string; className?: string; style?: CSSProperties }) {
  return (
    <motion.h2
      id={id}
      initial="hide"
      whileInView="show"
      viewport={{ once: false, amount: 0.8 }}
      className={`font-medium leading-none tracking-[-0.03em] text-black ${className}`}
      style={style}
    >
      <span className="block overflow-hidden pb-[0.12em]">
        <motion.span
          className="block"
          variants={{
            hide: { y: '110%', transition: { duration: 0.4 } },
            show: { y: 0, transition: { duration: 1.4, ease: EASE } },
          }}
        >
          {children}
        </motion.span>
      </span>
    </motion.h2>
  );
}

/** Two justified paragraphs that fade up one after the other. */
function Copy({ paragraphs, className = '', style }: { paragraphs: string[]; className?: string; style?: CSSProperties }) {
  return (
    <div className={`space-y-[1.6em] text-justify text-black ${className}`} style={style}>
      {paragraphs.map((p, i) => (
        <motion.p
          key={p}
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: false, amount: 0.6 }}
          transition={{ duration: 1.3, delay: 0.3 + i * 0.2, ease: EASE }}
        >
          {p}
        </motion.p>
      ))}
    </div>
  );
}

/** Small "Download App →" link whose arrow nudges on hover. */
function DownloadLink({ className = '', style }: { className?: string; style?: CSSProperties }) {
  return (
    <motion.a
      href={SITE.downloadHref}
      initial={{ opacity: 0, x: -12 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: false, amount: 0.8 }}
      transition={{ duration: 1, delay: 0.6, ease: EASE }}
      className={`group inline-flex items-center gap-[0.7em] font-semibold text-neutral-600 transition-colors hover:text-black ${className}`}
      style={style}
    >
      Download App
      <ArrowRight className="size-[1.4em] transition-transform duration-300 group-hover:translate-x-1" strokeWidth={2.2} aria-hidden="true" />
    </motion.a>
  );
}

/**
 * Photo that wipes open from the side it sits on while settling from a zoom (observer on the unclipped
 * wrapper - an element clipped to nothing never reports as in view).
 */
function Photo({
  src,
  alt,
  from,
  position,
  className = '',
  style,
}: {
  src: string;
  alt: string;
  from: 'left' | 'right';
  position: string;
  className?: string;
  style?: CSSProperties;
}) {
  const hidden = from === 'left' ? 'inset(0 100% 0 0 round 4.4% / 5.5%)' : 'inset(0 0 0 100% round 4.4% / 5.5%)';
  return (
    <motion.div initial="hide" whileInView="show" viewport={{ once: false, amount: 0.3 }} className={className} style={style}>
      <motion.div
        className="size-full overflow-hidden bg-neutral-100"
        variants={{
          hide: { clipPath: hidden, transition: { duration: 0.5 } },
          show: { clipPath: 'inset(0 0% 0 0% round 4.4% / 5.5%)', transition: { duration: 1.7, delay: 0.2, ease: EASE } },
        }}
      >
        <motion.img
          src={src}
          alt={alt}
          width={1408}
          height={768}
          loading="lazy"
          decoding="async"
          draggable={false}
          className="size-full select-none object-cover"
          style={{ objectPosition: position }}
          variants={{
            hide: { scale: 1.25, transition: { duration: 0.5 } },
            show: { scale: 1, transition: { duration: 2.4, delay: 0.2, ease: EASE } },
          }}
        />
      </motion.div>
    </motion.div>
  );
}

const at = (x: number, y: number, extra?: CSSProperties): CSSProperties => ({
  position: 'absolute',
  left: px(x),
  top: px(y),
  ...extra,
});

function Stage({ w, h, children }: { w: number; h: number; children: React.ReactNode }) {
  return (
    <div
      className="@container relative mx-auto w-full"
      style={{ aspectRatio: `${w} / ${h}`, maxWidth: 1692, ['--u' as string]: `calc(100cqw / ${w})` }}
    >
      {children}
    </div>
  );
}

function DesktopMission() {
  return (
    <Stage w={1134} h={640}>
      <Title id="mission-title" className="text-right" style={{ position: 'absolute', right: px(34), top: px(26), fontSize: px(84) }}>
        Our Mission
      </Title>
      <DownloadLink style={at(42, 142, { fontSize: px(12.5) })} />
      <Photo
        src={missionPhoto}
        alt="An expectant mother in a blue patterned dress shows her partner something on her phone as they relax at home"
        from="left"
        position="48% center"
        style={at(16, 168, { width: px(459), height: px(380) })}
      />
      <Copy paragraphs={MISSION} style={at(581, 280, { width: px(344), fontSize: px(14.5), lineHeight: px(24.4) })} />
    </Stage>
  );
}

function DesktopVision() {
  return (
    <Stage w={1134} h={600}>
      <Title id="vision-title" style={{ position: 'absolute', left: px(402), top: px(0), fontSize: px(54) }}>
        Our Vision
      </Title>
      <Photo
        src={visionPhoto}
        alt="A grandmother and her pregnant daughter smile at a phone together at an outdoor farmers' market"
        from="right"
        position="40% center"
        style={at(401, 110, { width: px(729), height: px(457) })}
      />
      <Copy paragraphs={VISION} style={at(42, 318, { width: px(254), fontSize: px(14.2), lineHeight: px(24.3) })} />
      <DownloadLink style={{ position: 'absolute', right: px(27), top: px(588), fontSize: px(12.5) }} />
    </Stage>
  );
}

function StackedLayout() {
  return (
    <div className="mx-auto max-w-[34rem] space-y-16 px-5 pb-16 pt-10 sm:px-8 sm:pb-20">
      <div>
        <Title id="mission-title" className="text-right text-[2.6rem] sm:text-5xl">
          Our Mission
        </Title>
        <Copy paragraphs={MISSION} className="mt-6 text-[0.92rem] leading-[1.6]" />
        <div className="mt-6 text-right">
          <DownloadLink className="text-[0.8rem]" />
        </div>
        <Photo
          src={missionPhoto}
          alt="An expectant mother in a blue patterned dress shows her partner something on her phone as they relax at home"
          from="left"
          position="50% center"
          className="mt-4 aspect-[1.42] w-full"
        />
      </div>

      <div className="pl-[17%]">
        <Title id="vision-title" className="text-[2.2rem] sm:text-[2.6rem]">
          Our Vision
        </Title>
        <Copy paragraphs={VISION} className="mt-6 text-[0.92rem] leading-[1.6]" />
        <Photo
          src={visionPhoto}
          alt="A grandmother and her pregnant daughter smile at a phone together at an outdoor farmers' market"
          from="right"
          position="42% center"
          className="-ml-[20.5%] mt-10 aspect-[1.42] w-[120.5%]"
        />
        <div className="mt-5 text-right">
          <DownloadLink className="text-[0.8rem]" />
        </div>
      </div>
    </div>
  );
}

export function MissionVision() {
  const isDesktop = useMediaQuery('(min-width: 1024px)');

  return (
    <MotionConfig reducedMotion="user">
      <section id="mission-vision" aria-label="Our mission and vision" className="relative overflow-hidden bg-white">
        {isDesktop ? (
          <div className="space-y-6 px-[0.4%] pb-12 pt-6">
            <DesktopMission />
            <DesktopVision />
          </div>
        ) : (
          <StackedLayout />
        )}
      </section>
    </MotionConfig>
  );
}
