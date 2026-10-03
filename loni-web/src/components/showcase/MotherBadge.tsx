import { motion } from 'framer-motion';
import mother from '../../assets/showcase/mother.webp';
import { badgeVariants } from './motionPresets';
import { px } from './designUnits';

/**
 * The "Mother" avatar + pill that sits on the phone's top-right corner.
 * Sized in `em` off a design-scaled font-size so it scales with the stage.
 */
export function MotherBadge({ style }: { style?: React.CSSProperties }) {
  return (
    <motion.div
      variants={badgeVariants}
      className="absolute flex flex-col items-center"
      style={{ fontSize: px(13.762), width: '6.6em', ...style }}
    >
      <div
        className="relative shrink-0 overflow-hidden rounded-full border-white bg-neutral-200"
        style={{
          width: '4.139em',
          height: '4.139em',
          borderWidth: '0.143em',
          borderStyle: 'solid',
          boxShadow: '0 0.36em 0.36em rgba(0,0,0,0.05)',
          marginBottom: '-0.733em',
        }}
      >
        <img
          src={mother}
          alt=""
          draggable={false}
          className="absolute max-w-none"
          style={{ height: '100%', width: '150%', left: '0.97%', top: '0.7%' }}
        />
      </div>
      <div
        className="relative rounded-[1.143em] border-white bg-[#15b300] text-center font-bold capitalize text-white"
        style={{
          width: '5.785em',
          borderWidth: '0.145em',
          borderStyle: 'solid',
          padding: '0.286em 1.143em',
          lineHeight: 1.4286,
          filter: 'drop-shadow(0 0 0.163em rgba(0,0,0,0.25))',
        }}
      >
        Mother
      </div>
    </motion.div>
  );
}
