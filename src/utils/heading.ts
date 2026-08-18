/**
 * Heading and compass utilities
 */

const CARDINAL_DIRECTIONS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const;
export type CardinalDirection = (typeof CARDINAL_DIRECTIONS)[number];

/**
 * Convert degrees to cardinal direction string
 */
export function degreesToCardinal(degrees: number): CardinalDirection {
  const normalised = ((degrees % 360) + 360) % 360;
  const index = Math.round(normalised / 45) % 8;
  return CARDINAL_DIRECTIONS[index];
}

/**
 * Normalise a raw GPS heading to 0–360
 * Falls back to calculating bearing from movement if heading is invalid
 */
export function normaliseHeading(
  rawHeading: number | null | undefined,
  prevLat: number | null,
  prevLng: number | null,
  lat: number,
  lng: number,
): number {
  if (typeof rawHeading === 'number' && rawHeading >= 0 && rawHeading <= 360) {
    return rawHeading;
  }
  if (prevLat !== null && prevLng !== null) {
    const dLng = lng - prevLng;
    const dLat = lat - prevLat;
    const bearing = (Math.atan2(dLng, dLat) * (180 / Math.PI) + 360) % 360;
    return bearing;
  }
  return 0;
}

/**
 * Format heading for display (e.g. "045° NE")
 */
export function formatHeading(degrees: number): string {
  const normalised = Math.round(((degrees % 360) + 360) % 360);
  const cardinal = degreesToCardinal(normalised);
  return `${String(normalised).padStart(3, '0')}° ${cardinal}`;
}

/**
 * Wrap any angle into [0, 360).
 */
export function normalizeDegrees(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

/**
 * Signed shortest rotation from `from` to `to`, in (-180, 180].
 *
 * Compass angles are modular, so they cannot be compared or averaged as plain
 * numbers: 358° and 2° are 4° apart, not 356°. Every comparison, threshold and
 * interpolation on headings in this codebase must route through here.
 *
 *   shortestAngleDelta(358, 2)  →   4
 *   shortestAngleDelta(2, 358)  →  -4
 *   shortestAngleDelta(0, 180)  → 180
 */
export function shortestAngleDelta(from: number, to: number): number {
  return ((((to - from) % 360) + 540) % 360) - 180;
}

export interface HeadingSmootherOptions {
  /** Base responsiveness, 0..1. Higher follows the sensor faster and jitters more. */
  alpha?: number;
  /** Deltas smaller than this (degrees) are treated as sensor noise and dropped. */
  deadbandDeg?: number;
  /** Deltas larger than this (degrees) bypass smoothing so real turns feel instant. */
  snapDeg?: number;
}

export interface HeadingSmoother {
  /** Feed a raw reading; returns the smoothed heading, or null if unusable. */
  push: (raw: number | null | undefined) => number | null;
  /** Current smoothed value without feeding a reading. */
  value: () => number | null;
  /** Forget history — call when the sensor stops or permission is lost. */
  reset: () => void;
}

/**
 * Circular low-pass filter for magnetometer heading.
 *
 * A raw compass reading swings ±5–15° indoors and worse near metal, so feeding
 * it straight to a marker makes the arrow shiver while the user stands still.
 * A plain average would be wrong across the 0/360 seam, so this filter always
 * moves along the SHORTEST arc.
 *
 * Three behaviours, tuned to avoid the usual "smooth but laggy" trade:
 *   • deadband — sub-degree wobble is discarded outright, so a stationary phone
 *     produces a genuinely stationary arrow rather than a slow drift.
 *   • snap     — a delta above `snapDeg` means the user actually turned, so we
 *     jump straight there. Turning your body never feels sluggish.
 *   • ease     — everything between is eased by `alpha`.
 */
export function createHeadingSmoother(options: HeadingSmootherOptions = {}): HeadingSmoother {
  const alpha = options.alpha ?? 0.25;
  const deadbandDeg = options.deadbandDeg ?? 1.5;
  const snapDeg = options.snapDeg ?? 25;

  let current: number | null = null;

  return {
    push(raw) {
      if (raw == null || !Number.isFinite(raw)) return current;

      const next = normalizeDegrees(raw);

      // First usable reading — adopt it directly rather than easing up from 0,
      // which would sweep the arrow across the dial on launch.
      if (current === null) {
        current = next;
        return current;
      }

      const delta = shortestAngleDelta(current, next);
      const magnitude = Math.abs(delta);

      if (magnitude < deadbandDeg) return current;
      if (magnitude >= snapDeg) {
        current = next;
        return current;
      }

      current = normalizeDegrees(current + delta * alpha);
      return current;
    },

    value() {
      return current;
    },

    reset() {
      current = null;
    },
  };
}

/**
 * Format speed for display
 */
export function formatSpeed(mps: number | null | undefined): string {
  if (mps === null || mps === undefined || mps < 0) return '0 mph';
  const mph = mps * 2.23694;
  return `${mph.toFixed(1)} mph`;
}
