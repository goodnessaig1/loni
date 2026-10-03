export type Point = readonly [number, number];

/** Smooth cubic path through `pts` (Catmull-Rom → Bézier), so a ribbon is described by a few waypoints. */
export function smoothPath(pts: readonly Point[]): string {
  const f = (n: number) => n.toFixed(1);
  let d = `M${f(pts[0][0])},${f(pts[0][1])}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(i - 1, 0)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(i + 2, pts.length - 1)];
    const c1: Point = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2: Point = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${f(c1[0])},${f(c1[1])} ${f(c2[0])},${f(c2[1])} ${f(p2[0])},${f(p2[1])}`;
  }
  return d;
}

/**
 * Centre line of the ribbon in the 1624 × 1122 desktop design space: enters from the left,
 * dips under the nurse card, and comes out on the right rising to the edge.
 */
export const DESKTOP_RIBBON = smoothPath([
  [-400, 503],
  [-188, 583],
  [0, 663],
  [188, 745],
  [428, 818],
  [540, 826],
  [616, 815],
  [850, 655],
  [1074, 493],
  [1173, 440],
  [1278, 385],
  [1383, 352],
  [1500, 338],
  [1624, 342],
  [1800, 370],
  [2000, 410],
]);

/** Same idea for the 400 × 620 phone layout. */
export const MOBILE_RIBBON = smoothPath([
  [-200, 400],
  [-60, 440],
  [60, 490],
  [180, 500],
  [260, 460],
  [330, 380],
  [420, 300],
  [520, 270],
  [700, 300],
]);
