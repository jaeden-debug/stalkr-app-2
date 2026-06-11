import type { LatLng } from '@/types/database';

const R = 6371e3; // Earth radius in metres

/**
 * Haversine distance between two coordinates (metres)
 */
export function getDistance(a: LatLng, b: LatLng): number {
  const φ1 = (a.latitude * Math.PI) / 180;
  const φ2 = (b.latitude * Math.PI) / 180;
  const Δφ = ((b.latitude - a.latitude) * Math.PI) / 180;
  const Δλ = ((b.longitude - a.longitude) * Math.PI) / 180;
  const x =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  return R * c;
}

/**
 * Bearing from point A to point B (degrees, 0=N, 90=E)
 */
export function getBearing(a: LatLng, b: LatLng): number {
  const φ1 = (a.latitude * Math.PI) / 180;
  const φ2 = (b.latitude * Math.PI) / 180;
  const Δλ = ((b.longitude - a.longitude) * Math.PI) / 180;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (Math.atan2(y, x) * (180 / Math.PI) + 360) % 360;
}

/**
 * Format distance for display
 */
export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)}m`;
  const km = meters / 1000;
  if (km < 10) return `${km.toFixed(1)}km`;
  return `${Math.round(km)}km`;
}

/**
 * Format distance in miles / feet (imperial)
 */
export function formatDistanceMiles(meters: number): string {
  const miles = meters / 1609.344;
  if (miles < 0.1) return `${Math.round(meters * 3.28084)}ft`;
  if (miles < 10) return `${miles.toFixed(1)}mi`;
  return `${Math.round(miles)}mi`;
}

/**
 * Format distance showing BOTH metric and imperial, e.g.
 *   "150 m · 492 ft"  or  "1.2 km · 0.7 mi".
 */
export function formatDistanceBoth(meters: number): string {
  const m = Math.max(0, meters);
  const metric =
    m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(m / 1000 < 10 ? 1 : 0)} km`;
  const miles = m / 1609.344;
  const imperial =
    miles < 0.1 ? `${Math.round(m * 3.28084)} ft` : `${miles.toFixed(miles < 10 ? 1 : 0)} mi`;
  return `${metric} · ${imperial}`;
}

/**
 * Check if a point is inside a circle zone
 */
export function isInsideCircle(point: LatLng, center: LatLng, radiusMeters: number): boolean {
  return getDistance(point, center) <= radiusMeters;
}
