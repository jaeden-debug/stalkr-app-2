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
 * Format speed for display
 */
export function formatSpeed(mps: number | null | undefined): string {
  if (mps === null || mps === undefined || mps < 0) return '0 mph';
  const mph = mps * 2.23694;
  return `${mph.toFixed(1)} mph`;
}
