'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { NavLinkItem } from './navLinks';

interface Props {
  item: NavLinkItem;
  className?: string;
  activeClassName?: string;
  inactiveClassName?: string;
  onClick?: () => void;
  /** Custom content; defaults to the item's label. */
  children?: ReactNode;
}

/** Renders a Next.js link for in-app routes, a plain anchor for in-page / external ones. */
export function NavItem({
  item,
  className = '',
  activeClassName = 'text-brand',
  inactiveClassName = 'text-neutral-900 hover:text-brand',
  onClick,
  children,
}: Props) {
  const pathname = usePathname();

  if (item.to) {
    // Exact match, like react-router's <NavLink end>.
    const isActive = pathname === item.to;
    return (
      <Link
        href={item.to}
        onClick={onClick}
        aria-current={isActive ? 'page' : undefined}
        className={`${className} ${isActive ? activeClassName : inactiveClassName}`}
      >
        {children ?? item.label}
      </Link>
    );
  }

  return (
    <a href={item.href} onClick={onClick} className={`${className} ${inactiveClassName}`}>
      {children ?? item.label}
    </a>
  );
}
