import Link from 'next/link';
import logo from '../../assets/logo.webp';

export function Logo({ className = '' }: { className?: string }) {
  return (
    <Link href="/" aria-label="LONI home" className="inline-flex shrink-0">
      <img src={logo.src} alt="LONI" className={`w-auto select-none ${className}`} draggable={false} />
    </Link>
  );
}
