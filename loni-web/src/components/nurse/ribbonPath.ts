/*
 * Ribbon centre lines as a handful of cubic Béziers whose joins share a tangent, so the band has a
 * constant, kink-free curvature (a path threaded through many waypoints wobbles).
 */

/**
 * 1624 × 1122 desktop design space: enters from the left, levels out at a trough just before the
 * card, rises steeply behind it, and leaves on the right flattening out toward the edge.
 */
export const DESKTOP_RIBBON =
  'M-400,503 C-50,625.5 325,840 540,826 ' + // down to the trough
  'C790,810 874,603 1074,493 ' + // up behind the card, slope ≈ -0.55 where it re-emerges
  'C1224,410.5 1325,344 1500,338 ' + // flatten out
  'C1750,330 1750,360 2000,400'; // gentle fall off the right edge

/** 400 × 560 phone layout, same shape. */
export const MOBILE_RIBBON =
  'M-200,420 C-80,462 70,500 170,500 ' +
  'C250,500 270,420 330,380 ' +
  'C390,340 430,270 520,270 ' +
  'C610,270 620,290 700,300';
