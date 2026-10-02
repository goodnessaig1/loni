import { useRef } from 'react';
import { MotionConfig, motion } from 'framer-motion';
import { SITE } from '../../config/site';
import { ArrowPillButton } from '../ui/ArrowPillButton';
import { TagBadge } from '../ui/TagBadge';
import { EmergencyFeature } from './EmergencyFeature';
import { WaveDecor } from './WaveDecor';

const EASE = [0.22, 1, 0.36, 1] as const;
const HEADING_LINES = ['When getting there matters,', 'LONI helps you move.'];

export function EmergencySection() {
  const sectionRef = useRef<HTMLElement>(null);

  return (
    <MotionConfig reducedMotion="user">
      <section
        ref={sectionRef}
        aria-labelledby="emergency-title"
        className="relative overflow-hidden bg-brand text-white lg:-mx-5"
      >
        <WaveDecor sectionRef={sectionRef} />

        <div className="relative mx-auto max-w-[90rem] px-5 pb-16 pt-16 sm:px-8 sm:pb-20 lg:px-14 lg:pb-[87px] lg:pt-[92px]">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_35rem] lg:gap-10">
            <div>
              <TagBadge>Emergency transportation</TagBadge>
              {/* The observer sits on the h2 (never translated) - observing the clipped inner lines would never fire. */}
              <motion.h2
                id="emergency-title"
                initial="hide"
                whileInView="show"
                viewport={{ once: false, amount: 0.6 }}
                className="mt-8 text-[2rem] font-bold leading-[1.25] sm:text-4xl lg:text-[2.75rem] lg:leading-[1.3]"
              >
                {HEADING_LINES.map((line, i) => (
                  <span key={line} className="block overflow-hidden">
                    <motion.span
                      className="block"
                      variants={{
                        hide: { y: '110%', transition: { duration: 0.3 } },
                        show: { y: 0, transition: { duration: 0.7, delay: i * 0.1, ease: EASE } },
                      }}
                    >
                      {line}
                    </motion.span>
                  </span>
                ))}
              </motion.h2>
            </div>

            <motion.p
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: false, amount: 0.6 }}
              transition={{ duration: 0.7, delay: 0.2, ease: EASE }}
              className="max-w-[35rem] text-base leading-[1.8] sm:text-lg lg:mt-3.5"
            >
              LONI connects mothers with verified drivers for emergency transportation. A clear flow, trusted people,
              and less to think about when every moment counts.
            </motion.p>
          </div>

          <EmergencyFeature className="mt-14 lg:mt-24" />

          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 16 }}
            whileInView={{ opacity: 1, scale: 1, y: 0 }}
            viewport={{ once: false, amount: 0.3 }}
            transition={{ type: 'spring', stiffness: 260, damping: 20 }}
            className="mt-10 flex lg:mt-[55px] lg:justify-end"
          >
            <ArrowPillButton href={SITE.joinDriverHref} variant="light">
              Join LONI as a Driver
            </ArrowPillButton>
          </motion.div>
        </div>
      </section>
    </MotionConfig>
  );
}
