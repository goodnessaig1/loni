import { MotionConfig, motion } from 'framer-motion';
import { SITE } from '../../config/site';
import { ArrowPillButton } from '../ui/ArrowPillButton';
import { TagBadge } from '../ui/TagBadge';
import { CommunityCard } from './CommunityCard';

const EASE = [0.22, 1, 0.36, 1] as const;
const HEADING_LINES = ['Pregnancy feels better', 'with people who', 'understand.'];
const PARAGRAPH_LINES = [
  'Share, learn, and connect with other mothers going through their',
  "own journeys. Sometimes it helps to hear from someone who's been",
  'there too.',
];

export function CommunitySection() {
  return (
    <MotionConfig reducedMotion="user">
      <section aria-labelledby="community-title" className="relative overflow-hidden bg-brand text-white lg:-mx-5">
        <div className="mx-auto grid max-w-[104rem] items-start gap-12 px-5 py-16 sm:px-8 sm:py-20 lg:grid-cols-[1.02fr_1fr] lg:gap-0 lg:px-14 lg:py-20">
          <div className="lg:pr-10">
            <TagBadge>The LONI Community</TagBadge>

            {/* The observer sits on the h2 (never translated); lines are only masked/stacked from lg up. */}
            <motion.h2
              id="community-title"
              initial="hide"
              whileInView="show"
              viewport={{ once: false, amount: 0.6 }}
              variants={{ hide: { opacity: 0 }, show: { opacity: 1, transition: { duration: 0.3 } } }}
              className="mt-8 text-[2rem] font-semibold leading-[1.25] tracking-[-0.01em] sm:text-4xl lg:mt-[4.2%] lg:text-[min(3.23vw,3.375rem)] lg:leading-[1.22]"
            >
              {HEADING_LINES.map((line, i) => (
                <span key={line}>
                  <span className="inline lg:block lg:overflow-hidden lg:whitespace-nowrap lg:pb-[0.08em]">
                    <motion.span
                      className="inline lg:block"
                      variants={{
                        hide: { y: '110%', transition: { duration: 0.3 } },
                        show: { y: 0, transition: { duration: 0.7, delay: i * 0.1, ease: EASE } },
                      }}
                    >
                      {line}
                    </motion.span>
                  </span>{' '}
                </span>
              ))}
            </motion.h2>

            <motion.p
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: false, amount: 0.6 }}
              transition={{ duration: 0.7, delay: 0.2, ease: EASE }}
              className="mt-6 max-w-[39rem] text-base leading-[1.95] sm:text-lg lg:mt-[4.2%] lg:text-[min(1.17vw,1.22rem)]"
            >
              {PARAGRAPH_LINES.map((line) => (
                <span key={line}>
                  <span className="lg:block lg:whitespace-nowrap">{line}</span>{' '}
                </span>
              ))}
            </motion.p>

            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 16 }}
              whileInView={{ opacity: 1, scale: 1, y: 0 }}
              viewport={{ once: false, amount: 0.8 }}
              transition={{ type: 'spring', stiffness: 260, damping: 20, delay: 0.3 }}
              className="mt-8 lg:mt-[5.5%]"
            >
              <ArrowPillButton href={SITE.joinCommunityHref} variant="light">
                Join the Community
              </ArrowPillButton>
            </motion.div>
          </div>

          <CommunityCard className="mx-auto max-w-[34rem] lg:max-w-none" />
        </div>
      </section>
    </MotionConfig>
  );
}
