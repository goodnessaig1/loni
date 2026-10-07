import type { CSSProperties } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router';
import { SITE } from '../../config/site';

const EASE = [0.22, 1, 0.36, 1] as const;

const DESCRIPTION_LINES = [
  'LONI combines AI guidance, human nurse support, trusted',
  'people, and transportation in one experience, from pregnancy',
  'through postpartum.',
];

const LINK_CLASS = 'inline-block leading-[1.5] text-neutral-400 transition-colors hover:text-black';

interface FooterLink {
  label: string;
  /** In-app route (router link). */
  to?: string;
  /** In-page anchor / external URL. */
  href?: string;
}

const GROUPS: { title: string; links: FooterLink[] }[] = [
  {
    title: 'Join LONI',
    links: [
      { label: 'For Partners & Family', href: SITE.partnerSupportHref },
      { label: 'For Nurses', href: SITE.joinNurseHref },
      { label: 'For Drivers', to: '/drivers' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Privacy Policy', href: SITE.privacyHref },
      { label: 'Terms of Service', href: SITE.termsHref },
      { label: 'Medical Disclaimer', href: SITE.disclaimerHref },
    ],
  },
];

/** The big white card: tagline, blurb, link columns and copyright. Sized in `em` (set font-size on it). */
export function FooterInfoCard({ className = '', style }: { className?: string; style?: CSSProperties }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: false, amount: 0.2 }}
      transition={{ duration: 0.8, delay: 0.3, ease: EASE }}
      className={`flex flex-col rounded-[1.7em] bg-white px-[1.4em] pb-[1.4em] pt-[1.6em] text-black lg:px-[3.07em] lg:pb-[1.69em] lg:pt-[2.9em] ${className}`}
      style={style}
    >
      <h2 className="text-[1.6em] font-bold leading-[1.25] tracking-[-0.02em] lg:text-[1.75em] lg:leading-[1.3]">
        Pregnancy support that stays with you.
      </h2>
      <p className="mt-[0.9em] text-[1em] leading-[1.6] text-neutral-400 lg:mt-[1.32em] lg:leading-[1.41]">
        {DESCRIPTION_LINES.map((line) => (
          <span key={line}>
            <span className="lg:block lg:whitespace-nowrap">{line}</span>{' '}
          </span>
        ))}
      </p>

      <div className="mt-[2.2em] grid gap-[2em] lg:mt-[3.07em] lg:grid-cols-[18.4em_1fr] lg:gap-0">
        {GROUPS.map((group) => (
          <nav key={group.title} aria-label={group.title}>
            <h3 className="text-[1.05em] font-medium lg:text-[1.01em]">{group.title}</h3>
            <ul className="mt-[1.3em] flex flex-col gap-[0.5em] lg:mt-[2.24em] lg:gap-[0.74em]">
              {group.links.map((link) => (
                <li key={link.label}>
                  {link.to ? (
                    <Link to={link.to} className={LINK_CLASS}>
                      {link.label}
                    </Link>
                  ) : (
                    <a href={link.href} className={LINK_CLASS}>
                      {link.label}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>

      <p className="mt-[2.4em] text-[0.92em] lg:mt-auto">© {new Date().getFullYear()} LONI. All rights reserved.</p>
    </motion.div>
  );
}
