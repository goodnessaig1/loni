import type { ReactNode } from 'react';
import { ArrowRight } from 'lucide-react';

interface Props {
  href: string;
  children: ReactNode;
  className?: string;
}

/** Solid black pill with a detached circular arrow button (used for primary CTAs). */
export function ArrowPillButton({ href, children, className = '' }: Props) {
  return (
    <a href={href} className={`group inline-flex items-center ${className}`}>
      <span className="-mr-0.5 inline-flex items-center rounded-full bg-black px-[22px] py-3 text-sm font-bold capitalize text-white transition-colors group-hover:bg-neutral-800">
        {children}
      </span>
      <span className="inline-flex size-11 items-center justify-center rounded-full bg-black text-white transition-colors group-hover:bg-neutral-800">
        <ArrowRight
          className="size-5 transition-transform duration-200 group-hover:translate-x-0.5"
          strokeWidth={2.5}
          aria-hidden="true"
        />
      </span>
    </a>
  );
}
