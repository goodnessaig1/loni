import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import { useRef } from 'react';
import swirl from '../../assets/journey/swirl.webp';

/**
 * The translucent ribbon in the bottom-left. Slides up and fades in when the section appears and
 * drifts a little against the scroll. Position/size come from `className` (it overflows the section
 * bottom on purpose; the section clips it).
 */
export function JourneySwirl({ className = '' }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const drift = useTransform(scrollYProgress, [0, 1], [36, -36]);

  return (
    <div ref={ref} aria-hidden="true" className={`pointer-events-none absolute ${className}`}>
      <motion.div
        initial={{ opacity: 0, y: 80 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: false, amount: 0.15 }}
        transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
      >
        <motion.img
          src={swirl}
          alt=""
          width={605}
          height={474}
          decoding="async"
          draggable={false}
          className="block w-full select-none"
          style={reduceMotion ? undefined : { y: drift }}
        />
      </motion.div>
    </div>
  );
}
