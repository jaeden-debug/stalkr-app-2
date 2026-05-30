/**
 * Silent SOS / Panic Pin — discreet emergency button.
 * Drops exact location, creates group event, sends push notifications.
 */
import { useCallback } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { useGroupStore } from '@/store/useGroupStore';
import { useMapStore } from '@/store/useMapStore';
import { logEvent } from '@/services/groupEvents';
import { sendSOSNotification, sendLocalNotification } from '@/services/notifications';
import { supabase } from '@/services/supabase';
import { FEATURES } from '@/config/features';
import { track } from '@/services/analytics';

export function useSOSMode() {
  const userId = useAuthStore((s) => s.user?.id);
  const profile = useAuthStore((s) => s.profile);
  const activeGroupId = useGroupStore((s) => s.activeGroupId);
  const groupMembers = useGroupStore((s) => s.groupMembers);
  const myLocation = useMapStore((s) => s.myLocation);
  const clearSOS = useMapStore((s) => s.clearSOSMode);

  const triggerSOS = useCallback(async () => {
    if (!FEATURES.SOS_MODE || !userId) return;
    track({ name: 'sos_triggered' });

    const coords = myLocation
      ? { latitude: myLocation.latitude, longitude: myLocation.longitude }
      : null;

    const userName = profile?.nickname || profile?.display_name || 'A crew member';

    // Log group event
    if (activeGroupId) {
      await logEvent(
        activeGroupId,
        userId,
        'sos_triggered',
        `🆘 SOS — ${userName}`,
        coords
          ? `${userName} activated SOS at ${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`
          : `${userName} activated SOS.`,
        { latitude: coords?.latitude, longitude: coords?.longitude },
      );
    }

    // Collect push tokens of all group members (admins/owners priority)
    const tokens = groupMembers
      .filter((m) => m.user_id !== userId)
      .map((m) => m.profile?.push_token)
      .filter(Boolean) as string[];

    if (tokens.length > 0 && coords) {
      await sendSOSNotification(tokens, userName, coords);
    }

    // Local confirmation
    await sendLocalNotification(
      '🆘 SOS Activated',
      'Your location has been shared with your crew.',
      { type: 'sos' },
      'sos',
    );
  }, [userId, profile, activeGroupId, groupMembers, myLocation]);

  const dismissSOS = useCallback(() => {
    track({ name: 'sos_cancelled' });
    clearSOS();
  }, [clearSOS]);

  return { triggerSOS, dismissSOS };
}
