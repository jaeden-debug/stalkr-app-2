import { useEffect } from 'react';
import { registerPushToken, setupAndroidChannels } from '@/services/notifications';
import { useAuthStore } from '@/store/useAuthStore';

export function usePushNotifications() {
  const session = useAuthStore((s) => s.session);

  // Android notification channels must exist BEFORE the first notification is
  // delivered — Android ignores a channel that is created afterwards for
  // already-delivered notifications, and the importance of a channel cannot be
  // raised once the user has seen it.
  //
  // setupAndroidChannels() defined five channels and was never called from
  // anywhere, so every notification landed on the system default: SOS and zone
  // alerts lost their AndroidImportance.MAX heads-up behaviour, and users could
  // not mute crew activity separately from emergencies.
  //
  // Runs independently of auth: channels are a device-level concern and should
  // exist before the user has even signed in.
  useEffect(() => {
    setupAndroidChannels().catch((err) =>
      console.error('[notifications] channel setup failed:', err),
    );
  }, []);

  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId) return;
    registerPushToken(userId).catch(console.error);
  }, [session?.user?.id]);
}
