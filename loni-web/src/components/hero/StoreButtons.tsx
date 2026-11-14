import { motion } from 'framer-motion';
import { SITE } from '../../config/site';

function AppleIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M16.37 12.6c-.02-2.2 1.8-3.26 1.88-3.31-1.03-1.5-2.62-1.7-3.18-1.72-1.35-.14-2.64.8-3.33.8-.69 0-1.74-.78-2.86-.76-1.47.02-2.83.86-3.59 2.18-1.53 2.66-.39 6.6 1.1 8.75.73 1.05 1.6 2.24 2.73 2.2 1.1-.05 1.51-.71 2.84-.71 1.32 0 1.7.71 2.85.69 1.18-.02 1.93-1.07 2.65-2.13.84-1.22 1.18-2.4 1.2-2.46-.03-.01-2.3-.88-2.32-3.5ZM14.2 6.13c.6-.73 1.01-1.75.9-2.76-.87.04-1.92.58-2.54 1.31-.56.65-1.05 1.69-.92 2.68.97.08 1.96-.49 2.56-1.23Z" />
    </svg>
  );
}

function PlayIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M8 5.6v12.8a.9.9 0 0 0 1.36.77l10.4-6.4a.9.9 0 0 0 0-1.54l-10.4-6.4A.9.9 0 0 0 8 5.6Z" />
    </svg>
  );
}

const base =
  'group inline-flex h-12 items-center gap-3 rounded-full pl-5 pr-2 text-left leading-tight transition-transform sm:h-[3.25rem]';

/** "Download on the App Store" (filled pink) and "Get it on Google Play" (white) pills. */
export function StoreButtons({ className = '' }: { className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6, delay: 0.55, ease: [0.22, 1, 0.36, 1] }}
      className={`flex flex-wrap gap-3 ${className}`}
    >
      <a
        href={SITE.appStoreHref}
        aria-label="Download LONI on the App Store"
        className={`${base} bg-blush-deep text-white shadow-lg shadow-blush-deep/20 hover:-translate-y-0.5`}
      >
        <span className="text-[13px] font-semibold sm:text-sm">
          Download on the
          <br />
          App Store
        </span>
        <span className="grid size-8 place-items-center rounded-full bg-white text-blush-deep sm:size-9">
          <AppleIcon className="size-[18px]" />
        </span>
      </a>
      <a
        href={SITE.playStoreHref}
        aria-label="Get LONI on Google Play"
        className={`${base} bg-white text-neutral-900 shadow-lg shadow-black/5 hover:-translate-y-0.5`}
      >
        <span className="text-[13px] font-semibold sm:text-sm">
          Get it on
          <br />
          Google Play
        </span>
        <span className="grid size-8 place-items-center rounded-full bg-blush-deep text-white sm:size-9">
          <PlayIcon className="ml-0.5 size-4" />
        </span>
      </a>
    </motion.div>
  );
}
