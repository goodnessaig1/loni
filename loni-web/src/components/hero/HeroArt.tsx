'use client';

import type { CSSProperties } from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import mother from '../../assets/hero-mother.webp';

const MotionImage = motion.create(Image);

/**
 * The hero artwork, rebuilt from the Figma layers ("Frame 2147226884", 931 × 1065).
 *
 * Every size and position below is the design's own number, expressed in `cqw` of this
 * box (it is a size container), so the whole piece scales as one at any width:
 *   1 design px = 100 / 931 cqw.
 *
 * Shapes ("Frame 2055248609", 814.18 × 796.02 at 0, 135) are four rounded rectangles.
 * Figma gives each one's size, its rotated bounding box (Top/Left) and its rotation.
 */
const W = 931;
const u = (px: number) => `${(px / W) * 100}cqw`;

const PINK = '#FFAACB';
const GRADIENT = 'linear-gradient(180deg, #FDA6C8 0%, #FA88B3 100%)';

type Shape = { w: number; h: number; top: number; left: number; r: number; rot: number; fill: string; opacity?: number };

// Back to front, as in the layers panel.
const SHAPES: Shape[] = [
  { w: 349.25, h: 652.38, top: 1.46, left: 43.46, r: 178, rot: 23.86, fill: PINK }, // Rectangle 4324
  { w: 326.84, h: 750.74, top: -104.55, left: 287.97, r: 156.58, rot: -5.36, fill: PINK, opacity: 0.72 }, // Rectangle 4325
  { w: 287.61, h: 435.35, top: 390.34, left: 84.59, r: 189, rot: 72.64, fill: GRADIENT }, // Rectangle 4323
  { w: 312.5, h: 694.55, top: 63.58, left: 297.78, r: 189, rot: -36.76, fill: GRADIENT }, // Rectangle 4322
];
const SHAPES_TOP = 135;
// Figma measures rotation anticlockwise; CSS rotates clockwise.
const ROTATION_SIGN: 1 | -1 = -1;

function shapeStyle(s: Shape, sign: 1 | -1 = ROTATION_SIGN): CSSProperties {
  // Top/Left are the rotated shape's bounding box, so centre the rectangle in that box
  // and rotate it about its centre.
  const rad = (s.rot * Math.PI) / 180;
  const bw = s.w * Math.abs(Math.cos(rad)) + s.h * Math.abs(Math.sin(rad));
  const bh = s.w * Math.abs(Math.sin(rad)) + s.h * Math.abs(Math.cos(rad));
  const cx = s.left + bw / 2;
  const cy = SHAPES_TOP + s.top + bh / 2;
  return {
    position: 'absolute',
    width: u(s.w),
    height: u(s.h),
    left: u(cx - s.w / 2),
    top: u(cy - s.h / 2),
    borderRadius: u(s.r),
    background: s.fill,
    opacity: s.opacity,
    transform: `rotate(${sign * s.rot}deg)`,
  };
}

export function HeroArt({ className = '' }: { className?: string }) {
  return (
    <div aria-hidden="true" className={`pointer-events-none @container aspect-[931/1065] ${className}`}>
      <motion.div
        className="absolute inset-0"
        initial={{ opacity: 0, scale: 0.94 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 1, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
        style={{ transformOrigin: '45% 60%' }}
      >
        {SHAPES.map((s, i) => (
          <span key={i} style={shapeStyle(s)} />
        ))}
      </motion.div>

      {/* "IMG_6387 1": 716 × 1065 at (215, 0). */}
      <MotionImage
        src={mother}
        alt=""
        // LCP element: preloaded, and sized to its rendered width (≈ 51vw on desktop, up to 115vw on phones).
        preload
        fetchPriority="high"
        sizes="(min-width: 1024px) 51vw, min(115vw, 765px)"
        draggable={false}
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 1, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className="absolute top-0 max-w-none select-none"
        style={{ left: u(215), width: u(716), height: u(1065) }}
      />
    </div>
  );
}
