import { SITE } from '../../config/site';
import { ArrowPillButton } from '../ui/ArrowPillButton';
import { IntroHeading } from './IntroHeading';

export function IntroSection() {
  return (
    <section aria-labelledby="intro-title" className="px-5 py-20 sm:px-8 sm:py-24 lg:py-28">
      <div className="mx-auto flex max-w-[48rem] flex-col items-center gap-8">
        <div className="flex flex-col items-center gap-7">
          <div id="intro-title">
            <IntroHeading />
          </div>
          <p className="max-w-[24.7rem] text-center text-base font-medium leading-8 tracking-[-0.025em] text-[#6b6b6b]">
            LONI connects the tools, people and support you need throughout your maternity journey.
          </p>
        </div>
        <ArrowPillButton href={SITE.downloadHref}>Download Loni</ArrowPillButton>
      </div>
    </section>
  );
}
