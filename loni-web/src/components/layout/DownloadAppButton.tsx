import { ArrowDownRight } from 'lucide-react';
import { SITE } from '../../config/site';

/** Outlined "Download App" pill with the detached circular arrow button. */
export function DownloadAppButton({ className = '' }: { className?: string }) {
  return (
    <a
      href={SITE.downloadHref}
      className={`group inline-flex items-center gap-0.5 text-[15px] font-medium text-neutral-900 ${className}`}
    >
      <span className="inline-flex h-11 items-center rounded-full border border-neutral-900 px-6 transition-colors group-hover:bg-neutral-900 group-hover:text-white">
        Download App
      </span>
      <span className="inline-flex size-11 items-center justify-center rounded-full border border-neutral-900 transition-colors group-hover:bg-neutral-900 group-hover:text-white">
        <ArrowDownRight className="size-5" strokeWidth={2.25} aria-hidden="true" />
      </span>
    </a>
  );
}
