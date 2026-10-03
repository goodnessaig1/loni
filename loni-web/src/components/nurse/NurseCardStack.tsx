import { motion } from 'framer-motion';
import nurse from '../../assets/nurse/nurse.webp';

const SPRING = { type: 'spring', stiffness: 90, damping: 16 } as const;
const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * The nurse photo with a black and a light-pink card fanned out behind it. Fills its parent, which
 * must be 393:727 (the photo's ratio). On entering view the two back cards start hidden behind the
 * photo and swing open (pink first, then black); leaving view folds them shut again.
 */
export function NurseCardStack() {
  // 10cqw ≈ the photo's own corner radius, so the back cards follow it at any size.
  const layer = { transformOrigin: '0% 100%', borderRadius: '10cqw' } as const;

  return (
    <motion.div
      className="@container relative size-full"
      initial="hide"
      whileInView="show"
      viewport={{ once: false, amount: 0.35 }}
    >
      <motion.div
        aria-hidden="true"
        className="absolute bottom-0 left-0 h-[85.5%] w-full bg-black"
        style={layer}
        variants={{
          hide: { rotate: 0, x: '4%', opacity: 0, transition: { duration: 0.35 } },
          show: { rotate: -6, x: 0, opacity: 1, transition: { ...SPRING, delay: 0.45 } },
        }}
      />
      <motion.div
        aria-hidden="true"
        className="absolute bottom-0 left-0 h-[89%] w-full bg-[#F68AA8]"
        style={layer}
        variants={{
          hide: { rotate: 0, x: '2.5%', opacity: 0, transition: { duration: 0.35 } },
          show: { rotate: -3, x: 0, opacity: 1, transition: { ...SPRING, delay: 0.3 } },
        }}
      />
      <motion.div
        className="relative size-full overflow-hidden"
        style={{ borderRadius: '10cqw' }}
        variants={{
          hide: { y: 48, scale: 0.94, opacity: 0, transition: { duration: 0.35 } },
          show: { y: 0, scale: 1, opacity: 1, transition: { duration: 0.8, ease: EASE } },
        }}
      >
        <motion.img
          src={nurse}
          alt="A smiling LONI nurse on a phone call"
          width={393}
          height={727}
          decoding="async"
          draggable={false}
          className="size-full select-none object-cover"
          variants={{
            hide: { scale: 1.12, transition: { duration: 0.35 } },
            show: { scale: 1, transition: { duration: 1.3, ease: EASE } },
          }}
        />
      </motion.div>
    </motion.div>
  );
}
