import type { CSSProperties } from 'react';
import { motion } from 'framer-motion';
import feature from '../../assets/emergency/feature.webp';
import featureMobile from '../../assets/emergency/feature-mobile.webp';

const EASE = [0.22, 1, 0.36, 1] as const;

const ALT =
  'A hand holding a phone that shows LONI confirming a driver is on the way, with options to call the driver, talk to a nurse or cancel the request';

const CAPTIONS = [
  { title: 'LONI Plus', text: 'Priority emergency ride dispatch', left: '18%' },
  { title: 'Verified drivers', text: 'Trained, assessed and vehicle-inspected', left: '46.1%' },
] as const;

/**
 * The phone-in-hand image, cut into the design's stadium + notch shape (the
 * shape and its white outline live in the image itself, so it is transparent
 * where the pink shows through). On ≥ lg the two captions sit in that empty
 * lower-left area; below lg they stack under the image. Phones get the design's own taller crop,
 * whose notch holds the first caption.
 */
export function EmergencyFeature({ className = '' }: { className?: string }) {
  return (
    <div className={`relative ${className}`}>
      <motion.div
        initial={{ opacity: 0, x: 80, scale: 0.97 }}
        whileInView={{ opacity: 1, x: 0, scale: 1 }}
        viewport={{ once: false, amount: 0.3 }}
        transition={{ duration: 0.9, ease: EASE }}
      >
        {/* Phones use the design's own taller crop (391 × 240); md+ the wide one. */}
        <img
          src={featureMobile}
          alt={ALT}
          width={391}
          height={240}
          decoding="async"
          draggable={false}
          className="block h-auto w-full select-none md:hidden"
        />
        <img
          src={feature}
          alt={ALT}
          width={1347}
          height={402}
          loading="lazy"
          decoding="async"
          draggable={false}
          className="hidden h-auto w-full select-none md:block"
        />
      </motion.div>

      {/* Phones: the first caption is pulled up into the image's notch, left-aligned like the design. */}
      <ul className="-mt-[10%] grid gap-6 text-left md:mt-8 md:grid-cols-2 md:gap-8 md:text-center lg:mt-0 lg:block">
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
            <h3 className="text-[1.1rem] font-semibold text-white md:text-xl">{c.title}</h3>
            <p className="mt-2 max-w-[10.5rem] text-[0.8rem] leading-relaxed text-white/90 md:max-w-none md:text-[15px] md:text-white/95">
              {c.text}
            </p>
          </motion.li>
        ))}
      </ul>
    </div>
  );
}
