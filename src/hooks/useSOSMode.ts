/**
 * Silent SOS / Panic Pin — discreet emergency button.
 * Drops exact location, creates group event, sends push notifications.
 */
import { useCallback } from 'react';
import * as Haptics from 'expo-haptics';
import { useAuthStore } from '@/store/useAuthStore';
import { useGroupStore } from '@/store/useGroupStore';
import { useMapStore } from '@/store/useMapStore';
import { logEvent } from '@/services/groupEvents';
import { sendSOSNotification, sendSOSCancelNotification, sendLocalNotification } from '@/services/notifications';
import { fetchEmergencyContacts } from '@/services/emergencyContacts';
import { openSms, mapsLink } from '@/utils/contactActions';
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
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
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

    // Collect push tokens + user IDs of all group members
    const crewMembers = groupMembers.filter((m) => m.user_id !== userId && m.profile?.push_token);
    const tokens = crewMembers.map((m) => m.profile!.push_token as string);
    const userIds = crewMembers.map((m) => m.user_id);

    if (tokens.length > 0 && coords) {
      await sendSOSNotification(tokens, userName, coords, userIds);
    }

    // Text emergency contacts a pre-filled SOS message with a location link.
    try {
      const contacts = await fetchEmergencyContacts(userId);
      if (contacts.length > 0) {
        const loc = coords ? ` My location: ${mapsLink(coords.latitude, coords.longitude)}` : '';
        const med = [
          profile?.blood_type ? `Blood ${profile.blood_type}` : '',
          profile?.allergies ? `Allergies: ${profile.allergies}` : '',
          profile?.medications ? `Meds: ${profile.medications}` : '',
        ].filter(Boolean).join('; ');
        const medLine = med ? `\nMedical — ${med}` : '';
        await openSms(
          contacts.map((c) => c.phone_number),
          `🆘 SOS from ${userName}. I need help.${loc}${medLine}`,
        );
      }
    } catch {}

    // Local confirmation
    await sendLocalNotification(
      '🆘 SOS Activated',
      'Your location has been shared with your crew.',
      { type: 'sos' },
      'sos',
    );
  }, [userId, profile, activeGroupId, groupMembers, myLocation]);

  const dismissSOS = useCallback(async () => {
    track({ name: 'sos_cancelled' });

    const userName = profile?.nickname || profile?.display_name || 'A crew member';

    // Log cancellation event
    if (activeGroupId && userId) {
      await logEvent(
        activeGroupId,
        userId,
        'sos_cancelled',
        `✅ SOS Cancelled — ${userName}`,
        `${userName} cancelled their SOS alert.`,
        {},
      ).catch(console.error);
    }

    // Notify crew SOS is cancelled
    const cancelCrewMembers = groupMembers.filter((m) => m.user_id !== userId && m.profile?.push_token);
    const cancelTokens = cancelCrewMembers.map((m) => m.profile!.push_token as string);
    const cancelUserIds = cancelCrewMembers.map((m) => m.user_id);

    if (cancelTokens.length > 0) {
      await sendSOSCancelNotification(cancelTokens, userName, cancelUserIds).catch(console.error);
    }

    // Local confirmation
    await sendLocalNotification(
      '✅ SOS Cancelled',
      'Your crew has been notified that you are safe.',
      { type: 'sos_cancel' },
      'safety',
    ).catch(console.error);

    clearSOS();
  }, [clearSOS, userId, profile, activeGroupId, groupMembers]);

  return { triggerSOS, dismissSOS };
}
