import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { InstagramIcon } from '../icons/InstagramIcon';
import { SupportIcon } from '../icons/SupportIcon';
import { SITE } from '../../config/site';

function Pill({ href, icon, children, external, delay = 0 }: { href: string; icon: ReactNode; children: ReactNode; external?: boolean; delay?: number }) {
  return (
    <motion.a
      href={href}
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      initial={{ opacity: 0, x: -20, scale: 0.95 }}
      whileInView={{ opacity: 1, x: 0, scale: 1 }}
      viewport={{ once: false }}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ scale: 1.05, y: -2 }}
      whileTap={{ scale: 0.95 }}
      className="inline-flex h-9 items-center gap-2 rounded-full bg-black px-4 text-sm font-semibold text-white transition-colors hover:bg-neutral-800 lg:h-11 lg:px-5 lg:text-[15px]"
    >
      {icon}
      {children}
    </motion.a>
  );
}

/** The two black pills at the top-left of the hero. They overlap slightly, like in the design. */
export function SocialPills() {
  return (
    <div className="flex items-center -space-x-1">
      <Pill href={SITE.instagramUrl} external icon={<InstagramIcon className="size-[18px] lg:size-5" />} delay={0.3}>
        Instagram
      </Pill>
      <Pill href={SITE.supportHref} icon={<SupportIcon className="size-[18px] lg:size-5" />} delay={0.4}>
        Support
      </Pill>
    </div>
  );
}
