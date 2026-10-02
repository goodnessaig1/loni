import { useRef } from 'react';
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import { CANVAS_H, CANVAS_W } from './designUnits';
import { Hub } from './Hub';
import { PhoneMockup } from './PhoneMockup';
import { RoadRoute } from './RoadRoute';
import { stageVariants } from './motionPresets';
import { ROADS } from './roads';

/**
 * "Everyone on the road with you" – the app mockup with four coloured roads
 * (nurse, partner, hospital, driver) running into it.
 *
 * The stage is laid out in Figma pixels (see designUnits.ts) and scales as one
 * piece: at ≥ 1466px wide it is 1:1, below that it shrinks proportionally down
 * to 760px, after which the sides are simply cropped so the phone stays a
 * sensible size on small screens.
 *
 * Animation: scrolling into view plays the entrance (phone rises, roads lay
 * themselves out from the phone, captions + badge pop in); scrolling out plays
 * the reverse. The phone also drifts slightly with scroll. Reduced-motion users
 * get the finished composition with no movement.
 */
export function RoadsShowcase() {
  const stageRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();

  const { scrollYProgress } = useScroll({ target: stageRef, offset: ['start end', 'end start'] });
  const parallaxY = useTransform(scrollYProgress, [0, 1], [36, -36]);

  return (
    <section
      aria-label="LONI connects mothers with verified nurses, partners, hospitals and drivers"
      className="relative -mt-6 flex justify-center overflow-hidden pb-16 sm:pb-20 lg:-mt-9 lg:pb-24"
    >
      <motion.div
        ref={stageRef}
        className="@container relative shrink-0 [--u:calc(100cqw/1466.306)]"
        style={{ width: 'clamp(760px, 101.8vw, 1466.306px)', aspectRatio: `${CANVAS_W} / ${CANVAS_H}` }}
        variants={stageVariants}
        initial={reduceMotion ? 'show' : 'hide'}
        animate={reduceMotion ? 'show' : undefined}
        whileInView={reduceMotion ? undefined : 'show'}
        viewport={{ amount: 0.2 }}
      >
        {ROADS.map((road, i) => (
          <RoadRoute key={road.id} road={road} index={i} />
        ))}
        <Hub />
        <PhoneMockup parallaxY={reduceMotion ? undefined : parallaxY} />
      </motion.div>
    </section>
  );
}
