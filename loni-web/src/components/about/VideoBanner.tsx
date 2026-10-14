import { useEffect, useRef } from 'react';
import { MotionConfig, motion, useInView, useReducedMotion } from 'framer-motion';
import poster from '../../assets/about/mother-ball-poster.webp';
import clip from '../../assets/about/mother-ball.mp4';

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * Full-width looping clip of an expectant mother on a birthing ball, under a translucent LONI-pink wash
 * (#D62D88 at 62%). The 10 MB source GIF is served as a 0.4 MB muted mp4 (same pixels, same loop);
 * it only plays while on screen, and reduced-motion users get the still poster.
 */
export function VideoBanner() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const inView = useInView(frameRef, { amount: 0.2 });
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const video = videoRef.current;
    if (!video || reduceMotion) return;
    if (inView) void video.play().catch(() => undefined);
    else video.pause();
  }, [inView, reduceMotion]);

  return (
    <MotionConfig reducedMotion="user">
      <section aria-label="A mother-to-be relaxing at home with her phone" className="relative overflow-hidden bg-white px-5 pb-3 sm:px-8 lg:px-[0.4%] lg:pb-4">
        <motion.div
          ref={frameRef}
          initial={{ opacity: 0, y: 60, scale: 0.95 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: false, amount: 0.15 }}
          transition={{ duration: 1.5, ease: EASE }}
          className="relative mx-auto aspect-video w-full max-w-[1692px] overflow-hidden rounded-[1.1rem] bg-neutral-200 lg:rounded-[1.6%/2.9%]"
        >
          <video
            ref={videoRef}
            src={clip}
            poster={poster}
            muted
            loop
            playsInline
            preload="metadata"
            aria-hidden="true"
            className="absolute inset-0 size-full object-cover"
          />
          <div aria-hidden="true" className="absolute inset-0 bg-[#D62D88]/[0.62]" />
        </motion.div>
      </section>
    </MotionConfig>
  );
}
