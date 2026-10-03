import type { CSSProperties } from 'react';
import { MotionConfig, motion } from 'framer-motion';
import { ArrowRight, Download } from 'lucide-react';
import { InstagramIcon } from '../icons/InstagramIcon';
import { SupportIcon } from '../icons/SupportIcon';
import { SITE } from '../../config/site';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { px } from '../showcase/designUnits';
import { DarkLinkCard, ExploreCard } from './FooterCards';
import { FooterInfoCard } from './FooterInfoCard';
import { FooterLogo, FooterMobileMenu, FooterNavLinks } from './FooterNav';
import { FooterSlider } from './FooterSlider';

/** Figma canvas of the desktop footer. */
const W = 1652;
const H = 874;

const box = (x: number, y: number, w: number, h: number, extra?: CSSProperties): CSSProperties => ({
  position: 'absolute',
  left: px(x),
  top: px(y),
  width: px(w),
  height: px(h),
  ...extra,
});

const INSTAGRAM = { href: SITE.instagramUrl, icon: <InstagramIcon />, label: 'Instagram' };
const SUPPORT = { href: SITE.supportHref, icon: <SupportIcon />, label: 'Support' };
const DOWNLOAD = { href: SITE.downloadHref, icon: <Download strokeWidth={2} aria-hidden="true" />, label: 'Download LONI' };

function AddSupportPartner({ className = '', style }: { className?: string; style?: CSSProperties }) {
  return (
    <motion.a
      href={SITE.partnerSupportHref}
      initial={{ opacity: 0, x: 20 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: false, amount: 0.8 }}
      transition={{ duration: 0.6, delay: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className={`group inline-flex items-center gap-[0.6em] font-medium text-white ${className}`}
      style={style}
    >
      Add Support Partner
      <ArrowRight className="size-[1.25em] transition-transform duration-200 group-hover:translate-x-1" strokeWidth={2.2} aria-hidden="true" />
    </motion.a>
  );
}

/** ≥ lg: the absolute-positioned Figma stage; the nav and "Add Support Partner" sit in the photo's cut-outs. */
function DesktopLayout() {
  return (
    <div
      className="@container relative mx-auto w-full max-w-[1652px] [--u:calc(100cqw/1652)]"
      style={{ aspectRatio: `${W} / ${H}` }}
    >
      <div style={box(51, 24, 763, 797, { fontSize: px(14) })}>
        <FooterSlider className="w-full" />
      </div>

      <FooterLogo className="absolute left-[calc(var(--u)*51)] top-[calc(var(--u)*28)] h-[calc(var(--u)*37)]" />
      <FooterNavLinks
        className="absolute flex items-center"
        style={{ left: px(236), top: px(28), height: px(38), fontSize: px(16.5) }}
      />
      <AddSupportPartner style={{ position: 'absolute', right: px(1652 - 808), top: px(782), fontSize: px(16) }} />

      <DarkLinkCard index={0} href={INSTAGRAM.href} icon={INSTAGRAM.icon} style={box(855, 61, 362, 79, { fontSize: px(19) })}>
        {INSTAGRAM.label}
      </DarkLinkCard>
      <DarkLinkCard index={1} href={SUPPORT.href} icon={SUPPORT.icon} style={box(1232, 61, 363, 79, { fontSize: px(19) })}>
        {SUPPORT.label}
      </DarkLinkCard>
      <DarkLinkCard index={2} href={DOWNLOAD.href} icon={DOWNLOAD.icon} style={box(855, 155, 362, 80, { fontSize: px(19) })}>
        {DOWNLOAD.label}
      </DarkLinkCard>
      <ExploreCard index={3} style={box(855, 250, 740, 79, { fontSize: px(19) })} />
      <FooterInfoCard style={box(855, 344, 740, 480, { fontSize: px(16.3) })} />
    </div>
  );
}

/** < lg: logo + Menu, photo carousel, link tiles, then the info card. */
function StackedLayout() {
  return (
    <div className="mx-auto max-w-[34rem] px-4 pb-6 pt-4 sm:px-6">
      <div className="flex items-center justify-between px-1">
        <FooterLogo className="h-9" />
        <FooterMobileMenu />
      </div>

      <FooterSlider className="mt-3 w-full text-[11.2px]" />

      <div className="mt-6 grid grid-cols-2 gap-3 text-[14px]">
        <DarkLinkCard index={0} href={INSTAGRAM.href} icon={INSTAGRAM.icon} className="h-[4.8em]">
          {INSTAGRAM.label}
        </DarkLinkCard>
        <DarkLinkCard index={1} href={SUPPORT.href} icon={SUPPORT.icon} className="h-[4.8em]">
          {SUPPORT.label}
        </DarkLinkCard>
        <DarkLinkCard index={2} href={DOWNLOAD.href} icon={DOWNLOAD.icon} className="col-span-2 h-[4.8em]">
          {DOWNLOAD.label}
        </DarkLinkCard>
        <ExploreCard index={3} className="col-span-2 h-[4.8em]" />
      </div>

      <FooterInfoCard className="mt-3 text-[14px]" />
    </div>
  );
}

export function SiteFooter() {
  const isDesktop = useMediaQuery('(min-width: 1024px)');

  return (
    <MotionConfig reducedMotion="user">
      <footer className="relative overflow-hidden bg-black text-white lg:-mx-5 lg:-mb-5">
        {isDesktop ? <DesktopLayout /> : <StackedLayout />}
      </footer>
    </MotionConfig>
  );
}
