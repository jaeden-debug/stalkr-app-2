/**
 * TrailLayer — renders dotted trail polylines for visible users.
 * Only shown for users with trail visibility toggled on.
 */
import React, { memo } from 'react';
import { Polyline } from 'react-native-maps';
import { useMapStore } from '@/store/useMapStore';
import { getCrewColor } from '@/constants/map';
import { useAuthStore } from '@/store/useAuthStore';
import { MAP_Z_SHAPE } from '@/constants/mapLayers';

export const TrailLayer: React.FC = memo(() => {
  const userTrails = useMapStore((s) => s.userTrails);
  const visibleTrailUsers = useMapStore((s) => s.visibleTrailUsers);
  const showTrails = useMapStore((s) => s.showTrails);
  const myUserId = useAuthStore((s) => s.user?.id);

  const visibleEntries = showTrails
    ? Object.entries(userTrails).filter(([userId]) => visibleTrailUsers[userId])
    : [];

  return (
    <>
      {visibleEntries.map(([userId, points]) => {
        if (points.length < 2) return null;
        const color = userId === myUserId ? '#22c55e' : getCrewColor(userId);
        return (
          <Polyline
            key={userId}
            coordinates={points}
            strokeColor={`${color}cc`}
            strokeWidth={3}
            lineDashPattern={[6, 6]}
            zIndex={MAP_Z_SHAPE.TRAIL}
          />
        );
      })}
    </>
  );
});
