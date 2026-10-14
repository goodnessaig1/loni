import type { SVGProps } from 'react';

/** Line icons for the "Why LONI exists" list (28 × 28, `currentColor`, 1.6 stroke). */

const base = {
  width: 28,
  height: 28,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
} as const;

/** Scalloped badge with "AI" inside. */
export function AiBadgeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z" />
      <text x="12" y="15.1" textAnchor="middle" fontSize="7.4" fontWeight="500" fill="currentColor" stroke="none" fontFamily="inherit">
        AI
      </text>
    </svg>
  );
}

/** A nurse: head with a small cross on the cap, shoulders below. */
export function NurseIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M8 7.5V5.5A1.5 1.5 0 0 1 9.5 4h5A1.5 1.5 0 0 1 16 5.5v2" />
      <path d="M12 5.2v2.2M10.9 6.3h2.2" />
      <path d="M8 9.5a4 4 0 0 0 8 0" />
      <path d="M4.5 20.5v-1.2a4.3 4.3 0 0 1 3-4.1l1.5-.5M19.5 20.5v-1.2a4.3 4.3 0 0 0-3-4.1l-1.5-.5" />
      <path d="M9 14.7c.8 1 1.8 1.5 3 1.5s2.2-.5 3-1.5" />
    </svg>
  );
}
