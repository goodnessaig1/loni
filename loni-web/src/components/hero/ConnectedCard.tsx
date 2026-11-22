'use client';

import { motion } from 'framer-motion';
import avatars from '../../assets/avatars.webp';
import couple from '../../assets/couple.webp';

export function ConnectedCard({ className = '' }: { className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 40, scale: 0.92 }}
      whileInView={{ opacity: 1, x: 0, scale: 1 }}
      viewport={{ once: false }}
      transition={{
        duration: 0.8,
        delay: 0.5,
        ease: [0.16, 1, 0.3, 1],
      }}
      whileHover={{ y: -4, scale: 1.02 }}
      className={`flex h-[115px] w-[282px] gap-[23px] rounded-[12px] bg-white py-[7px] pr-[7px] pl-[15px] text-black ${className}`}
    >
      <div className="flex flex-1 flex-col justify-between py-[7px]">
        <p className="font-dm text-[14px] leading-[21px] font-medium">Connected through every step</p>
        <img src={avatars.src} alt="" className="h-[30px] w-auto self-start" draggable={false} />
      </div>
      <img
        src={couple.src}
        alt="A couple expecting, with family"
        className="size-[101px] shrink-0 rounded-[10px] object-cover"
        draggable={false}
      />
    </motion.div>
  );
}
