import { motion } from 'framer-motion';
import heartHands from '../../assets/intro/heart-hands.webp';
import silhouette from '../../assets/intro/silhouette.webp';
import babyHands from '../../assets/intro/baby-hands.webp';

/**
 * Photo chips sit *inside* the heading text flow and are sized in `em`, so
 * they scale with the type and wrap with the words at every screen width.
 */
function ChipPill({ src, delay = 0.3 }: { src: string; delay?: number }) {
  return (
    <motion.span
      aria-hidden="true"
      initial={{ opacity: 0, scale: 0.4, rotate: -8 }}
      whileInView={{ opacity: 1, scale: 1, rotate: 0 }}
      viewport={{ once: false }}
      transition={{
        type: 'spring',
        stiffness: 260,
        damping: 18,
        delay,
      }}
      whileHover={{ scale: 1.15, rotate: 3 }}
      className="mx-[0.12em] inline-block h-[0.845em] w-[1.31em] align-middle cursor-pointer"
    >
      <img src={src} alt="" draggable={false} className="size-full rounded-full object-cover shadow-sm" />
    </motion.span>
  );
}

function ChipPair({ first, second, delay = 0.45 }: { first: string; second: string; delay?: number }) {
  return (
    <motion.span
      aria-hidden="true"
      initial={{ opacity: 0, scale: 0.4, rotate: 8 }}
      whileInView={{ opacity: 1, scale: 1, rotate: 0 }}
      viewport={{ once: false }}
      transition={{
        type: 'spring',
        stiffness: 260,
        damping: 18,
        delay,
      }}
      whileHover={{ scale: 1.15, rotate: -3 }}
      className="relative mx-[0.12em] inline-block h-[0.845em] w-[1.49em] align-middle cursor-pointer"
    >
      <img src={first} alt="" draggable={false} className="absolute left-0 top-0 size-[0.845em] rounded-full object-cover shadow-sm" />
      <img src={second} alt="" draggable={false} className="absolute left-[0.644em] top-0 size-[0.845em] rounded-full object-cover shadow-sm" />
    </motion.span>
  );
}

export function IntroHeading() {
  return (
    <motion.h2
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: false }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      className="mx-auto max-w-[48rem] bg-[linear-gradient(111deg,#e2027a_30.6%,#c36598_99.3%)] bg-clip-text text-center text-[2rem] font-semibold leading-[1.3] text-transparent text-balance sm:text-[2.5rem] lg:text-[3.1rem]"
    >
      A clear <ChipPill src={heartHands} delay={0.3} /> entry to the<br className="hidden sm:inline" /> ever-changing{' '}
      <ChipPair first={silhouette} second={babyHands} delay={0.45} /> world of<br className="hidden sm:inline" /> pregnancy support
    </motion.h2>
  );
}
