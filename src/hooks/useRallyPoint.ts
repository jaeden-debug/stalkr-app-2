/**
 * Rally Point Mode — group owner/admin sets a rally point.
 * All members see distance and bearing to it.
 */
import { useEffect, useCallback } from 'react';
import { useGroupStore } from '@/store/useGroupStore';
import { useMapStore } from '@/store/useMapStore';
import { useAuthStore } from '@/store/useAuthStore';
import { fetchActiveRallyPoint, setRallyPoint, clearRallyPoint } from '@/services/rallyPoints';
import { getDistance, getBearing } from '@/utils/distance';
import { FEATURES } from '@/config/features';

export function useRallyPoint() {
  const activeGroupId = useGroupStore((s) => s.activeGroupId);
  const myLocation = useMapStore((s) => s.myLocation);
  const activeRallyPoint = useMapStore((s) => s.activeRallyPoint);
  const setActiveRallyPoint = useMapStore((s) => s.setActiveRallyPoint);
  const userId = useAuthStore((s) => s.user?.id);
  const myRole = useGroupStore((s) => s.groupMembers.find((m) => m.user_id === userId)?.role);

  useEffect(() => {
    if (!FEATURES.RALLY_POINTS || !activeGroupId) return;
    fetchActiveRallyPoint(activeGroupId).then(setActiveRallyPoint).catch(() => {});
  }, [activeGroupId]);

  const distanceAndBearing = (() => {
    if (!myLocation || !activeRallyPoint) return null;
    const a = { latitude: myLocation.latitude, longitude: myLocation.longitude };
    const b = { latitude: activeRallyPoint.latitude, longitude: activeRallyPoint.longitude };
    return { distance: getDistance(a, b), bearing: getBearing(a, b) };
  })();

  const setRally = useCallback(
    async (name: string, latitude: number, longitude: number) => {
      if (!FEATURES.RALLY_POINTS || !userId || !activeGroupId) return null;
      const point = await setRallyPoint(activeGroupId, userId, name, latitude, longitude);
      if (point) setActiveRallyPoint(point);
      return point;
    },
    [userId, activeGroupId],
  );

  const clearRally = useCallback(async () => {
    if (!activeGroupId) return;
    await clearRallyPoint(activeGroupId);
    setActiveRallyPoint(null);
  }, [activeGroupId]);

  const canManage = myRole === 'owner' || myRole === 'admin';

  return { activeRallyPoint, distanceAndBearing, setRally, clearRally, canManage };
}
