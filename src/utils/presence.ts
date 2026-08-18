/**
 * Presence — the single authoritative model for "how much should we trust this
 * marker's position right now".
 *
 * ── Why this exists ─────────────────────────────────────────────────────────
 * Freshness rules used to be scattered across components, and two genuinely
 * different situations were written to the SAME database value:
 *
 *   setLocationOffline()  → status 'offline'   (user deliberately went dark)
 *   getLocationStatus()   → 'offline'          (no ping for >15 min)
 *
 * So "I chose to stop sharing" and "we lost them" were indistinguishable. For a
 * safety product that is the wrong thing to get wrong in either direction:
 * showing a lost person as merely private hides an emergency, and showing a
 * private person as lost invites a false alarm.
 *
 * Four states, and every surface (marker, drawer, list, notification) must
 * derive from this function rather than re-implementing thresholds:
 *
 *   live    position is current within LIVE_WINDOW_MS
 *   stale   we still have data, but it is older than we would like
 *   dark    the user intentionally stopped sharing — position is last-known
 *   unknown we have no usable position or timestamp at all
 *
 * `dark` deliberately outranks staleness: a dark user's position does not decay
 * into "stale", because staleness implies we are still expecting updates.
 */
import type { LocationStatus } from '@/types/database';

export type PresenceState = 'live' | 'stale' | 'dark' | 'unknown';

/** Position is trustworthy as "now" within this window. */
export const LIVE_WINDOW_MS = 5 * 60 * 1000;
/** Beyond this we no longer describe the position as recent at all. */
export const STALE_WINDOW_MS = 15 * 60 * 1000;

export interface Presence {
  state: PresenceState;
  /** ISO timestamp of the last position we received, if any. */
  lastUpdatedAt: string | null;
  /** Age of that position in ms, or null when unknown. */
  ageMs: number | null;
  /**
   * Whether a heading/direction indicator may be drawn.
   *
   * False for dark and unknown: continuing to render a direction cone after
   * someone stops sharing asserts a live facing direction we no longer have.
   */
  isDirectional: boolean;
  /** Whether the coordinate may be described to the user as current. */
  isPositionCurrent: boolean;
  /** Short label for badges: 'Live' | 'Stale' | 'Dark' | 'Unknown'. */
  label: string;
}

export interface PresenceInput {
  /** Row status from live_locations. 'paused' means deliberate go-dark. */
  status?: LocationStatus | null;
  /** Last position timestamp (ISO). */
  lastPingAt?: string | null;
  /**
   * Explicit local override — used for SELF, where we know our own go-dark
   * state immediately without waiting for a round-trip.
   */
  isDark?: boolean;
  /** Injectable for deterministic tests. */
  now?: number;
}

export function resolvePresence(input: PresenceInput): Presence {
  const now = input.now ?? Date.now();
  const lastUpdatedAt = input.lastPingAt ?? null;
  const parsed = lastUpdatedAt ? new Date(lastUpdatedAt).getTime() : NaN;
  const ageMs = Number.isFinite(parsed) ? Math.max(0, now - parsed) : null;

  // Deliberate go-dark wins over every freshness consideration.
  const deliberatelyDark = input.isDark === true || input.status === 'paused';
  if (deliberatelyDark) {
    return {
      state: 'dark',
      lastUpdatedAt,
      ageMs,
      isDirectional: false,
      isPositionCurrent: false,
      label: 'Dark',
    };
  }

  if (ageMs === null) {
    return {
      state: 'unknown',
      lastUpdatedAt,
      ageMs: null,
      isDirectional: false,
      isPositionCurrent: false,
      label: 'Unknown',
    };
  }

  if (ageMs < LIVE_WINDOW_MS) {
    return {
      state: 'live',
      lastUpdatedAt,
      ageMs,
      isDirectional: true,
      isPositionCurrent: true,
      label: 'Live',
    };
  }

  if (ageMs < STALE_WINDOW_MS) {
    return {
      state: 'stale',
      lastUpdatedAt,
      ageMs,
      // Still directional: they are moving, we are just behind.
      isDirectional: true,
      isPositionCurrent: false,
      label: 'Stale',
    };
  }

  return {
    state: 'unknown',
    lastUpdatedAt,
    ageMs,
    isDirectional: false,
    isPositionCurrent: false,
    label: 'No signal',
  };
}

/** Colour for each presence state. One mapping, used by every surface. */
export const PRESENCE_COLOR: Record<PresenceState, string> = {
  live: '#22c55e',
  stale: '#f59e0b',
  dark: '#6b7280',
  unknown: '#6b7280',
};

/**
 * Human phrasing for "when did we last hear from them".
 * Deliberately never says "now" — the freshest honest phrasing is "just now".
 */
export function formatLastSeen(ageMs: number | null): string {
  if (ageMs === null) return 'never';
  const secs = Math.floor(ageMs / 1000);
  if (secs < 45) return 'just now';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr${hrs === 1 ? '' : 's'} ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

/** Sentence describing a marker's trustworthiness, for detail drawers. */
export function describePresence(presence: Presence, name: string): string {
  const seen = formatLastSeen(presence.ageMs);
  switch (presence.state) {
    case 'live':
      return `${name} is sharing live. Updated ${seen}.`;
    case 'stale':
      return `${name}'s position may be out of date. Last updated ${seen}.`;
    case 'dark':
      return `${name} went dark. This is their last known location, from ${seen}.`;
    default:
      return `No recent position for ${name}. Last updated ${seen}.`;
  }
}
