import type { ReactNode } from 'react';
import { MotionConfig, motion } from 'framer-motion';

// Slow, soft easing, like the rest of the site's long-form pages.
const EASE = [0.22, 1, 0.36, 1] as const;

export interface LegalSectionContent {
  title: string;
  /** One entry per paragraph; may contain links. */
  paragraphs: ReactNode[];
}

interface Props {
  /** Shown huge, e.g. "Privacy Policy". */
  title: string;
  /** Set the title in capitals (the privacy design) instead of title case (terms, disclaimer). Default true. */
  uppercase?: boolean;
  lastUpdated: string;
  effectiveDate: string;
  intro: string;
  sections: LegalSectionContent[];
}

/** One "// Heading" + paragraphs row. Fades up as it scrolls in; its divider draws itself left to right. */
function LegalSection({ section, last }: { section: LegalSectionContent; last: boolean }) {
  return (
    <motion.section
      initial="hide"
      whileInView="show"
      viewport={{ once: false, amount: 0.3 }}
      variants={{
        hide: { opacity: 0, y: 36, transition: { duration: 0.4 } },
        show: { opacity: 1, y: 0, transition: { duration: 1.3, ease: EASE } },
      }}
      className="relative grid gap-5 py-12 lg:grid-cols-[46.2%_1fr] lg:gap-0 lg:py-20"
    >
      <h2 className="text-[1.1rem] font-normal leading-snug tracking-[-0.02em] text-brand lg:text-[1.125rem]">
        <span className="mr-[0.7em] font-semibold italic tracking-[-0.12em]">//</span>
        {section.title}
      </h2>

      <div className="max-w-[42.5rem] space-y-[1.55em] text-[1rem] leading-[1.55] text-neutral-950 lg:text-[1.1rem]">
        {section.paragraphs.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>

      {!last && (
        <motion.span
          aria-hidden="true"
          variants={{
            hide: { scaleX: 0, transition: { duration: 0.4 } },
            show: { scaleX: 1, transition: { duration: 1.6, delay: 0.3, ease: EASE } },
          }}
          className="absolute bottom-0 left-0 h-px w-full origin-left bg-neutral-200 lg:w-[92.7%]"
        />
      )}
    </motion.section>
  );
}

/**
 * Long-form legal page body: a giant uppercase title that slides up from behind a mask, the document
 * dates and a short intro, then a list of "// Heading" sections. Shared by the policy pages.
 */
export function LegalDocument({ title, uppercase = true, lastUpdated, effectiveDate, intro, sections }: Props) {
  return (
    <MotionConfig reducedMotion="user">
      <article className="mx-auto max-w-[96rem] px-5 pb-20 pt-24 sm:px-8 lg:px-[3.1%] lg:pb-28 lg:pt-[15rem]">
        {/* The observer sits on the h1 (never translated); the title slides up from behind a mask. */}
        <motion.h1
          initial="hide"
          whileInView="show"
          viewport={{ once: false, amount: 0.5 }}
          className={`font-medium leading-[0.9] text-black ${
            uppercase ? 'uppercase tracking-[-0.065em]' : 'tracking-[-0.055em]'
          }`}
          style={{ fontSize: uppercase ? 'clamp(2.6rem, 9.9vw, 10.8rem)' : 'clamp(2.5rem, 9vw, 9.8rem)' }}
        >
          <span className="block overflow-hidden pb-[0.06em] pt-[0.06em]">
            <motion.span
              className="block"
              variants={{
                hide: { y: '105%', transition: { duration: 0.4 } },
                show: { y: 0, transition: { duration: 1.4, ease: EASE } },
              }}
            >
              {title}
            </motion.span>
          </span>
        </motion.h1>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: false, amount: 0.5 }}
          transition={{ duration: 1.2, delay: 0.3, ease: EASE }}
          className="mt-14 grid gap-8 lg:mt-24 lg:grid-cols-[60%_1fr] lg:items-start lg:gap-0"
        >
          <dl className="space-y-3 text-[0.9rem] lg:pl-[0.2%]">
            <div>
              <dt className="inline font-semibold">Last Updated:</dt> <dd className="inline">{lastUpdated}</dd>
            </div>
            <div>
              <dt className="inline font-semibold">Effective Date:</dt> <dd className="inline">{effectiveDate}</dd>
            </div>
          </dl>
          <p className="max-w-[33rem] text-[0.95rem] leading-[1.55] lg:-mt-1.5">{intro}</p>
        </motion.div>

        <div className="mt-16 lg:mt-24">
          {sections.map((section, i) => (
            <LegalSection key={section.title} section={section} last={i === sections.length - 1} />
          ))}
        </div>
      </article>
    </MotionConfig>
  );
}
