import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Link } from 'react-router';
import { NAV_LINKS, type NavLinkItem } from '../layout/navLinks';
import footerLogo from '../../assets/footer/logo.webp';

// The footer shows a shorter list than the header (no "The journey").
const FOOTER_NAV = NAV_LINKS.filter((l) => ['Home', 'About Us', 'Pricing'].includes(l.label));

export function FooterLogo({ className = '' }: { className?: string }) {
  return (
    <Link to="/" aria-label="LONI home" className={`inline-flex ${className}`}>
      <img src={footerLogo} alt="LONI" width={55} height={33} draggable={false} className="h-full w-auto select-none" />
    </Link>
  );
}

function NavAnchor({ item, className = '' }: { item: NavLinkItem; className?: string }) {
  return item.to ? (
    <Link to={item.to} className={className}>
      {item.label}
    </Link>
  ) : (
    <a href={item.href} className={className}>
      {item.label}
    </a>
  );
}

/** Desktop: inline links that sit in the photo's top-left cut-out. */
export function FooterNavLinks({ className = '', style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <nav aria-label="Footer" className={className} style={style}>
      <ul className="flex items-center" style={{ gap: 'calc(var(--u) * 65)' }}>
        {FOOTER_NAV.map((item) => (
          <li key={item.label}>
            <NavAnchor item={item} className="font-medium text-white transition-opacity hover:opacity-70" />
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Phone: "Menu" toggles a cluster of white pills, as in the Figma "Mobile Nav Sub Menu". */
export function FooterMobileMenu() {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="footer-mobile-nav"
        className="rounded-full px-4 py-2 text-[15px] font-semibold text-white"
      >
        Menu
      </button>

      <AnimatePresence>
        {open && (
          <motion.ul
            id="footer-mobile-nav"
            initial="hide"
            animate="show"
            exit="hide"
            variants={{ show: { transition: { staggerChildren: 0.06 } }, hide: { transition: { staggerChildren: 0.03 } } }}
            className="absolute right-0 top-full z-30 mt-2 flex w-[14rem] flex-wrap justify-end gap-2"
          >
            {FOOTER_NAV.map((item) => (
              <motion.li
                key={item.label}
                variants={{
                  hide: { opacity: 0, scale: 0.8, y: -8 },
                  show: { opacity: 1, scale: 1, y: 0, transition: { type: 'spring', stiffness: 360, damping: 22 } },
                }}
              >
                <NavAnchor
                  item={item}
                  className="inline-flex rounded-full bg-white px-5 py-2.5 text-[15px] font-semibold text-black shadow-[0_6px_18px_-6px_rgb(0_0_0/0.4)]"
                />
              </motion.li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
