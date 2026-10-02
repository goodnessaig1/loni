import { motion } from 'framer-motion';
import { Star } from 'lucide-react';

export function Rating({ className = '' }: { className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.7, ease: [0.22, 1, 0.36, 1] }}
      className={`flex flex-col gap-2.5 text-white lg:items-end ${className}`}
    >
      <p className="text-xs font-semibold lg:text-[13px]">Rated Excellent: 5/5</p>
      <div className="flex gap-1.5 lg:gap-2" role="img" aria-label="5 out of 5 stars">
        {Array.from({ length: 5 }, (_, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0, rotate: -30 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            transition={{
              delay: 0.75 + i * 0.07,
              type: 'spring',
              stiffness: 350,
              damping: 18,
            }}
          >
            <Star className="size-[18px] fill-white lg:size-6" strokeWidth={0} aria-hidden="true" />
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
