import type { CSSProperties } from 'react';
import { motion } from 'framer-motion';
import feature from '../../assets/emergency/feature.webp';

const EASE = [0.22, 1, 0.36, 1] as const;

const CAPTIONS = [
  { title: 'LONI Plus', text: 'Priority emergency ride dispatch', left: '18%' },
  { title: 'Verified drivers', text: 'Trained, assessed and vehicle-inspected', left: '46.1%' },
] as const;

/**
 * The phone-in-hand image, cut into the design's stadium + notch shape (the
 * shape and its white outline live in the image itself, so it is transparent
 * where the pink shows through). On ≥ lg the two captions sit in that empty
 * lower-left area; below lg they stack under the image. On phones the image is
 * cropped to its right-hand side so the phone stays legible.
 */
export function EmergencyFeature({ className = '' }: { className?: string }) {
  return (
    <div className={`relative ${className}`}>
      <motion.div
        initial={{ opacity: 0, x: 80, scale: 0.97 }}
        whileInView={{ opacity: 1, x: 0, scale: 1 }}
        viewport={{ once: false, amount: 0.3 }}
        transition={{ duration: 0.9, ease: EASE }}
        className="overflow-hidden md:overflow-visible"
      >
        <img
          src={feature}
          alt="A hand holding a phone that shows LONI confirming a driver is on the way, with options to call the driver, talk to a nurse or cancel the request"
          width={1347}
          height={402}
          loading="lazy"
          decoding="async"
          draggable={false}
          className="-ml-[65%] block h-auto w-[165%] max-w-none select-none md:ml-0 md:w-full"
        />
      </motion.div>

      <ul className="mt-8 grid gap-8 text-center sm:grid-cols-2 lg:mt-0 lg:block">
        {CAPTIONS.map((c, i) => (
          <motion.li
            key={c.title}
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: false, amount: 0.8 }}
            transition={{ duration: 0.6, delay: 0.35 + i * 0.12, ease: EASE }}
            className="lg:absolute lg:left-[var(--cap-left)] lg:top-[77%] lg:-translate-x-1/2 lg:whitespace-nowrap"
            style={{ '--cap-left': c.left } as CSSProperties}
          >
            <h3 className="text-xl font-semibold text-white">{c.title}</h3>
            <p className="mt-2 text-[15px] text-white/95">{c.text}</p>
          </motion.li>
        ))}
      </ul>
    </div>
  );
}
