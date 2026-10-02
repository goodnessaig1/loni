import { motion } from 'framer-motion';
import hubOuter from '../../assets/showcase/roads/hub-outer.svg';
import hubInner from '../../assets/showcase/roads/hub-inner.svg';
import hubBolt from '../../assets/showcase/roads/hub-bolt.svg';
import { box, px } from './designUnits';
import { hubVariants } from './motionPresets';

/** The purple "LONI" hub every road runs into. It sits behind the phone, as in the design. */
export function Hub() {
  return (
    <motion.div aria-hidden="true" variants={hubVariants} style={box(578.59, 304.52, 309.119, 309.119)}>
      <img src={hubOuter} alt="" draggable={false} className="absolute inset-0 size-full max-w-none" />
      <img
        src={hubInner}
        alt=""
        draggable={false}
        className="absolute max-w-none"
        style={box(44.91, 44.91, 219.29, 219.29)}
      />
      <div
        className="absolute flex items-center justify-center border-[#a16ed0] bg-[#8b51ff]"
        style={{
          ...box(98.64, 99.52, 110.085, 110.085),
          borderWidth: px(1.321),
          borderStyle: 'solid',
          borderRadius: px(55.043),
        }}
      >
        <img src={hubBolt} alt="" draggable={false} className="max-w-none" style={{ width: px(56.421), height: px(66.012) }} />
      </div>
    </motion.div>
  );
}
