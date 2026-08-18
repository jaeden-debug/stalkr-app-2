/**
 * Wires notification taps to navigation.
 *
 * Two paths matter, and missing either one makes taps feel broken:
 *   - WARM: the app is running (foreground or background) and the listener
 *     fires.
 *   - COLD: the app was fully terminated and the tap is what launched it. No
 *     listener exists yet at that moment, so the response must be fetched
 *     explicitly — this is the case people hit most, because urgent
 *     notifications usually arrive when the app is closed.
 *
 * Navigation waits until the router is actually mounted. Pushing a route during
 * the first render of a cold start silently does nothing, which looks exactly
 * like the bug this hook exists to fix.
 */
import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { useRouter, useRootNavigationState } from 'expo-router';
import { routeForNotification, type NotificationData } from '@/services/notificationRouter';

export function useNotificationRouter(): void {
  const router = useRouter();
  const navState = useRootNavigationState();
  const isReady = Boolean(navState?.key);

  /** A tap that arrived before navigation was ready, replayed once it is. */
  const pending = useRef<NotificationData | null>(null);
  /** Guards against handling the same cold-start response twice. */
  const handledColdStart = useRef(false);

  useEffect(() => {
    const go = (data: NotificationData | null | undefined) => {
      if (!isReady) {
        pending.current = data ?? null;
        return;
      }
      const target = routeForNotification(data);
      // No target is a legitimate outcome: opening the app is the whole
      // response to an informational notice.
      if (!target) return;
      try {
        router.push({ pathname: target.pathname as never, params: target.params as never });
      } catch {
        // A navigation failure must never surface as a crash from a background
        // tap. The app is already open, which is most of what the user wanted.
      }
    };

    // COLD start.
    if (!handledColdStart.current) {
      handledColdStart.current = true;
      Notifications.getLastNotificationResponseAsync()
        .then((res) => {
          const data = res?.notification?.request?.content?.data as NotificationData | undefined;
          if (data) go(data);
        })
        .catch(() => {});
    }

    // WARM taps.
    const sub = Notifications.addNotificationResponseReceivedListener((res) => {
      go(res?.notification?.request?.content?.data as NotificationData | undefined);
    });

    // Replay anything that arrived before navigation was ready.
    if (isReady && pending.current) {
      const data = pending.current;
      pending.current = null;
      go(data);
    }

    return () => sub.remove();
  }, [isReady, router]);
}
