/**
 * Ingress normalisation and validation for map entities.
 *
 * Every external row — initial fetch AND realtime payload — passes through here
 * before it reaches a store. Two problems this solves:
 *
 * 1. Shape drift. Supabase realtime does not always deliver the same JSON shape
 *    as PostgREST: jsonb columns can arrive as strings, and numerics as strings.
 *    saved_places already had a bespoke normaliser for exactly this reason;
 *    markers and live_locations had none and were storing raw rows.
 *
 * 2. Silent disappearance. Malformed entities used to be dropped at RENDER time
 *    by `Number.isFinite` guards inside the marker components, which produced a
 *    missing pin with no diagnostic anywhere. Rejecting at ingress means a bad
 *    row is reported once, with context, instead of vanishing.
 */

/** Coerce a Postgres numeric that may arrive as a string. */
export function toFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function isValidLatitude(value: number | null): value is number {
  return value !== null && value >= -90 && value <= 90;
}

export function isValidLongitude(value: number | null): value is number {
  return value !== null && value >= -180 && value <= 180;
}

/** Parse a jsonb column that realtime may deliver as a JSON string. */
export function toArray<T>(value: unknown): T[] {
  let candidate = value;
  if (typeof candidate === 'string') {
    try {
      candidate = JSON.parse(candidate);
    } catch {
      return [];
    }
  }
  return Array.isArray(candidate) ? (candidate as T[]) : [];
}

/**
 * Report a rejected row. Loud in development, silent in production — a bad row
 * should never crash the map, but it must not vanish without explanation while
 * anyone is looking.
 */
export function rejectRow(entity: string, reason: string, row: unknown): null {
  if (__DEV__) {
    const id =
      row && typeof row === 'object' && 'id' in row ? String((row as { id: unknown }).id) : '<no id>';
    console.warn(`[map/normalize] rejected ${entity} ${id}: ${reason}`, row);
  }
  return null;
}
