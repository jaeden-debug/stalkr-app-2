import React from 'react';
import { StyleSheet, View } from 'react-native';
import { MapContainer } from '@/components/map/MapContainer';
import { SearchOverlay } from '@/components/map/SearchOverlay';
import { PlaceCard } from '@/components/map/PlaceCard';
import { SelfMarkerMenu } from '@/components/map/SelfMarkerMenu';
import { CrewMemberMenu } from '@/components/map/CrewMemberMenu';
import { CheckInBadge } from '@/components/map/CheckInBadge';
import { MarkerDetailSheet } from '@/components/markers/MarkerDetailSheet';
import { ZoneDetailSheet } from '@/components/zones/ZoneDetailSheet';
import { TacticalHud } from '@/components/ui/TacticalHud';
import { SOSButton } from '@/components/ui/SOSButton';
import { NavigationDrawer } from '@/components/ui/NavigationDrawer';
import { ZoneCreationSheet } from '@/components/zones/ZoneCreationSheet';
import { SafetyCenter } from '@/components/safety/SafetyCenter';
import { MeasurePanel } from '@/components/map/MeasurePanel';
import { FilterSheet } from '@/components/map/FilterSheet';
import { useMapStore } from '@/store/useMapStore';
import { useLocationTracker } from '@/hooks/useLocationTracker';
import { useRealtimeGroup } from '@/hooks/useRealtimeGroup';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useZonePresence } from '@/hooks/useZonePresence';
import { useTrailWriter } from '@/hooks/useTrailWriter';

export default function MapScreen() {
  const selectedMapUser        = useMapStore((s) => s.selectedMapUser);
  const selectedFieldMarkerId  = useMapStore((s) => s.selectedFieldMarkerId);
  const selectedSavedPlaceId   = useMapStore((s) => s.selectedSavedPlaceId);
  const setSelectedMapUser     = useMapStore((s) => s.setSelectedMapUser);
  const setSelectedFieldMarkerId = useMapStore((s) => s.setSelectedFieldMarkerId);
  const setSelectedSavedPlaceId  = useMapStore((s) => s.setSelectedSavedPlaceId);

  useLocationTracker();
  useRealtimeGroup();
  usePushNotifications();
  useZonePresence();
  useTrailWriter();

  return (
    <View style={s.root}>
      <MapContainer />

      <TacticalHud />
      <SOSButton />
      <CheckInBadge />
      <NavigationDrawer />
      <ZoneCreationSheet />
      <SafetyCenter />
      <MeasurePanel />
      <FilterSheet />
      <PlaceCard />
      <SearchOverlay />

      <SelfMarkerMenu
        visible={selectedMapUser?.type === 'self'}
        onClose={() => setSelectedMapUser(null)}
      />

      {selectedMapUser?.type === 'crew' && (
        <CrewMemberMenu
          visible
          onClose={() => setSelectedMapUser(null)}
          userId={selectedMapUser.userId}
        />
      )}

      <MarkerDetailSheet
        visible={!!selectedFieldMarkerId}
        markerId={selectedFieldMarkerId}
        onClose={() => setSelectedFieldMarkerId(null)}
      />

      <ZoneDetailSheet
        visible={!!selectedSavedPlaceId}
        zoneId={selectedSavedPlaceId}
        onClose={() => setSelectedSavedPlaceId(null)}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#080808' },
});
