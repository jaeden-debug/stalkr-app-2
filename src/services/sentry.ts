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

const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN ?? '';
const ENV = process.env.EXPO_PUBLIC_ENV ?? 'development';

export function initSentry() {
  if (!DSN) return; // Skip in local dev if DSN not set

  Sentry.init({
    dsn: DSN,
    environment: ENV,
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
      // Strip any PII from user data before sending
      if (event.user) {
        delete event.user.email;
        delete event.user.username;
      }
      return event;
    },
  });
}

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
