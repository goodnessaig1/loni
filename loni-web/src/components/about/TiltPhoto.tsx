import { useRef } from 'react';
import { MotionConfig, motion, useReducedMotion, useScroll, useSpring, useTransform } from 'framer-motion';
import taxi from '../../assets/about/taxi.webp';

/**
 * The wide "mother in a taxi" photo. It starts leaning back (tilted on its bottom edge, a touch smaller
 * and softly dimmed) and straightens as you scroll, reaching flat when it is fully in view. The motion is
 * tied to scroll position, so it also leans back again if you scroll up. Reduced motion: shown flat.
 */
export function TiltPhoto() {
  const ref = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();

  // 0 when the photo's top edge enters at the bottom of the viewport; 1 when its bottom edge does.
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end end'] });
  const progress = useSpring(scrollYProgress, { stiffness: 90, damping: 24, mass: 0.6 });

  const rotateX = useTransform(progress, [0, 1], [42, 0]);
  const scale = useTransform(progress, [0, 1], [0.84, 1]);
  const y = useTransform(progress, [0, 1], [70, 0]);
  const shade = useTransform(progress, [0, 1], [0.3, 0]);

  return (
    <MotionConfig reducedMotion="user">
      <section aria-label="A mother riding to the hospital" className="relative overflow-hidden bg-white">
        <div ref={ref} className="mx-auto max-w-[1692px] px-5 pb-8 sm:px-8 lg:px-[2.3%] lg:pb-14" style={{ perspective: '1500px' }}>
          <motion.div
            className="relative"
            style={
              reduceMotion
                ? undefined
                : { rotateX, scale, y, transformOrigin: '50% 100%', transformStyle: 'preserve-3d', willChange: 'transform' }
            }
          >
            <img
              src={taxi}
              alt="A pregnant mother in a patterned dress checks her phone in the back of a taxi in a busy city street"
              width={1413}
              height={586}
              loading="lazy"
              decoding="async"
              draggable={false}
              className="block aspect-[1.36] w-full select-none rounded-[1.6rem] object-cover object-[40%_center] sm:aspect-[1.8] lg:aspect-[1413/586] lg:rounded-none lg:object-fill"
            />
            {/* Darkens the far (top) edge while it leans back; fades out as it straightens. */}
            {!reduceMotion && (
              <motion.span
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 rounded-[1.6rem] bg-gradient-to-b from-black to-transparent lg:rounded-[2.2%/5.3%]"
                style={{ opacity: shade }}
              />
            )}
          </motion.div>
        </div>
      </section>
    </MotionConfig>
  );
}
