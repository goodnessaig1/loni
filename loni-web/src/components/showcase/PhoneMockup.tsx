import { motion, type MotionValue } from 'framer-motion';
import phone from '../../assets/showcase/phone1.webp';
import { MotherBadge } from './MotherBadge';
import { box } from './designUnits';
import { phoneVariants } from './motionPresets';

/**
 * The app mockup. The outer layer carries the scroll parallax, the inner one
 * the in/out-of-view entrance, so the two transforms never fight.
 */
export function PhoneMockup({ parallaxY }: { parallaxY?: MotionValue<number> }) {
  return (
    <motion.div className="absolute" style={{ ...box(537.15, 111, 391.373, 796), y: parallaxY }}>
      <motion.div className="relative size-full" variants={phoneVariants}>
        <img
          src={phone}
          alt="The LONI app home screen showing a mother's pregnancy week, today's tip and quick actions"
          width={785}
          height={1600}
          loading="lazy"
          decoding="async"
          draggable={false}
          className="max-w-none select-none"
          style={box(3.0, 39.67, 386.144, 786.33)}
        />
        <MotherBadge style={{ left: `calc(var(--u) * 296)`, top: `calc(var(--u) * 27)` }} />
      </motion.div>
    </motion.div>
  );
}
