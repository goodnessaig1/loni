import lady from '../../assets/hero-lady.webp';

/**
 * The cut-out portrait. It sits in its own overflow-hidden layer so it is
 * cropped by the hero's right/bottom edges, but – because the hero reaches up
 * under the header – the top of her head can rise into the header's tab.
 *
 * Mobile: scaled up and pushed off the right edge (only the face + belly show).
 * ≥ lg:   anchored bottom-right at full height.
 */
export function HeroPortrait() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-10 overflow-hidden lg:rounded-b-[28px]">
      <img
        src={lady}
        alt=""
        width={633}
        height={923}
        fetchPriority="high"
        draggable={false}
        className="absolute left-[48%] top-[13%] h-[84%] w-auto max-w-none select-none lg:left-auto lg:right-[5%] lg:top-auto lg:bottom-0 lg:h-full"
      />
    </div>
  );
}
