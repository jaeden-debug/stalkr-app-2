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

export function useGoDark() {
  const isBroadcasting = useLocationStore((s) => s.isBroadcasting);
  const setIsBroadcasting = useLocationStore((s) => s.setIsBroadcasting);
  const setGroupBroadcasting = useLocationStore((s) => s.setGroupBroadcasting);

  const activeGroupId = useGroupStore((s) => s.activeGroupId);
  const groups = useGroupStore((s) => s.groups);
  const groupMembers = useGroupStore((s) => s.groupMembers);
  const userId = useAuthStore((s) => s.user?.id);

  const [isLoading, setIsLoading] = useState(false);

  const activeGroup = groups.find((g) => g.id === activeGroupId) ?? null;

  // Determine if tracking is enforced for this user
  const myMember = groupMembers.find((m) => m.user_id === userId);
  const myRole = myMember?.role ?? activeGroup?.member_role ?? 'member';
  const isEnforced =
    activeGroup?.tracking_mode === 'enforced' && myRole !== 'owner';

  const isDark = !isBroadcasting;

  const toggle = useCallback(async () => {
    if (!activeGroupId) {
      Alert.alert('NO ACTIVE CREW', 'Join or create a crew first.');
      return;
    }

    if (isEnforced) {
      Alert.alert(
        'TRACKING ENFORCED',
        'Tracking is enforced by this crew owner. You cannot go dark.',
      );
      return;
    }

    setIsLoading(true);
    try {
      const newVal = !isBroadcasting;
      // Flip — useLocationTracker handles the Supabase write automatically
      setIsBroadcasting(newVal);
      // Persist per-group state
      if (activeGroupId) {
        setGroupBroadcasting(activeGroupId, newVal);
      }
    } finally {
      setIsLoading(false);
    }
  }, [activeGroupId, isBroadcasting, isEnforced, setIsBroadcasting, setGroupBroadcasting]);

  return { isDark, isEnforced, isLoading, toggle };
}
