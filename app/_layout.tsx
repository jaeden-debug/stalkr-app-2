import '../global.css';
import 'react-native-url-polyfill/auto';

import { Stack, useNavigationContainerRef } from 'expo-router';
import { useEffect } from 'react';
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
