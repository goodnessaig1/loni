import { motion } from 'framer-motion';
import mother from '../../assets/hero-mother.webp';

/**
 * The right-hand artwork: soft pink heart shapes with the cut-out portrait in front.
 * It fills whatever box it is given. Her hands touch the top and she is taller than
 * the box, so the hero (overflow hidden) crops her around the hips like the design.
 * The same piece works beside the text on desktop and under it on phones.
 */
export function HeroArt({ className = '' }: { className?: string }) {
  return (
    <div aria-hidden="true" className={`pointer-events-none ${className || 'relative'}`}>
      {/* Heart shapes. Drawn in SVG so they stay crisp and scale with the box. */}
      <motion.svg
        viewBox="0 0 640 560"
        preserveAspectRatio="xMidYMax meet"
        className="absolute bottom-0 -left-[6%] h-full w-[106%]"
        initial={{ opacity: 0, scale: 0.9 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 1, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
        style={{ transformOrigin: '50% 80%' }}
      >
        <circle cx="168" cy="452" r="128" fill="#f7c4de" />
        <circle cx="356" cy="104" r="108" fill="#f6bcd9" />
        <path
          d="M300 548 C 210 470 70 380 70 248 C 70 150 140 92 220 92 C 270 92 306 120 326 156 C 346 120 384 92 434 92 C 520 92 590 156 590 252 C 590 384 430 476 300 548 Z"
          fill="#f2a3cb"
          transform="rotate(-8 330 320)"
        />
      </motion.svg>

      <motion.img
        src={mother}
        alt=""
        width={1028}
        height={1529}
        fetchPriority="high"
        draggable={false}
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 1, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className="absolute top-0 left-1/2 h-[132%] w-auto max-w-none -translate-x-[44%] select-none"
      />
    </div>
  );
}
