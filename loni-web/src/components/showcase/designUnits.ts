import type { CSSProperties } from 'react';

/** Design-space size of the roads + phone composition in the Figma file. */
export const CANVAS_W = 1466.306;
export const CANVAS_H = 907;

/**
 * 1 Figma pixel, scaled to the rendered stage. `--u` is defined on the stage
 * (see RoadsShowcase) as `calc(100cqw / CANVAS_W)`, so everything placed with
 * `px()` keeps the exact proportions of the design at any width.
 */
export const px = (n: number) => `calc(var(--u) * ${n})`;

export function box(x: number, y: number, w: number, h?: number): CSSProperties {
  return {
    position: 'absolute',
    left: px(x),
    top: px(y),
    width: px(w),
    ...(h !== undefined ? { height: px(h) } : {}),
  };
}
