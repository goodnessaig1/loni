import { useCallback, useId, useState } from 'react';
import { Menu, X } from 'lucide-react';
import { Logo } from '../ui/Logo';
import { DownloadAppButton } from './DownloadAppButton';
import { ForYouMenu } from './ForYouMenu';
import { MobileMenu } from './MobileMenu';
import { NavItem } from './NavItem';
import { NAV_LINKS } from './navLinks';

/**
 * Site header.
 *
 * ≥ lg: the header is two white "plates" (logo + nav, download CTA) with a
 * transparent gap between them. The hero is pulled up underneath (see
 * <Hero />, `lg:-mt-14`), so its pink field shows through that gap as a tab.
 * The tab stretches with whatever width the plates leave, and the rounded
 * and concave corners are painted as white corner pieces on the plates
 * (`before`/`after`), so it adapts at every width without any magic numbers.
 *
 * < lg: a plain white bar with the logo and a hamburger menu.
 */
export function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuId = useId();
  const closeMenu = useCallback(() => setMenuOpen(false), []);

  return (
    <header className="relative z-30">
      {/* ── Desktop ─────────────────────────────────────────────── */}
      <div className="hidden h-14 lg:flex">
        <div className="relative flex shrink-0 items-center rounded-br-[20px] bg-white pr-8 before:absolute before:left-0 before:top-full before:size-7 before:bg-[radial-gradient(circle_at_100%_100%,transparent_27.5px,#fff_28px)] after:absolute after:left-full after:top-0 after:size-[26px] after:bg-[radial-gradient(circle_at_100%_100%,transparent_25.5px,#fff_26px)]">
          <Logo className="ml-10 h-10" />
          <nav aria-label="Primary" className="ml-10 flex items-center gap-8 xl:ml-28 xl:gap-12">
            {NAV_LINKS.map((item) => (
              <NavItem key={item.label} item={item} className="text-[15px] font-medium transition-colors" />
            ))}
            <ForYouMenu />
          </nav>
        </div>

        {/* The tab: intentionally empty so the hero's pink shows through. */}
        <div aria-hidden="true" className="min-w-6 flex-1" />

        <div className="relative flex shrink-0 items-center rounded-bl-[20px] bg-white pl-8 before:absolute before:right-full before:top-0 before:size-[26px] before:bg-[radial-gradient(circle_at_0%_100%,transparent_25.5px,#fff_26px)] after:absolute after:right-0 after:top-full after:size-7 after:bg-[radial-gradient(circle_at_0%_100%,transparent_27.5px,#fff_28px)]">
          <DownloadAppButton />
        </div>
      </div>

      {/* ── Mobile / tablet ─────────────────────────────────────── */}
      <div className="flex h-[72px] items-center justify-between bg-white px-5 sm:px-8 lg:hidden">
        <Logo className="h-9 sm:h-10" />
        <div className="flex items-center gap-3">
          <div className="hidden sm:block">
            <DownloadAppButton />
          </div>
          <button
            type="button"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            aria-controls={menuId}
            onClick={() => setMenuOpen((v) => !v)}
            className="inline-flex size-11 items-center justify-center rounded-full text-neutral-700 transition-colors hover:bg-neutral-100"
          >
            {menuOpen ? (
              <X className="size-7" strokeWidth={1.75} aria-hidden="true" />
            ) : (
              <Menu className="size-7" strokeWidth={1.75} aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      <div className="lg:hidden">
        <MobileMenu id={menuId} open={menuOpen} onClose={closeMenu} />
      </div>
    </header>
  );
}
