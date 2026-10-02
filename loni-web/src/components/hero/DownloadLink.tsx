import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { SITE } from '../../config/site';

/** The boxed, square-cornered "Download LONI now →" call to action. */
export function DownloadLink({ className = '' }: { className?: string }) {
  return (
    <motion.a
      href={SITE.downloadHref}
      initial={{ opacity: 0, y: 25 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.6, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={`group inline-flex h-11 w-[13.5rem] items-stretch border-2 border-white/50 bg-black/20 text-sm text-white backdrop-blur-[2px] transition-colors hover:bg-black/30 sm:w-[16rem] lg:w-[18.75rem] lg:text-[15px] ${className}`}
    >
      <span className="flex flex-1 items-center px-4 lg:px-5">Download LONI now</span>
      <span className="flex w-11 items-center justify-center border-l-2 border-white/50">
        <ArrowRight
          className="size-4 transition-transform duration-200 group-hover:translate-x-1"
          strokeWidth={2}
          aria-hidden="true"
        />
      </span>
    </motion.a>
  );
}
