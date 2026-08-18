/**
 * Sentry crash reporting
 *
 * Init once in app/_layout.tsx via initSentry().
 * Use captureError() anywhere in the app to log caught exceptions.
 * Use setSentryUser() after auth so crashes are tied to a user ID.
 *
 * DSN: set EXPO_PUBLIC_SENTRY_DSN in .env
 * Source maps: add @sentry/react-native to app.config plugins (see below).
 */
import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import * as Application from 'expo-application';

const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN ?? '';

/**
 * Environment tag.
 *
 * A TestFlight build and an App Store build are both EXPO_PUBLIC_ENV=production
 * but need different alerting — a first-occurrence error in TestFlight is worth
 * knowing about immediately, the same error in production is triage. Apple ships
 * a `sandboxReceipt` to TestFlight installs, which is how they are told apart.
 */
function resolveEnvironment(): string {
  const base = process.env.EXPO_PUBLIC_ENV ?? 'development';
  if (base !== 'production') return base;
  if (Platform.OS === 'ios') {
    const url = (Application as any).applicationReleaseType;
    // expo-application exposes the release type on newer SDKs; fall back to
    // production rather than guessing when it is unavailable.
    if (url === 'SIMULATOR' || url === 'AD_HOC' || url === 'ENTERPRISE') return 'testflight';
  }
  return base;
}

const ENV = resolveEnvironment();

/**
 * Release identity. Without this a stack trace cannot be matched to the code
 * that was actually running, and an incident can send someone debugging a file
 * that is not on the affected phone.
 */
const APP_VERSION = Constants.expoConfig?.version ?? '0.0.0';
const BUILD_NUMBER =
  Application.nativeBuildVersion ??
  (Constants.expoConfig as any)?.ios?.buildNumber ??
  'unknown';
const RELEASE = `stalkr@${APP_VERSION}+${BUILD_NUMBER}`;

export function initSentry() {
  if (!DSN) return; // Skip in local dev if DSN not set

  Sentry.init({
    dsn: DSN,
    environment: ENV,
    // Ties every event to a specific build. `dist` is what lets Sentry pick the
    // right source map when two builds share a version string.
    release: RELEASE,
    dist: String(BUILD_NUMBER),
    // Capture 100% of transactions in dev/preview; 10% in production
    tracesSampleRate: ENV === 'production' ? 0.1 : 1.0,
    // Capture 20% of sessions for session replay in production
    replaysSessionSampleRate: ENV === 'production' ? 0.2 : 0,
    replaysOnErrorSampleRate: 1.0,
    enabled: ENV !== 'development' || !!DSN,
    debug: false,
    // Attach breadcrumbs for navigation, console, and network requests
    integrations: [
      Sentry.reactNativeTracingIntegration(),
    ],
    beforeSend(event) {
      // Privacy scrubbing. STALKR handles location and contacts, so an event
      // must never carry anything that identifies a person or a place.
      if (event.user) {
        delete event.user.email;
        delete event.user.username;
        delete event.user.ip_address;
      }
      return scrubSensitive(event);
    },
    beforeBreadcrumb(crumb) {
      // Console breadcrumbs can capture logged objects wholesale, which is how
      // coordinates and phone numbers leak into an error report.
      if (crumb.category === 'console') return null;
      if (crumb.data) crumb.data = scrubValue(crumb.data) as Record<string, unknown>;
      return crumb;
    },
  });
}

/**
 * Keys whose values must never reach Sentry.
 *
 * Coordinates are the important ones: an error report that carries a user's
 * exact position defeats the point of a privacy-respecting location app, and
 * would sit in a third-party system indefinitely.
 */
const SENSITIVE_KEY = /(latitude|longitude|lat|lng|coord|phone|email|token|password|secret|api[-_]?key|authorization|address)/i;

function scrubValue(value: unknown, depth = 0): unknown {
  if (depth > 6 || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((v) => scrubValue(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = SENSITIVE_KEY.test(k) ? '[redacted]' : scrubValue(v, depth + 1);
  }
  return out;
}

function scrubSensitive<T>(event: T): T {
  const e = event as unknown as Record<string, unknown>;
  if (e.extra) e.extra = scrubValue(e.extra);
  if (e.contexts) e.contexts = scrubValue(e.contexts);
  if (e.request) e.request = scrubValue(e.request);
  return event;
}

/** Release string for correlating an incident with the exact build. */
export const SENTRY_RELEASE = RELEASE;
export const SENTRY_ENVIRONMENT = ENV;

/** Call after sign-in — ties crashes to user ID (no PII). */
export function setSentryUser(userId: string) {
  Sentry.setUser({ id: userId });
}

/** Call on sign-out. */
export function clearSentryUser() {
  Sentry.setUser(null);
}

/** Manually capture a caught error with optional context. */
export function captureError(error: unknown, context?: Record<string, unknown>) {
  if (context) {
    Sentry.withScope((scope) => {
      scope.setExtras(context);
      Sentry.captureException(error);
    });
  } else {
    Sentry.captureException(error);
  }
}

/** Add a breadcrumb for important non-error events. */
export function addBreadcrumb(message: string, data?: Record<string, unknown>) {
  Sentry.addBreadcrumb({ message, data, level: 'info' });
}

export { Sentry };
