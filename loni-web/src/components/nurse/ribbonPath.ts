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

/**
 * 400 × 500 phone layout: a gentle dip in from the left that disappears behind the card, then a steep
 * climb out of its right edge toward the top-right corner (as in the mobile design).
 */
export const MOBILE_RIBBON =
  'M-250,228 C-120,262 40,300 110,304 ' +
  'C200,309 260,260 336,217 ' +
  'C381,191 405,163 460,110 ' +
  'C490,80 540,40 600,0';
