import { NavLink } from 'react-router';
import type { NavLinkItem } from './navLinks';

interface Props {
  item: NavLinkItem;
  className?: string;
  activeClassName?: string;
  inactiveClassName?: string;
  onClick?: () => void;
}

/** Renders a router link for in-app routes, a plain anchor for in-page / external ones. */
export function NavItem({
  item,
  className = '',
  activeClassName = 'text-brand',
  inactiveClassName = 'text-neutral-900 hover:text-brand',
  onClick,
}: Props) {
  if (item.to) {
    return (
      <NavLink
        to={item.to}
        end
        onClick={onClick}
        className={({ isActive }) => `${className} ${isActive ? activeClassName : inactiveClassName}`}
      >
        {item.label}
      </NavLink>
    );
  }

  return (
    <a href={item.href} onClick={onClick} className={`${className} ${inactiveClassName}`}>
      {item.label}
    </a>
  );
}
