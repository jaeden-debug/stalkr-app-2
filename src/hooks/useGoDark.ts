/**
 * useGoDark — Go Dark / Stealth mode toggle.
 *
 * "Go Dark" = stop broadcasting location to crew (isBroadcasting = false).
 * "Go Live"  = resume broadcasting (isBroadcasting = true).
 *
 * Enforcement: if the active group has tracking_mode = 'enforced' and the
 * current user is not an owner, the toggle is blocked.
 *
 * Supabase: useLocationTracker already watches isBroadcasting and calls
 * setLocationOffline when it flips false — no direct DB write needed here.
 *
 * Returns:
 *   isDark         — true when location is hidden from crew
 *   isEnforced     — true when group enforces tracking (non-owners cannot go dark)
 *   isLoading      — true while toggling
 *   toggle()       — flip the state; shows Alert if enforced
 */
import { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import { useLocationStore } from '@/store/useLocationStore';
import { useGroupStore } from '@/store/useGroupStore';
import { useAuthStore } from '@/store/useAuthStore';
import { isDarkForCrew } from '@/utils/broadcast';
import { logEvent } from '@/services/groupEvents';
import { sendLocalNotification } from '@/services/notifications';

export function useGoDark() {
  const groupBroadcastingStatus = useLocationStore((s) => s.groupBroadcastingStatus);
  const setIsBroadcasting = useLocationStore((s) => s.setIsBroadcasting);
  const setGroupBroadcasting = useLocationStore((s) => s.setGroupBroadcasting);

  const activeGroupId = useGroupStore((s) => s.activeGroupId);
  const groups = useGroupStore((s) => s.groups);
  const groupMembers = useGroupStore((s) => s.groupMembers);
  const userId = useAuthStore((s) => s.user?.id);
  const profile = useAuthStore((s) => s.profile);

  const [isLoading, setIsLoading] = useState(false);

  const activeGroup = groups.find((g) => g.id === activeGroupId) ?? null;

  // Enforced tracking applies to EVERYONE in the crew — including the owner.
  // (The owner turns enforcement off in crew settings, not via go-dark.)
  const isEnforced = activeGroup?.tracking_mode === 'enforced';

  // Per-crew, matching what the tracker actually does. Reading the global flag
  // here meant going dark in crew A made crew B *look* dark too, while B kept
  // broadcasting.
  const isDark = isDarkForCrew(groupBroadcastingStatus, activeGroupId, { enforced: isEnforced });
  const isBroadcasting = !isDark;

  const toggle = useCallback(async () => {
    if (!activeGroupId) {
      Alert.alert('NO ACTIVE CREW', 'Join or create a crew first.');
      return;
    }

    if (isEnforced) {
      Alert.alert(
        'TRACKING ENFORCED',
        'This crew enforces tracking — everyone stays live, including the owner. Turn off enforced tracking in crew settings to allow Go Dark.',
      );
      return;
    }

    setIsLoading(true);
    try {
      const newVal = !isBroadcasting;
      // Flip — useLocationTracker handles the Supabase write automatically
      setIsBroadcasting(newVal);
      if (activeGroupId) setGroupBroadcasting(activeGroupId, newVal);

      // Notify the crew (realtime group_events) + a confirmation to yourself.
      const name = profile?.nickname || profile?.display_name || 'A crew member';
      if (userId) {
        logEvent(
          activeGroupId,
          userId,
          newVal ? 'member_online' : 'member_offline',
          newVal ? `${name} started broadcasting` : `${name} stopped broadcasting`,
          undefined,
        ).catch(() => {});
      }
      sendLocalNotification(
        newVal ? 'You went live' : 'You went dark',
        newVal ? 'You are now broadcasting your location to this crew.' : 'You stopped broadcasting your location to this crew.',
        { type: 'general' },
      ).catch(() => {});
    } finally {
      setIsLoading(false);
    }
  }, [activeGroupId, isBroadcasting, isEnforced, setIsBroadcasting, setGroupBroadcasting, profile, userId]);

  return { isDark, isEnforced, isLoading, toggle };
}
