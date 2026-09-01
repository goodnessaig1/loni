/**
 * Lightweight turn-by-turn engine built on Google Directions `steps` +
 * the device's GPS stream. No paid navigation SDK.
 *
 * Given the ordered route steps and the driver's current position it works
 * out: which step they're on, how far to the next maneuver, distance/ETA
 * remaining, and whether they've left the route (so the caller can
 * re-request a fresh route). The trip screen turns this into the maneuver
 * banner + voice prompts.
 */
import { useMemo, useRef } from 'react';
import { getDistance, getRhumbLineBearing } from 'geolib';
import type { RouteStep } from '../../store/rideStore';

export interface TbtState {
  stepIndex: number;
  step: RouteStep | null;
  nextStep: RouteStep | null;
  distanceToManeuver: number;   // metres to the end of the current step
  distanceRemaining: number;    // metres to the destination
  durationRemaining: number;    // seconds (proportional estimate)
  bearing: number | null;       // driver -> next maneuver
  isOffRoute: boolean;
  arrived: boolean;
}

const OFF_ROUTE_METERS = 55;
const STEP_ADVANCE_METERS = 25;

function toLL(p: { lat: number; lng: number }) {
  return { latitude: p.lat, longitude: p.lng };
}

export function computeTbt(
  steps: RouteStep[],
  pos: { latitude: number; longitude: number } | null,
  prevIndex: number,
): TbtState {
  if (!steps.length || !pos) {
    return {
      stepIndex: 0, step: steps[0] ?? null, nextStep: steps[1] ?? null,
      distanceToManeuver: 0, distanceRemaining: 0, durationRemaining: 0,
      bearing: null, isOffRoute: false, arrived: false,
    };
  }

  // Find the step whose end is closest ahead of us, never going backwards.
  let stepIndex = Math.min(prevIndex, steps.length - 1);
  for (let i = stepIndex; i < steps.length; i++) {
    const end = toLL(steps[i].end);
    const d = getDistance(pos, end);
    if (d > STEP_ADVANCE_METERS) {
      stepIndex = i;
      break;
    }
    stepIndex = Math.min(i + 1, steps.length - 1);
  }

  const step = steps[stepIndex] ?? null;
  const nextStep = steps[stepIndex + 1] ?? null;
  const maneuverPoint = step ? toLL(step.end) : null;

  const distanceToManeuver = maneuverPoint ? getDistance(pos, maneuverPoint) : 0;

  // Remaining = distance to this step's end + all subsequent step lengths.
  let distanceRemaining = distanceToManeuver;
  let durationRemaining = 0;
  for (let i = stepIndex; i < steps.length; i++) {
    if (i > stepIndex) distanceRemaining += steps[i].distance_meters;
    durationRemaining += steps[i].duration_seconds;
  }
  // Scale duration by how much of the current step is left.
  if (step && step.distance_meters > 0) {
    const frac = Math.min(1, distanceToManeuver / step.distance_meters);
    durationRemaining -= step.duration_seconds * (1 - frac);
  }

  // Off-route: distance from the nearest step endpoint line. Cheap proxy -
  // min distance to any step start/end vertex.
  let minVertex = Infinity;
  for (const s of steps) {
    minVertex = Math.min(minVertex, getDistance(pos, toLL(s.start)), getDistance(pos, toLL(s.end)));
  }
  const isOffRoute = minVertex > OFF_ROUTE_METERS;

  const bearing = maneuverPoint
    ? getRhumbLineBearing(pos, maneuverPoint)
    : null;

  const lastEnd = toLL(steps[steps.length - 1].end);
  const arrived = getDistance(pos, lastEnd) < 30;

  return {
    stepIndex, step, nextStep, distanceToManeuver,
    distanceRemaining, durationRemaining: Math.max(0, Math.round(durationRemaining)),
    bearing, isOffRoute, arrived,
  };
}

/** Stateful wrapper that keeps the step index monotonic across renders. */
export function useTurnByTurn(
  steps: RouteStep[],
  pos: { latitude: number; longitude: number } | null,
): TbtState {
  const idxRef = useRef(0);
  return useMemo(() => {
    const state = computeTbt(steps, pos, idxRef.current);
    idxRef.current = state.stepIndex;
    return state;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [steps, pos?.latitude, pos?.longitude]);
}

export function maneuverIcon(maneuver?: string | null): string {
  const m = maneuver || '';
  if (m.includes('left')) return 'arrow-left-top';
  if (m.includes('right')) return 'arrow-right-top';
  if (m.includes('uturn')) return 'u-turn-left';
  if (m.includes('roundabout')) return 'rotate-right';
  if (m.includes('merge')) return 'call-merge';
  if (m.includes('fork')) return 'call-split';
  if (m.includes('ramp')) return 'arrow-top-right';
  return 'arrow-up';
}
