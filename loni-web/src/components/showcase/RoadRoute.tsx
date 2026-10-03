import { motion } from 'framer-motion';
import { box, px } from './designUnits';
import { fadeVariants, labelVariants, roadVariants } from './motionPresets';
import type { ImageRect, RoadConfig } from './roads';

function RoadImage({ rect }: { rect: ImageRect }) {
  return (
    <img
      src={rect.src}
      alt=""
      aria-hidden="true"
      loading="lazy"
      decoding="async"
      draggable={false}
      style={{
        ...box(rect.x, rect.y, rect.w, rect.h),
        transform: [rect.flip ? 'scaleX(-1)' : '', rect.rotate ? `rotate(${rect.rotate}deg)` : ''].join(' ').trim() || undefined,
      }}
      className="max-w-none select-none"
    />
  );
}

/**
 * One coloured road: the road + its dashed lane + its rotated caption, wiped
 * open from the phone outwards, followed by the static white fade that
 * dissolves the far end into the page.
 */
export function RoadRoute({ road, index }: { road: RoadConfig; index: number }) {
  const { label } = road;
  return (
    <>
      <motion.div className="absolute inset-0" variants={roadVariants(road.side, index)}>
        <RoadImage rect={road.road} />
        <RoadImage rect={road.lane} />
        <motion.span
          variants={labelVariants(index)}
          className="absolute whitespace-nowrap font-medium leading-normal text-[#6b6b6b]"
          style={{
            left: px(label.cx),
            top: px(label.cy),
            fontSize: px(15),
            transform: `translate(-50%, -50%) rotate(${label.rotate}deg)`,
          }}
        >
          {label.text}
        </motion.span>
      </motion.div>
      <motion.div className="absolute inset-0" variants={fadeVariants(index)}>
        <RoadImage rect={road.fade} />
      </motion.div>
    </>
  );
}
