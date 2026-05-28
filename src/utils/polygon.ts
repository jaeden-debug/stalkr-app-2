import type { LatLng } from '@/types/database';

/**
 * Ray-casting point-in-polygon test (works for lat/lng polygons)
 */
export function isInsidePolygon(point: LatLng, polygon: LatLng[]): boolean {
  if (polygon.length < 3) return false;

  const { latitude: px, longitude: py } = point;
  let inside = false;
  const n = polygon.length;

  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = polygon[i].latitude;
    const yi = polygon[i].longitude;
    const xj = polygon[j].latitude;
    const yj = polygon[j].longitude;

    const intersect =
      yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;

    if (intersect) inside = !inside;
  }

  return inside;
}

/**
 * Calculate centroid of a polygon (for label placement)
 */
export function getPolygonCenter(polygon: LatLng[]): LatLng {
  if (polygon.length === 0) return { latitude: 0, longitude: 0 };

  const sum = polygon.reduce(
    (acc, p) => ({ latitude: acc.latitude + p.latitude, longitude: acc.longitude + p.longitude }),
    { latitude: 0, longitude: 0 },
  );

  return {
    latitude: sum.latitude / polygon.length,
    longitude: sum.longitude / polygon.length,
  };
}

/**
 * Approximate area of polygon in m² using the Shoelace formula
 * (rough estimate, fine for zone display purposes)
 */
export function getPolygonAreaM2(polygon: LatLng[]): number {
  if (polygon.length < 3) return 0;

  const DEG_TO_RAD = Math.PI / 180;
  const EARTH_RADIUS = 6371000;

  // Convert to x/y in metres relative to first point
  const origin = polygon[0];
  const points = polygon.map((p) => ({
    x: (p.longitude - origin.longitude) * DEG_TO_RAD * EARTH_RADIUS * Math.cos(origin.latitude * DEG_TO_RAD),
    y: (p.latitude - origin.latitude) * DEG_TO_RAD * EARTH_RADIUS,
  }));

  let area = 0;
  const n = points.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    area += (points[j].x + points[i].x) * (points[j].y - points[i].y);
  }

  return Math.abs(area) / 2;
}

/**
 * Simplify polygon by removing points closer than thresholdM metres apart
 */
export function simplifyPolygon(polygon: LatLng[], thresholdM: number): LatLng[] {
  if (polygon.length <= 3) return polygon;

  const { getDistance } = require('./distance');
  const result: LatLng[] = [polygon[0]];

  for (let i = 1; i < polygon.length; i++) {
    const last = result[result.length - 1];
    if (getDistance(last, polygon[i]) >= thresholdM) {
      result.push(polygon[i]);
    }
  }

  return result;
}
