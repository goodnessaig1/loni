import type { CSSProperties, ReactNode } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { SITE } from '../../config/site';

const EASE = [0.22, 1, 0.36, 1] as const;

const rise = (i: number) => ({
  initial: { opacity: 0, y: 28 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: false, amount: 0.4 },
  transition: { duration: 0.6, delay: 0.1 + i * 0.08, ease: EASE },
});

/** Dark rounded tile: "Instagram ⌾", "Support ⌾", "Download LONI ⌾". Sized in `em`. */
export function DarkLinkCard({
  href,
  icon,
  children,
  index,
  className = '',
  style,
}: {
  href: string;
  icon: ReactNode;
  children: ReactNode;
  index: number;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <motion.a
      href={href}
      {...rise(index)}
      whileHover={{ y: -3 }}
      className={`group flex items-center justify-between rounded-[1.1em] bg-[#1C1C1E] px-[1.55em] font-semibold text-white transition-colors hover:bg-[#262628] ${className}`}
      style={style}
    >
      <span>{children}</span>
      <span className="inline-flex size-[1.15em] items-center justify-center transition-transform duration-200 group-hover:scale-110 [&>svg]:size-full">
        {icon}
      </span>
    </motion.a>
  );
}

/** White "Explore LONI Plus →" bar. */
export function ExploreCard({ index, className = '', style }: { index: number; className?: string; style?: CSSProperties }) {
  return (
    <motion.a
      href={SITE.exploreLoniPlusHref}
      {...rise(index)}
      whileHover={{ y: -3 }}
      className={`group flex items-center justify-between rounded-[1.1em] bg-white px-[1.55em] font-semibold text-black ${className}`}
      style={style}
    >
      <span>Explore LONI Plus</span>
      <ArrowRight
        className="size-[1.15em] transition-transform duration-200 group-hover:translate-x-1"
        strokeWidth={2.2}
        aria-hidden="true"
      />
    </motion.a>
  );
}
