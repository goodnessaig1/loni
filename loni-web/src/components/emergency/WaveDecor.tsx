import type { RefObject } from 'react';
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import wave from '../../assets/emergency/wave.webp';

/**
 * The translucent ribbon behind the content. One asset serves as both the
 * wave along the bottom and the curl at the right edge (the image covers the
 * middle of it). It drifts slowly with scroll, and fades/scales in and out. Desktop only: the mobile
 * design has a plain pink background.
 */
export function WaveDecor({ sectionRef }: { sectionRef: RefObject<HTMLElement | null> }) {
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ['start end', 'end start'] });
  const y = useTransform(scrollYProgress, [0, 1], [50, -50]);

  return (
    <motion.div
      aria-hidden="true"
      style={{ y: reduceMotion ? 0 : y }}
      className="pointer-events-none absolute left-[52.5%] top-[40.5%] hidden w-[47.5%] select-none lg:block"
    >
      <motion.img
        src={wave}
        alt=""
        width={684}
        height={597}
        loading="lazy"
        decoding="async"
        draggable={false}
        initial={{ opacity: 0, scale: 0.92 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: false, amount: 0.15 }}
        transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
        className="block h-auto w-full"
      />
    </motion.div>
  );
}
