import { useEffect, useRef } from 'react';
import { animate, motion, useInView, useMotionValue, useReducedMotion, useTransform } from 'framer-motion';

/** Counts from 0 to `value` each time it scrolls into view (en-US thousands separators). */
export function CountUp({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { amount: 0.6 });
  const reduceMotion = useReducedMotion();
  const count = useMotionValue(value);
  const text = useTransform(count, (v) => Math.round(v).toLocaleString('en-US'));

  useEffect(() => {
    if (reduceMotion) {
      count.set(value);
      return;
    }
    if (!inView) {
      count.set(0);
      return;
    }
    const controls = animate(count, value, { duration: 1.4, ease: [0.22, 1, 0.36, 1] });
    return () => controls.stop();
  }, [count, inView, reduceMotion, value]);

  return <motion.span ref={ref}>{text}</motion.span>;
}
