import { useEffect, useId, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { FOR_YOU_LINKS } from './navLinks';

/** "For You" desktop dropdown. Click/tap or keyboard to open, Esc / outside click to close. */
export function ForYouMenu({ className = '' }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 text-[15px] font-medium text-neutral-900 transition-colors hover:text-brand"
      >
        For You
        <ChevronDown
          className={`size-4 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          strokeWidth={2.5}
          aria-hidden="true"
        />
      </button>

      <div
        id={panelId}
        hidden={!open}
        className="absolute left-1/2 top-full z-50 mt-4 w-44 -translate-x-1/2 rounded-2xl bg-white p-2 shadow-xl ring-1 ring-black/5"
      >
        {FOR_YOU_LINKS.map((item) => (
          <a
            key={item.label}
            href={item.href}
            onClick={() => setOpen(false)}
            className="block rounded-xl px-3 py-2 text-[15px] font-medium text-neutral-800 transition-colors hover:bg-pink-50 hover:text-brand"
          >
            {item.label}
          </a>
        ))}
      </div>
    </div>
  );
}
