import React, { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { MapContainer } from '@/components/map/MapContainer';
import { SearchOverlay } from '@/components/map/SearchOverlay';
import { SharingConsentPrompt } from '@/components/map/SharingConsentPrompt';
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
import { JourneySheet } from '@/components/journey/JourneySheet';
import { JourneyOverduePrompt } from '@/components/journey/JourneyOverduePrompt';
import { JourneySummary } from '@/components/journey/JourneySummary';
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

  // A notification tap routes here with params describing what it was about.
  // Getting the user to the map is only half the job — without this the screen
  // opens showing wherever they happened to be looking, which for an SOS is
  // indistinguishable from the tap having done nothing.
  const params = useLocalSearchParams<{
    lat?: string; lng?: string; markerId?: string; zoneId?: string; focus?: string;
  }>();
  const goTo = useMapStore((st) => st.goTo);
  const handledFocus = useRef<string | null>(null);

  useEffect(() => {
    // One key per delivered notification, so re-renders do not re-fire the
    // camera move and fight the user for control of the map.
    const key = [params.focus, params.lat, params.lng, params.markerId, params.zoneId].join('|');
    if (key === '||||' || handledFocus.current === key) return;
    handledFocus.current = key;

    const lat = Number(params.lat);
    const lng = Number(params.lng);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      goTo({ latitude: lat, longitude: lng });
    }
    if (params.markerId) setSelectedFieldMarkerId(params.markerId);
  }, [params.focus, params.lat, params.lng, params.markerId, params.zoneId, goTo, setSelectedFieldMarkerId]);

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
      <JourneySheet />
      <JourneyOverduePrompt />
      <JourneySummary />
      <PlaceCard />
      <SearchOverlay />

      {/* One-time per-crew sharing decision. Sharing defaults to dark, so this
          makes the transition explicit instead of silently going dark. */}
      <SharingConsentPrompt />

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
