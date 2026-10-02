import { motion } from 'framer-motion';
import { SITE } from '../../config/site';
import { ArrowPillButton } from '../ui/ArrowPillButton';
import { IntroHeading } from './IntroHeading';

export function IntroSection() {
  return (
    <section aria-labelledby="intro-title" className="px-5 py-20 sm:px-8 sm:py-24 lg:py-28 overflow-hidden">
      <div className="mx-auto flex max-w-[48rem] flex-col items-center gap-8">
        <div className="flex flex-col items-center gap-7">
          <div id="intro-title">
            <IntroHeading />
          </div>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: false }}
            transition={{ duration: 0.6, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="max-w-[24.7rem] text-center text-base font-medium leading-8 tracking-[-0.025em] text-[#6b6b6b]"
          >
            LONI connects the tools, people and support you need throughout your maternity journey.
          </motion.p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: false }}
          transition={{ duration: 0.5, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
        >
          <ArrowPillButton href={SITE.downloadHref}>Download Loni</ArrowPillButton>
        </motion.div>
      </div>
    </section>
  );
}
