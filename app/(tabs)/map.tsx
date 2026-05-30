import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { MapContainer } from '@/components/map/MapContainer';
import { SelfMarkerMenu } from '@/components/map/SelfMarkerMenu';
import { CrewMemberMenu } from '@/components/map/CrewMemberMenu';
import { MarkerDetailSheet } from '@/components/markers/MarkerDetailSheet';
import { ZoneDetailSheet } from '@/components/zones/ZoneDetailSheet';
import { TacticalHud } from '@/components/ui/TacticalHud';
import { SOSButton } from '@/components/ui/SOSButton';
import { NavigationDrawer } from '@/components/ui/NavigationDrawer';
import { ZoneCreationSheet } from '@/components/zones/ZoneCreationSheet';
import { useMapStore } from '@/store/useMapStore';
import { useLocationStore } from '@/store/useLocationStore';
import { useGroupStore } from '@/store/useGroupStore';
import { useAuthStore } from '@/store/useAuthStore';
import { useLocationTracker } from '@/hooks/useLocationTracker';
import { useRealtimeGroup } from '@/hooks/useRealtimeGroup';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useZonePresence } from '@/hooks/useZonePresence';
import { useTrailWriter } from '@/hooks/useTrailWriter';

export default function MapScreen() {
  const selectedMapUser = useMapStore((s) => s.selectedMapUser);
  const selectedFieldMarkerId = useMapStore((s) => s.selectedFieldMarkerId);
  const selectedSavedPlaceId = useMapStore((s) => s.selectedSavedPlaceId);
  const setSelectedMapUser = useMapStore((s) => s.setSelectedMapUser);
  const setSelectedFieldMarkerId = useMapStore((s) => s.setSelectedFieldMarkerId);
  const setSelectedSavedPlaceId = useMapStore((s) => s.setSelectedSavedPlaceId);

  // Boot all background systems
  useLocationTracker();
  useRealtimeGroup();
  usePushNotifications();
  useZonePresence();
  useTrailWriter();

  return (
    <View style={styles.container}>
      <MapContainer />

      {/* Tactical overlays */}
      <TacticalHud />
      <SOSButton />
      <NavigationDrawer />
      <ZoneCreationSheet />

      {/* Self menu */}
      <SelfMarkerMenu
        visible={selectedMapUser?.type === 'self'}
        onClose={() => setSelectedMapUser(null)}
      />

      {/* Crew menu */}
      {selectedMapUser?.type === 'crew' && (
        <CrewMemberMenu
          visible
          onClose={() => setSelectedMapUser(null)}
          userId={selectedMapUser.userId}
        />
      )}

      {/* Marker detail */}
      <MarkerDetailSheet
        visible={!!selectedFieldMarkerId}
        markerId={selectedFieldMarkerId}
        onClose={() => setSelectedFieldMarkerId(null)}
      />

      {/* Zone detail */}
      <ZoneDetailSheet
        visible={!!selectedSavedPlaceId}
        zoneId={selectedSavedPlaceId}
        onClose={() => setSelectedSavedPlaceId(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0f' },
});
