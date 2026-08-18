/** Map display constants */
export const MAP_CONSTANTS = {
  DEFAULT_REGION: {
    latitude: 39.8283,
    longitude: -98.5795,
    latitudeDelta: 10,
    longitudeDelta: 10,
  },
  INITIAL_ZOOM: {
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  },
  // Freshness thresholds intentionally do NOT live here. They are defined once
  // in utils/presence.ts (LIVE_WINDOW_MS / STALE_WINDOW_MS) and everything that
  // judges freshness reads them from there. These duplicates were dead — nothing
  // imported them — but a dead copy of a security- and safety-relevant constant
  // is exactly what gets picked up later and quietly diverges.
  MIN_TRAIL_DISTANCE_M: 18,
  MIN_TRAIL_TIME_MS: 90_000,
  MAX_ACCURACY_FIRST_FIX_M: 65,
  MAX_ACCURACY_TRACKING_M: 35,
  STATIONARY_SPEED_MPS: 0.8,
  STATIONARY_DRIFT_M: 12,
  MAX_REASONABLE_SPEED_MPS: 45,
  DESTINATION_ARRIVAL_RADIUS_M: 50,
  CREW_MARKER_SIZE: 44,
  SELF_MARKER_SIZE: 52,
  HEADING_ARROW_SIZE: 24,
  ZONE_STROKE_WIDTH: 2,
  TRAIL_STROKE_WIDTH: 3,
  TRAIL_DASH_PATTERN: [6, 6],
} as const;

export const CREW_COLORS = [
  '#22c55e', // green
  '#3b82f6', // blue
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#f97316', // orange
  '#84cc16', // lime
  '#a855f7', // purple
] as const;

export type CrewColor = (typeof CREW_COLORS)[number];

/**
 * Stable palette index for a userId.
 *
 * Exported so the generated cone artwork (mapMarkerImages.ts) can be picked by
 * the same index that chooses the colour — otherwise a member's cone and badge
 * could disagree.
 */
export function getCrewColorIndex(userId: string): number {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % CREW_COLORS.length;
}

/** Assign stable color from userId */
export function getCrewColor(userId: string): CrewColor {
  return CREW_COLORS[getCrewColorIndex(userId)];
}
