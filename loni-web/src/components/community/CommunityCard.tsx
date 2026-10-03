import { useRef } from 'react';
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import community from '../../assets/community/community.webp';

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * The white swirl-patterned card with the Community screen. On entering view it rises and un-scales
 * with a soft reveal; the screenshot inside drifts slowly against the scroll (off for reduced motion).
 */
export function CommunityCard({ className = '' }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const y = useTransform(scrollYProgress, [0, 1], ['2%', '-2%']);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 64, scale: 0.94 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: false, amount: 0.25 }}
      transition={{ duration: 0.9, ease: EASE }}
      className={`@container relative aspect-[664/733] w-full overflow-hidden bg-white ${className}`}
      style={{ borderRadius: '11cqw' }}
    >
      <motion.img
        src={community}
        alt="The LONI Community feed: a warm space to share, ask, and encourage one another"
        width={664}
        height={733}
        decoding="async"
        draggable={false}
        className="absolute inset-0 size-full select-none object-cover"
        style={reduceMotion ? undefined : { y, scale: 1.04 }}
      />
    </motion.div>
  );
}
