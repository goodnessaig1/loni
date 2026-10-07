import { useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { DownloadAppButton } from './DownloadAppButton';
import { NavItem } from './NavItem';
import { FOR_YOU_LINKS, NAV_LINKS } from './navLinks';

interface Props {
  id: string;
  open: boolean;
  onClose: () => void;
}

/** Drop-down panel for < lg screens. Slides under the header bar. */
export function MobileMenu({ id, open, onClose }: Props) {
  const [forYouOpen, setForYouOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  return (
    <div
      id={id}
      aria-hidden={!open}
      inert={!open}
      className={`absolute inset-x-4 top-full z-50 mt-1 origin-top rounded-3xl bg-white p-3 shadow-2xl ring-1 ring-black/5 transition-[opacity,transform,visibility] duration-200 sm:inset-x-6 ${
        open ? 'visible translate-y-0 opacity-100' : 'invisible -translate-y-2 opacity-0'
      }`}
    >
      <nav aria-label="Mobile">
        <ul className="flex flex-col">
          {NAV_LINKS.map((item) => (
            <li key={item.label}>
              <NavItem
                item={item}
                onClick={onClose}
                className="block rounded-2xl px-4 py-3 text-base font-medium transition-colors hover:bg-pink-50"
              />
            </li>
          ))}
          <li>
            <button
              type="button"
              aria-expanded={forYouOpen}
              onClick={() => setForYouOpen((v) => !v)}
              className="flex w-full items-center justify-between rounded-2xl px-4 py-3 text-base font-medium text-neutral-900 transition-colors hover:bg-pink-50 hover:text-brand"
            >
              For You
              <ChevronDown
                className={`size-4 transition-transform duration-200 ${forYouOpen ? 'rotate-180' : ''}`}
                strokeWidth={2.5}
                aria-hidden="true"
              />
            </button>
            <ul hidden={!forYouOpen} className="mb-1 ml-4 flex flex-col border-l border-pink-100 pl-2">
              {FOR_YOU_LINKS.map((item) => (
                <li key={item.label}>
                  <NavItem
                    item={item}
                    onClick={onClose}
                    className="block rounded-xl px-3 py-2 text-[15px] font-medium transition-colors hover:bg-pink-50"
                    inactiveClassName="text-neutral-700 hover:text-brand"
                  />
                </li>
              ))}
            </ul>
          </li>
        </ul>
      </nav>
      <div className="mt-2 border-t border-neutral-100 px-1 pt-3 sm:hidden">
        <DownloadAppButton />
      </div>
    </div>
  );
}
