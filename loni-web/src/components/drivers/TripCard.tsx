import { motion } from 'framer-motion';
import { ChevronRight, Clock, MapPin } from 'lucide-react';

/**
 * The frosted "Bodija → University College Hospital" trip preview in the driver hero. Everything is
 * sized in `em`, so the parent sets the font-size and the card scales with the hero.
 */
export function TripCard({ className = '' }: { className?: string }) {
  return (
    <motion.article
      aria-label="Sample trip"
      initial={{ opacity: 0, y: 40, scale: 0.96 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: false, amount: 0.4 }}
      transition={{ duration: 0.8, delay: 0.7, ease: [0.22, 1, 0.36, 1] }}
      className={`rounded-[1.2em] bg-white/[0.16] pb-[1.1em] pl-[1.3em] pr-[1.3em] pt-[0.85em] lg:pr-[1.8em] text-white backdrop-blur-xl ${className}`}
    >
      <h2 className="text-[1em] font-medium leading-[1.4]">Bodija → University College Hospital</h2>

      <div className="mt-[0.45em] flex items-center gap-[0.9em] text-[0.85em] leading-[1.6] text-white/75">
        <span className="inline-flex items-center gap-[0.5em]">
          <MapPin className="size-[1.15em]" strokeWidth={1.75} aria-hidden="true" />
          3.2 km
        </span>
        <span className="inline-flex items-center gap-[0.5em]">
          <Clock className="size-[1.15em]" strokeWidth={1.75} aria-hidden="true" />
          18 mins
        </span>
      </div>

      <div className="mt-[0.4em] flex items-center justify-between">
        <span className="text-[1.05em] font-bold leading-[1.5]">₦8,500</span>
        <a href="#view-trip" className="group inline-flex items-center gap-[0.3em] text-[0.95em] font-medium">
          View
          <ChevronRight
            className="size-[1em] transition-transform duration-200 group-hover:translate-x-1"
            strokeWidth={2.4}
            aria-hidden="true"
          />
        </a>
      </div>
    </motion.article>
  );
}
