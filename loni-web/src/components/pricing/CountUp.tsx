import { useEffect, useRef } from 'react';
import { animate, motion, useInView, useMotionValue, useReducedMotion, useTransform } from 'framer-motion';

/** Counts from 0 to `value` each time it scrolls into view (en-US thousands separators). */
export function CountUp({ value, duration = 1.4, pad = 0 }: { value: number; duration?: number; pad?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { amount: 0.6 });
  const reduceMotion = useReducedMotion();
  const count = useMotionValue(value);
  const text = useTransform(count, (v) => {
    const n = Math.round(v).toLocaleString('en-US');
    return pad ? n.padStart(pad, '0') : n;
  });

  useEffect(() => {
    if (reduceMotion) {
      count.set(value);
      return;
    }
    if (!inView) {
      count.set(0);
      return;
    }
    const controls = animate(count, value, { duration, ease: [0.22, 1, 0.36, 1] });
    return () => controls.stop();
  }, [count, duration, inView, reduceMotion, value]);

  return <motion.span ref={ref}>{text}</motion.span>;
}
