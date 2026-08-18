/**
 * Trail sampling policy — decides which GPS fixes become trail points.
 *
 * Pure and deterministic so it can be tested without a device.
 *
 * ── What was wrong ──────────────────────────────────────────────────────────
 * The old gate required distance AND time:
 *     distOk = moved >= 18m ;  timeOk = elapsed >= 90s
 *     if ((!distOk || !timeOk) && prev) return;
 *
 * Both had to pass, so a point was written at most once every 90 seconds. At
 * walking pace that is a point roughly every 126 m, and while driving over a
 * kilometre apart — every corner between them is erased and the trail renders
 * as a straight line through buildings. It also never looked at accuracy, and
 * after a long pause it joined the old position to the new one with a line the
 * user never walked.
 *
 * ── The policy ──────────────────────────────────────────────────────────────
 * Record when movement is real, stay quiet when it is not:
 *
 *   reject   poor accuracy, out-of-order fixes, impossible jumps, duplicates
 *   segment  break the line after a long gap instead of inventing a straight
 *            line across it
 *   turn     record on a significant heading change so corners survive
 *   adaptive distance threshold scales with speed — tight enough to keep a
 *            walking path faithful, loose enough that driving does not flood
 *   heartbeat record occasionally while moving even if under threshold
 *
 * None of this claims sub-GPS precision. It preserves the fidelity the device
 * actually reports and discards what it cannot support.
 */

export interface TrailFix {
  latitude: number;
  longitude: number;
  /** Reported horizontal accuracy in metres. */
  accuracy: number;
  /** Metres per second, when known. */
  speed?: number | null;
  /** Degrees, when known. */
  heading?: number | null;
  /** Epoch ms of the fix. */
  timestamp: number;
}

export interface TrailAnchor {
  latitude: number;
  longitude: number;
  heading?: number | null;
  timestamp: number;
}

export type TrailReject =
  | 'poor_accuracy'
  | 'out_of_order'
  | 'implausible_jump'
  | 'stationary'
  | 'too_soon';

export type TrailDecision =
  | { record: true; startsNewSegment: boolean; reason: 'first' | 'segment_gap' | 'distance' | 'turn' | 'heartbeat' }
  | { record: false; reason: TrailReject };

export const TRAIL_POLICY = {
  /** Fixes worse than this are not worth drawing a path from. */
  MAX_ACCURACY_M: 50,
  /** Never write two points closer together in time than this. */
  MIN_INTERVAL_MS: 5_000,
  /** While moving, write at least this often even if under the distance gate. */
  HEARTBEAT_MS: 60_000,
  /** A gap this long means we stopped hearing from the device — break the line. */
  SEGMENT_GAP_MS: 5 * 60_000,
  /** Distance gate floor (slow/stationary) and ceiling (fast). */
  MIN_DISTANCE_M: 10,
  MAX_DISTANCE_M: 60,
  /** Distance gate ≈ this many seconds of travel at the current speed. */
  DISTANCE_SECONDS: 8,
  /** Heading change that counts as a corner worth preserving. */
  TURN_DEGREES: 30,
  /** A turn only counts once the user has actually moved this far. */
  TURN_MIN_DISTANCE_M: 5,
  /** Faster than this is a GPS glitch, not travel (~215 km/h). */
  MAX_SPEED_MPS: 60,
} as const;

export function haversineMeters(
  lat1: number, lon1: number, lat2: number, lon2: number,
): number {
  const R = 6371e3;
  const p1 = (lat1 * Math.PI) / 180;
  const p2 = (lat2 * Math.PI) / 180;
  const dp = ((lat2 - lat1) * Math.PI) / 180;
  const dl = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Shortest angular difference in degrees, 0..180. */
function angleDelta(a: number, b: number): number {
  return Math.abs((((b - a) % 360) + 540) % 360 - 180);
}

/**
 * Distance a point must cover before it is worth recording, given how fast the
 * user is going. Standing still demands a large move (so drift does not
 * scribble); driving allows a large one (so we do not flood).
 */
function distanceGate(speedMps: number): number {
  const raw = Math.abs(speedMps) * TRAIL_POLICY.DISTANCE_SECONDS;
  return Math.min(TRAIL_POLICY.MAX_DISTANCE_M, Math.max(TRAIL_POLICY.MIN_DISTANCE_M, raw));
}

export function decideTrailPoint(
  previous: TrailAnchor | null,
  fix: TrailFix,
): TrailDecision {
  if (!Number.isFinite(fix.accuracy) || fix.accuracy > TRAIL_POLICY.MAX_ACCURACY_M) {
    return { record: false, reason: 'poor_accuracy' };
  }

  if (!previous) {
    return { record: true, startsNewSegment: true, reason: 'first' };
  }

  const elapsed = fix.timestamp - previous.timestamp;

  // A fix older than the anchor cannot extend the path. Queued offline writes
  // and retries can both deliver these.
  if (elapsed <= 0) {
    return { record: false, reason: 'out_of_order' };
  }

  const moved = haversineMeters(
    previous.latitude, previous.longitude, fix.latitude, fix.longitude,
  );

  // Long silence — the user went dark, lost signal, or closed the app. Joining
  // the two positions would draw a route they never took, so start a new
  // segment instead. Checked before the jump filter, since a legitimate gap
  // legitimately covers a long distance.
  if (elapsed >= TRAIL_POLICY.SEGMENT_GAP_MS) {
    return { record: true, startsNewSegment: true, reason: 'segment_gap' };
  }

  const impliedSpeed = moved / (elapsed / 1000);
  if (impliedSpeed > TRAIL_POLICY.MAX_SPEED_MPS) {
    return { record: false, reason: 'implausible_jump' };
  }

  if (elapsed < TRAIL_POLICY.MIN_INTERVAL_MS) {
    return { record: false, reason: 'too_soon' };
  }

  // Corners carry most of a path's shape, so a real direction change is worth a
  // point even when the distance gate has not been met.
  const headingKnown = fix.heading != null && previous.heading != null;
  if (
    headingKnown &&
    moved >= TRAIL_POLICY.TURN_MIN_DISTANCE_M &&
    angleDelta(previous.heading as number, fix.heading as number) >= TRAIL_POLICY.TURN_DEGREES
  ) {
    return { record: true, startsNewSegment: false, reason: 'turn' };
  }

  if (moved >= distanceGate(fix.speed ?? 0)) {
    return { record: true, startsNewSegment: false, reason: 'distance' };
  }

  // Moving but under the gate for a long time — keep the line alive rather than
  // leaving a minutes-long hole.
  const moving = (fix.speed ?? 0) > 0.5 || moved > TRAIL_POLICY.MIN_DISTANCE_M / 2;
  if (moving && elapsed >= TRAIL_POLICY.HEARTBEAT_MS) {
    return { record: true, startsNewSegment: false, reason: 'heartbeat' };
  }

  return { record: false, reason: 'stationary' };
}

/**
 * Split an ordered point list wherever the time gap is large enough that a
 * connecting line would misrepresent the path. Renderers draw one polyline per
 * segment.
 */
export function segmentTrail<T extends { timestamp: number }>(points: T[]): T[][] {
  if (points.length === 0) return [];
  const segments: T[][] = [[points[0]]];
  for (let i = 1; i < points.length; i++) {
    const gap = points[i].timestamp - points[i - 1].timestamp;
    if (gap >= TRAIL_POLICY.SEGMENT_GAP_MS) segments.push([points[i]]);
    else segments[segments.length - 1].push(points[i]);
  }
  return segments;
}
