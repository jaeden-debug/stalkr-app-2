import '../global.css';
import 'react-native-url-polyfill/auto';

import { Stack, useNavigationContainerRef } from 'expo-router';
import { useEffect, useRef } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Sentry from '@sentry/react-native';
import { PostHogProvider } from 'posthog-react-native';
import { ToastProvider } from '@/components/ui/Toast';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { useAuthStore } from '@/store/useAuthStore';
import { useBillingStore } from '@/store/useBillingStore';
import { useGroupStore } from '@/store/useGroupStore';
import { loadNotificationPrefs } from '@/store/useNotificationStore';
import { useCrewPrefsStore } from '@/store/useCrewPrefsStore';
import { useSafetyStore } from '@/store/useSafetyStore';
import { initSentry, setSentryUser, clearSentryUser } from '@/services/sentry';
import { initPostHog, identifyUser, resetAnalytics } from '@/services/analytics';

// ── Initialise Sentry as early as possible (before any render) ────────────────
initSentry();

const posthogClient = initPostHog();

function RootLayoutInner() {
  const initialize = useAuthStore((s) => s.initialize);
  const loadEntitlement = useBillingStore((s) => s.loadEntitlement);
  const user = useAuthStore((s) => s.user);
  const loadGroups = useGroupStore((s) => s.loadGroups);
  const loadGroupMembers = useGroupStore((s) => s.loadGroupMembers);
  const activeGroupId = useGroupStore((s) => s.activeGroupId);

  // Bootstrap auth + billing on mount
  useEffect(() => {
    initialize().then(async () => {
      // Re-derive plan/admin AFTER the session is restored, so admin@zylx.ai is
      // recognized on a cold launch (no race with an empty session).
      loadEntitlement();
      await loadGroups();
      const gid = useGroupStore.getState().activeGroupId;
      if (gid) loadGroupMembers(gid);
      // Hydrate notification prefs from DB so settings are consistent across devices
      loadNotificationPrefs().catch(console.error);
      const uid = useAuthStore.getState().user?.id;
      if (uid) {
        useCrewPrefsStore.getState().hydrate(uid).catch(() => {});
        useSafetyStore.getState().loadActive(uid).catch(() => {});
      }
    });
    loadEntitlement();
  }, []);

  // ── Account switch / sign-in / sign-out ─────────────────────────────────────
  // The bootstrap effect above only runs once on mount, so when the signed-in
  // user CHANGES at runtime we must purge the previous account's per-user state
  // and reload fresh — otherwise the new account sees old crews and the admin /
  // plan entitlement never refreshes (paywall stays on for admin@zylx.ai).
  const prevUserId = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    const uid = user?.id ?? null;
    if (prevUserId.current === undefined) { prevUserId.current = uid; return; } // bootstrap handles first run
    if (prevUserId.current === uid) return;
    prevUserId.current = uid;

    (async () => {
      const { resetUserScopedState } = await import('@/store/resetUserScopedState');
      await resetUserScopedState();
      loadEntitlement(); // re-derive plan / admin for the new account
      if (uid) {
        await loadGroups();
        const gid = useGroupStore.getState().activeGroupId;
        if (gid) loadGroupMembers(gid);
        useCrewPrefsStore.getState().hydrate(uid).catch(() => {});
        useSafetyStore.getState().loadActive(uid).catch(() => {});
      }
    })();
  }, [user?.id]);

  // Keep Sentry + PostHog identity in sync with auth state
  useEffect(() => {
    if (user?.id) {
      setSentryUser(user.id);
      identifyUser(user.id);
    } else {
      clearSentryUser();
      resetAnalytics();
    }
  }, [user?.id]);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#0a0a0f' },
        animation: 'fade',
      }}
    />
  );
}

function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ErrorBoundary>
          <ToastProvider>
            {posthogClient ? (
              <PostHogProvider client={posthogClient} autocapture>
                <RootLayoutInner />
              </PostHogProvider>
            ) : (
              <RootLayoutInner />
            )}
          </ToastProvider>
        </ErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

// Wrap the root with Sentry's error boundary + navigation instrumentation
export default Sentry.wrap(RootLayout);
