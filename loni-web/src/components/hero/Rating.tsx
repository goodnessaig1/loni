import { motion } from 'framer-motion';
import { Star } from 'lucide-react';

/** "Rated Excellent: 5/5" with five pink stars that pop in one after another. */
export function Rating({ className = '' }: { className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6, delay: 0.7, ease: [0.22, 1, 0.36, 1] }}
      className={`flex flex-col gap-[6px] text-blush-deep ${className}`}
    >
      <p className="font-dm text-[12.28px] leading-[27.83px] font-bold tracking-[-0.16px]">Rated Excellent: 5/5</p>
      <div className="flex gap-[11px]" role="img" aria-label="5 out of 5 stars">
        {Array.from({ length: 5 }, (_, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0, rotate: -30 }}
            whileInView={{ opacity: 1, scale: 1, rotate: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.75 + i * 0.07, type: 'spring', stiffness: 350, damping: 18 }}
          >
            <Star className="size-[22.7px] fill-current" strokeWidth={0} aria-hidden="true" />
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
