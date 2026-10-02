import heartHands from '../../assets/intro/heart-hands.webp';
import silhouette from '../../assets/intro/silhouette.webp';
import babyHands from '../../assets/intro/baby-hands.webp';

/**
 * Photo chips sit *inside* the heading text flow and are sized in `em`, so
 * they scale with the type and wrap with the words at every screen width.
 */
function ChipPill({ src }: { src: string }) {
  return (
    <span aria-hidden="true" className="mx-[0.12em] inline-block h-[0.845em] w-[1.31em] align-middle">
      <img src={src} alt="" draggable={false} className="size-full rounded-full object-cover" />
    </span>
  );
}

function ChipPair({ first, second }: { first: string; second: string }) {
  return (
    <span aria-hidden="true" className="relative mx-[0.12em] inline-block h-[0.845em] w-[1.49em] align-middle">
      <img src={first} alt="" draggable={false} className="absolute left-0 top-0 size-[0.845em] rounded-full object-cover" />
      <img src={second} alt="" draggable={false} className="absolute left-[0.644em] top-0 size-[0.845em] rounded-full object-cover" />
    </span>
  );
}

export function IntroHeading() {
  return (
    <h2 className="mx-auto max-w-[48rem] bg-[linear-gradient(111deg,#e2027a_30.6%,#c36598_99.3%)] bg-clip-text text-center text-[2rem] font-semibold leading-[1.3] text-transparent text-balance sm:text-[2.5rem] lg:text-[3.1rem]">
      A clear <ChipPill src={heartHands} /> entry to the<br className="hidden sm:inline" /> ever-changing{' '}
      <ChipPair first={silhouette} second={babyHands} /> world of<br className="hidden sm:inline" /> pregnancy support
    </h2>
  );
}
