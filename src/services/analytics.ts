/**
 * PostHog analytics service
 *
 * Exposes a typed event catalog so every call-site uses consistent
 * event names and property shapes. No freeform strings anywhere else.
 *
 * API key: set EXPO_PUBLIC_POSTHOG_API_KEY in .env
 * Host:    set EXPO_PUBLIC_POSTHOG_HOST  (defaults to PostHog Cloud)
 *
 * Usage:
 *   import { track } from '@/services/analytics';
 *   track('invite_shared', { method: 'copy' });
 */
import PostHog from 'posthog-react-native';

const API_KEY = process.env.EXPO_PUBLIC_POSTHOG_API_KEY ?? '';
const HOST = process.env.EXPO_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com';
const ENV = process.env.EXPO_PUBLIC_ENV ?? 'development';

// Singleton client — initialised once in app/_layout.tsx via initPostHog()
let _client: PostHog | null = null;

export function initPostHog(): PostHog | null {
  if (!API_KEY) return null;
  _client = new PostHog(API_KEY, {
    host: HOST,
    // Disable in dev unless key is explicitly set, to keep your data clean
    disabled: ENV === 'development' && !API_KEY,
    // Flush events every 30s or when 20 events accumulate
    flushInterval: 30000,
    flushAt: 20,
    // Don't capture device info that might be considered PII in some regions
    captureNativeAppLifecycleEvents: true,
  });
  return _client;
}

export function getPostHog(): PostHog | null {
  return _client;
}

// ─── Identity ─────────────────────────────────────────────────────────────────

/** Call after sign-in. userId is a UUID — no PII. */
export function identifyUser(userId: string, properties?: {
  plan?: string;
  created_at?: string;
}) {
  _client?.identify(userId, properties);
}

/** Call on sign-out. */
export function resetAnalytics() {
  _client?.reset();
}

// ─── Typed Event Catalog ──────────────────────────────────────────────────────

export type AnalyticsEvent =
  // Auth
  | { name: 'signed_up' }
  | { name: 'signed_in' }
  | { name: 'signed_out' }
  // Groups
  | { name: 'group_created' }
  | { name: 'group_joined'; properties: { method: 'invite_code' | 'direct' } }
  | { name: 'group_left' }
  | { name: 'group_deleted' }
  | { name: 'active_group_switched' }
  // Tracking
  | { name: 'go_dark_activated' }
  | { name: 'go_live_activated' }
  // Zones
  | { name: 'zone_created'; properties: { shape: 'circle' | 'polygon'; type: string; notify_arrival: boolean; notify_leave: boolean } }
  | { name: 'zone_deleted' }
  | { name: 'zone_entered'; properties: { zone_type: string } }
  | { name: 'zone_exited'; properties: { zone_type: string } }
  // Markers
  | { name: 'marker_placed'; properties: { marker_type: string } }
  | { name: 'marker_deleted' }
  // Invites
  | { name: 'invite_shared'; properties: { method: 'share_sheet' } }
  | { name: 'invite_page_viewed'; properties: { valid: boolean } }
  // SOS
  | { name: 'sos_triggered' }
  | { name: 'sos_cancelled' }
  // Sessions
  | { name: 'session_started' }
  | { name: 'session_ended'; properties: { duration_seconds: number } }
  // Safety
  | { name: 'checkin_timer_set'; properties: { minutes: number } }
  | { name: 'checkin_timer_missed' }
  | { name: 'rally_point_set' }
  // Subscription
  | { name: 'paywall_viewed'; properties: { feature: string } }
  | { name: 'subscription_started'; properties: { plan: string } };

/**
 * Track an analytics event with full type safety.
 *
 * @example
 * track({ name: 'zone_created', properties: { shape: 'circle', type: 'safe_zone', notify_arrival: true, notify_leave: false } });
 */
export function track(event: AnalyticsEvent) {
  if (!_client) return;
  const { name, ...rest } = event as any;
  _client.capture(name, rest.properties ?? {});
}

/** Track a screen view. Call in each screen's useEffect or via navigation listener. */
export function screen(name: string, properties?: Record<string, unknown>) {
  _client?.screen(name, properties);
}
