import { useEffect, useId, useRef, useState } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { NavItem } from './NavItem';
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

      {/* The outer div only positions (framer would overwrite its translate); the inner one animates. */}
      <div className="absolute left-1/2 top-full z-50 w-[22.5rem] -translate-x-1/2">
        <AnimatePresence>
          {open && (
            <MotionConfig reducedMotion="user">
              <motion.div
                id={panelId}
                initial="hide"
                animate="show"
                exit="hide"
                variants={{
                  show: { transition: { staggerChildren: 0.09, delayChildren: 0.04 } },
                  hide: { transition: { staggerChildren: 0.04, staggerDirection: -1 } },
                }}
                className="mt-3 flex flex-col gap-2"
              >
                {FOR_YOU_LINKS.map((item) => (
                  <motion.div
                    key={item.label}
                    style={{ transformOrigin: '50% 0%' }}
                    variants={{
                      hide: { opacity: 0, y: -22, scale: 0.86, filter: 'blur(6px)', transition: { duration: 0.2 } },
                      show: {
                        opacity: 1,
                        y: 0,
                        scale: 1,
                        filter: 'blur(0px)',
                        transition: { type: 'spring', stiffness: 240, damping: 17 },
                      },
                    }}
                  >
                    <NavItem
                      item={item}
                      onClick={() => setOpen(false)}
                      className="group block rounded-[2.5rem] border border-neutral-200 bg-white px-7 py-4 shadow-[0_10px_30px_-12px_rgb(0_0_0/0.25)] transition-[transform,box-shadow] duration-300 hover:-translate-y-0.5 hover:shadow-[0_16px_34px_-12px_rgb(214_45_136/0.45)]"
                      activeClassName="text-black"
                      inactiveClassName="text-black"
                    >
                      <span className="block text-[1.05rem] font-semibold leading-snug transition-colors group-hover:text-brand">
                        {item.label.startsWith('Partners') ? 'For Partners & Family' : `For ${item.label}`}
                      </span>
                      <span className="mt-1 block text-[0.95rem] font-normal leading-snug text-neutral-500">
                        {item.description}
                      </span>
                    </NavItem>
                  </motion.div>
                ))}
              </motion.div>
            </MotionConfig>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
