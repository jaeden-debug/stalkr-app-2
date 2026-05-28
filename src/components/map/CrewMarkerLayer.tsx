/**
 * CrewMarkerLayer — renders all crew member markers.
 * Only rerenders when crewLocations changes, not when self moves.
 */
import React, { memo } from 'react';
import { useMapStore } from '@/store/useMapStore';
import { CrewMarker } from './CrewMarker';

interface CrewMarkerLayerProps {
  myUserId: string;
}

export const CrewMarkerLayer: React.FC<CrewMarkerLayerProps> = memo(({ myUserId }) => {
  const crewLocations = useMapStore((s) => s.crewLocations);

  return (
    <>
      {Object.values(crewLocations)
        .filter((loc) => loc.user_id !== myUserId)
        .map((loc) => (
          <CrewMarker key={loc.user_id} location={loc} />
        ))}
    </>
  );
});
