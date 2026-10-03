import { motion } from 'framer-motion';
import community from '../../assets/community/community.webp';

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * The white swirl-patterned card with the Community screen. On entering view it rises and un-scales
 * with a soft reveal while the screenshot inside settles from a slight zoom; leaving view reverses it.
 */
export function CommunityCard({ className = '' }: { className?: string }) {
  return (
    <motion.div
      initial="hide"
      whileInView="show"
      viewport={{ once: false, amount: 0.25 }}
      variants={{
        hide: { opacity: 0, y: 64, scale: 0.94, transition: { duration: 0.35 } },
        show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.9, ease: EASE } },
      }}
      className={`@container relative aspect-[664/733] w-full overflow-hidden bg-white ${className}`}
      // ≈ 62px at the design's 793px card width.
      style={{ borderRadius: '7.8cqw' }}
    >
      <motion.img
        src={community}
        alt="The LONI Community feed: a warm space to share, ask, and encourage one another"
        width={664}
        height={733}
        decoding="async"
        draggable={false}
        className="size-full select-none object-cover"
        variants={{
          hide: { scale: 1.08, transition: { duration: 0.35 } },
          show: { scale: 1, transition: { duration: 1.4, ease: EASE } },
        }}
      />
    </motion.div>
  );
}
