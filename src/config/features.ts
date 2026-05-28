/**
 * Feature flags — set to false to instantly hide/disable any feature.
 * Safe to toggle at build time or runtime (some features check this at render).
 * 
 * To rebrand from Stalkr → HuntLink: update APP_NAME in .env only.
 */
export const FEATURES = {
  // --- Core ---
  LIVE_TRACKING: true,
  GROUPS: true,
  SESSIONS: true,
  MARKERS: true,

  // --- Premium ---
  POLYGON_ZONES: true,
  ZONE_ALERTS: true,
  TRAIL_HISTORY: true,
  MARKER_PHOTOS: true,
  JOURNEY_MODE: true,
  EMERGENCY_CONTACTS: true,
  WATCHER_NOTIFICATIONS: true,
  EXPORT_COORDINATES: true,
  APPROXIMATE_LOCATION: true,

  // --- Bonus / Custom Features ---
  /** Safety Check-In Timer: user sets "check on me in N minutes" */
  CHECKIN_TIMER: true,
  /** Low signal / stale risk badge with optional admin alert */
  LOW_SIGNAL_MONITOR: true,
  /** Silent SOS / Panic Pin — discreet emergency button */
  SOS_MODE: true,
  /** Rally Point Mode — group owner sets rally; members see bearing/distance */
  RALLY_POINTS: true,

  // --- Future (disabled by default) ---
  OFFLINE_MAPS: false,
  WEATHER_OVERLAY: false,
  GARMIN_INTEGRATION: false,
  AI_SAFETY_ASSISTANT: false,
  ROUTE_PLANNING: false,
  MESH_NETWORKING: false,
} as const;

export type FeatureKey = keyof typeof FEATURES;

/** Check if a feature is enabled */
export function isFeatureEnabled(key: FeatureKey): boolean {
  return FEATURES[key] === true;
}
