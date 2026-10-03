import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useInView, useReducedMotion, type PanInfo } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import slide1 from '../../assets/footer/slide-1.webp';
import slide2 from '../../assets/footer/slide-2.webp';
import slide3 from '../../assets/footer/slide-3.webp';

const SLIDES = [
  { src: slide1, alt: 'A smiling expectant mother looking at her phone' },
  { src: slide2, alt: 'An expectant couple relaxing together on a bed' },
  { src: slide3, alt: 'An expectant couple smiling together on a tropical beach' },
];

const AUTOPLAY_MS = 5000;
const SWIPE_PX = 70;

const slideVariants = {
  enter: (dir: number) => ({ x: dir >= 0 ? '55%' : '-55%', opacity: 0, scale: 0.98 }),
  center: { x: 0, opacity: 1, scale: 1 },
  exit: (dir: number) => ({ x: dir >= 0 ? '-35%' : '35%', opacity: 0, scale: 0.98 }),
};

/**
 * Photo carousel. The photos carry their own notched outline (alpha), so the footer nav and the
 * "Add Support Partner" link sit in the cut-outs. Auto-advances, drags/swipes horizontally, and has
 * arrows and dots. Autoplay pauses while off-screen, hovered, focused or dragging, and is off entirely
 * for reduced motion. Everything is sized in `em`, so set the font-size on the parent.
 */
export function FooterSlider({ className = '' }: { className?: string }) {
  const [[index, dir], setPage] = useState<[number, number]>([0, 0]);
  const [paused, setPaused] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.3 });
  const reduceMotion = useReducedMotion();

  const go = useCallback((delta: number) => {
    setPage(([i]) => [(i + delta + SLIDES.length) % SLIDES.length, delta]);
  }, []);

  useEffect(() => {
    if (!inView || paused || reduceMotion) return;
    const id = window.setInterval(() => go(1), AUTOPLAY_MS);
    return () => window.clearInterval(id);
  }, [go, inView, paused, reduceMotion, index]);

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x <= -SWIPE_PX || info.velocity.x < -500) go(1);
    else if (info.offset.x >= SWIPE_PX || info.velocity.x > 500) go(-1);
    setPaused(false);
  };

  return (
    <motion.div
      ref={ref}
      role="group"
      aria-roledescription="carousel"
      aria-label="LONI community photos"
      initial={{ opacity: 0, y: 48 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: false, amount: 0.15 }}
      transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
      onHoverStart={() => setPaused(true)}
      onHoverEnd={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      className={`relative aspect-[664/694] overflow-hidden ${className}`}
    >
      <AnimatePresence initial={false} custom={dir}>
        <motion.img
          key={index}
          src={SLIDES[index].src}
          alt={SLIDES[index].alt}
          width={664}
          height={694}
          draggable={false}
          custom={dir}
          variants={slideVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.25}
          onDragStart={() => setPaused(true)}
          onDragEnd={onDragEnd}
          className="absolute inset-0 size-full cursor-grab touch-pan-y select-none active:cursor-grabbing"
        />
      </AnimatePresence>

      <button
        type="button"
        onClick={() => go(-1)}
        aria-label="Previous photo"
        className="absolute left-[2.07em] top-[48%] z-10 inline-flex size-[3.57em] -translate-y-1/2 items-center justify-center rounded-[0.85em] bg-white/20 text-white backdrop-blur-sm transition-colors hover:bg-white/35"
      >
        <ChevronLeft className="size-[1.7em]" strokeWidth={2.4} aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={() => go(1)}
        aria-label="Next photo"
        className="absolute right-[2.07em] top-[48%] z-10 inline-flex size-[3.57em] -translate-y-1/2 items-center justify-center rounded-[0.85em] bg-white/20 text-white backdrop-blur-sm transition-colors hover:bg-white/35"
      >
        <ChevronRight className="size-[1.7em]" strokeWidth={2.4} aria-hidden="true" />
      </button>

      <div className="absolute bottom-[3.86em] left-1/2 z-10 flex -translate-x-1/2 items-center gap-[0.75em] rounded-full bg-white/20 px-[1.2em] py-[0.8em] backdrop-blur-sm">
        {SLIDES.map((slide, i) => (
          <button
            key={slide.src}
            type="button"
            onClick={() => setPage(([cur]) => [i, i >= cur ? 1 : -1])}
            aria-label={`Show photo ${i + 1}`}
            aria-current={i === index}
            className="relative size-[1em] rounded-full"
          >
            <span className="absolute inset-0 rounded-full bg-white/60" />
            {i === index && <motion.span layoutId="footer-dot" className="absolute inset-0 rounded-full bg-white" />}
          </button>
        ))}
      </div>
    </motion.div>
  );
}
