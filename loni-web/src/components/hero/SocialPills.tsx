import type { ReactNode } from 'react';
import { InstagramIcon } from '../icons/InstagramIcon';
import { SupportIcon } from '../icons/SupportIcon';
import { SITE } from '../../config/site';

function Pill({ href, icon, children, external }: { href: string; icon: ReactNode; children: ReactNode; external?: boolean }) {
  return (
    <a
      href={href}
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      className="inline-flex h-9 items-center gap-2 rounded-full bg-black px-4 text-sm font-semibold text-white transition-colors hover:bg-neutral-800 lg:h-11 lg:px-5 lg:text-[15px]"
    >
      {icon}
      {children}
    </a>
  );
}

/** The two black pills at the top-left of the hero. They overlap slightly, like in the design. */
export function SocialPills() {
  return (
    <div className="flex items-center -space-x-1">
      <Pill href={SITE.instagramUrl} external icon={<InstagramIcon className="size-[18px] lg:size-5" />}>
        Instagram
      </Pill>
      <Pill href={SITE.supportHref} icon={<SupportIcon className="size-[18px] lg:size-5" />}>
        Support
      </Pill>
    </div>
  );
}
