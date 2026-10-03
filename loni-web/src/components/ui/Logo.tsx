import { Link } from 'react-router';
import logo from '../../assets/logo.webp';

export function Logo({ className = '' }: { className?: string }) {
  return (
    <Link to="/" aria-label="LONI home" className="inline-flex shrink-0">
      <img src={logo} alt="LONI" className={`w-auto select-none ${className}`} draggable={false} />
    </Link>
  );
}
