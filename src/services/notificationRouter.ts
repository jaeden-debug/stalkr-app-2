/**
 * Where a tapped notification takes you.
 *
 * Until now nothing in this app listened for a notification tap at all. Every
 * push — SOS, zone alerts, overdue journeys — did the same thing when tapped:
 * opened the app on whatever screen you last left. The notification told you
 * something urgent had happened and then dropped you somewhere unrelated,
 * leaving you to go find it. For an SOS that is the difference between
 * "someone needs help, here they are" and "someone needs help, good luck".
 *
 * Routing is kept as a PURE function so every push type can be tested without
 * a device, a navigator, or a notification. The hook below is deliberately
 * thin — it wires listeners and delegates every decision here.
 *
 * The design rule: a notification lands you where you can ACT on it. Not a
 * generic inbox, not the last screen — the specific place the thing happened.
 */

/** Payload shape carried by our own pushes. Anything else is untrusted. */
export interface NotificationData {
  type?: string;
  sessionId?: string;
  zoneId?: string;
  markerId?: string;
  groupId?: string;
  latitude?: number;
  longitude?: number;
  [k: string]: unknown;
}

export interface RouteTarget {
  /** Expo Router path. */
  pathname: string;
  /** Query params to pass along. */
  params?: Record<string, string>;
}

/**
 * The map screen is the destination for anything with a position, because that
 * is the only screen where "where" is answerable.
 */
const MAP = '/(tabs)/map';
const SESSIONS = '/(tabs)/sessions';
const ACTIVITY = '/activity';

/**
 * Marker-type pushes reuse the marker's own type string as their notification
 * type, so they are matched as a set rather than enumerated twice.
 */
const MARKER_TYPES = new Set([
  'camp', 'vehicle', 'waypoint', 'animal_sign', 'evidence',
  'supply_cache', 'custom', 'self', 'danger', 'safe_zone',
  'circle', 'polygon',
]);

/**
 * Decide where a tap should land.
 *
 * Returns null when there is nothing better to do than simply open the app —
 * which is honest, and better than inventing a destination that will confuse
 * someone who tapped an informational notice.
 */
export function routeForNotification(data: NotificationData | null | undefined): RouteTarget | null {
  if (!data || typeof data.type !== 'string') return null;
  const type = data.type;

  // ── Emergencies ───────────────────────────────────────────────────────────
  // Straight to the map, focused on the reported coordinates when we have them.
  // Someone tapping an SOS is trying to find a person, and every extra tap is
  // spent while that person is waiting.
  if (type === 'sos') {
    const params: Record<string, string> = { focus: 'sos' };
    if (isFiniteNumber(data.latitude) && isFiniteNumber(data.longitude)) {
      params.lat = String(data.latitude);
      params.lng = String(data.longitude);
    }
    return { pathname: MAP, params };
  }
  if (type === 'sos_cancel') return { pathname: MAP, params: { focus: 'sos_cancel' } };

  // ── Journeys ──────────────────────────────────────────────────────────────
  // The overdue nudge is the one push in this app with a deadline attached to
  // answering it, so it lands on the map where the prompt to extend or confirm
  // arrival is waiting.
  if (type === 'journey_overdue_nudge') {
    return { pathname: MAP, params: { focus: 'journey_overdue' } };
  }
  if (type === 'journey_overdue_alert') {
    return withSession(SESSIONS, data, { focus: 'journey_overdue' });
  }
  if (type === 'arrival' || type === 'session_arrived' || type === 'session_ended') {
    return withSession(SESSIONS, data);
  }

  // ── Check-ins ─────────────────────────────────────────────────────────────
  // A due or missed check-in needs the same answer as an overdue journey: the
  // place where you confirm you are fine.
  if (type === 'checkin_due' || type === 'checkin_missed') {
    return { pathname: MAP, params: { focus: 'checkin' } };
  }
  if (type === 'checkin_confirmed' || type === 'checkin_set') {
    return { pathname: MAP };
  }

  // ── Zones and markers ─────────────────────────────────────────────────────
  if (type === 'zone_crew' || type === 'zone_enter') {
    const params: Record<string, string> = {};
    if (typeof data.zoneId === 'string') params.zoneId = data.zoneId;
    if (typeof data.markerId === 'string') params.markerId = data.markerId;
    return { pathname: MAP, params: Object.keys(params).length ? params : undefined };
  }
  if (MARKER_TYPES.has(type)) {
    return {
      pathname: MAP,
      params: typeof data.markerId === 'string' ? { markerId: data.markerId } : undefined,
    };
  }

  // ── Crew chatter ──────────────────────────────────────────────────────────
  if (type === 'crew' || type === 'broadcast') return { pathname: ACTIVITY };

  // 'general' is used for journey invites, which carry a session id, and for
  // genuinely generic notices, which do not.
  if (type === 'general') {
    return typeof data.sessionId === 'string' ? withSession(SESSIONS, data) : null;
  }

  return null;
}

function withSession(
  pathname: string,
  data: NotificationData,
  extra: Record<string, string> = {},
): RouteTarget {
  const params = { ...extra };
  if (typeof data.sessionId === 'string') params.sessionId = data.sessionId;
  return { pathname, params: Object.keys(params).length ? params : undefined };
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}
