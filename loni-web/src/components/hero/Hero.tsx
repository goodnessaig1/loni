import { motion } from 'framer-motion';
import { ConnectedCard } from './ConnectedCard';
import { DownloadLink } from './DownloadLink';
import { HeroPortrait } from './HeroPortrait';
import { Rating } from './Rating';
import { SocialPills } from './SocialPills';

/**
 * Hero. On ≥ lg it reaches up under the header (`-mt-14` + `pt-14`, 3.5rem =
 * the header bar height) so the pink shows through the header's tab.
 */
export function Hero() {
  return (
    <section
      aria-labelledby="hero-title"
      className="relative flex flex-col bg-hero-pink min-h-[52rem] md:min-h-[58rem] lg:-mt-14 lg:min-h-[max(44rem,calc(100svh_-_2.5rem))] lg:rounded-b-[28px] lg:pt-14 overflow-hidden"
    >
      <HeroPortrait />

      <div className="relative z-20 flex flex-1 flex-col px-5 pb-8 pt-8 sm:px-8 lg:px-10 lg:pb-24 lg:pt-11">
        <SocialPills />

        <ConnectedCard className="mt-14 self-end lg:absolute lg:right-9 lg:top-16 lg:mt-0" />

        <div className="mt-auto flex flex-col gap-5 pt-10 lg:gap-20">
          <DownloadLink />

          <div className="flex flex-col gap-4 lg:gap-3">
            <h1
              id="hero-title"
              className="text-[3.1rem] font-semibold sm:text-[4.25rem] md:text-[5rem] lg:text-[clamp(4.25rem,7.3vw,6.6rem)] leading-[1.04] tracking-[-0.035em] text-white"
            >
              <motion.span
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.35, ease: [0.22, 1, 0.36, 1] }}
                className="block"
              >
                Your<br className="sm:hidden" /> <em className="font-light italic">Companion</em>
              </motion.span>
              <motion.span
                initial={{ opacity: 0, y: 35 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.45, ease: [0.22, 1, 0.36, 1] }}
                className="block"
              >
                Through Motherhood
              </motion.span>
            </h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.55, ease: [0.22, 1, 0.36, 1] }}
              className="max-w-[20rem] text-[15px] leading-snug text-white sm:max-w-md lg:ml-6 lg:max-w-[32rem] lg:text-[17px]"
            >
              LONI keeps you connected to the information, people, and support that matters most.
            </motion.p>
          </div>
        </div>

        <Rating className="mt-16 lg:absolute lg:bottom-8 lg:right-9 lg:mt-0" />
      </div>
    </section>
  );
}
