/**
 * PlaceCard — shown when a place has been picked from search
 * (useMapStore.searchedPlace). Lets the user act on that destination:
 *   • Start Journey  → pre-fills the New Journey sheet (sessions screen)
 *   • Save as Zone   → starts a circle-zone draft centered here (size + confirm)
 *   • Drop Marker    → drops a waypoint here
 *   • Clear          → dismiss
 *
 * Picking a place never starts anything on its own — the user chooses here.
 */
import React from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useMapStore } from '@/store/useMapStore';
import { useGroupStore } from '@/store/useGroupStore';
import { useSessionStore } from '@/store/useSessionStore';
import { getDistance, formatDistanceBoth } from '@/utils/distance';
import { C } from '@/constants/theme';

export const PlaceCard: React.FC = () => {
  const router = useRouter();
  const place = useMapStore((s) => s.searchedPlace);
  const myLocation = useMapStore((s) => s.myLocation);
  const clearSearchedPlace = useMapStore((s) => s.clearSearchedPlace);
  const startCircleZoneAt = useMapStore((s) => s.startCircleZoneAt);
  const activeGroupId = useGroupStore((s) => s.activeGroupId);
  const setJourneyDraft = useSessionStore((s) => s.setJourneyDraft);

  if (!place) return null;

  const dist = myLocation
    ? formatDistanceBoth(getDistance(myLocation, { latitude: place.latitude, longitude: place.longitude }))
    : null;

  const requireCrew = (): boolean => {
    if (!activeGroupId) {
      Alert.alert('NO ACTIVE CREW', 'Select or create a crew before placing zones or markers.');
      return false;
    }
    return true;
  };

  const handleStartJourney = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    useSessionStore.getState().openJourneySheet({
      destinationName: place.name,
      destinationAddress: place.address,
      destinationLat: place.latitude,
      destinationLng: place.longitude,
    });
    clearSearchedPlace();
  };

  const handleSaveZone = () => {
    if (!requireCrew()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Starts a circle draft here; the bottom toolbar handles size → confirm,
    // and the zone can be long-press dragged/edited afterward.
    startCircleZoneAt({ latitude: place.latitude, longitude: place.longitude });
  };

  const handleDropMarker = async () => {
    if (!requireCrew()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const coords = { latitude: place.latitude, longitude: place.longitude };
    clearSearchedPlace();
    await useMapStore.getState().placeMarker(coords);
  };

  return (
    <SafeAreaView style={s.overlay} pointerEvents="box-none" edges={['bottom']}>
      <View style={s.card}>
        <View style={s.headerRow}>
          <View style={s.pin}>
            <Ionicons name="location" size={18} color={C.green} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.name} numberOfLines={1}>{place.name}</Text>
            {!!place.address && <Text style={s.address} numberOfLines={1}>{place.address}</Text>}
            {dist && <Text style={s.dist}>{dist} away</Text>}
          </View>
          <TouchableOpacity style={s.closeBtn} onPress={clearSearchedPlace} activeOpacity={0.8} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close" size={18} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={s.primaryBtn} onPress={handleStartJourney} activeOpacity={0.85}>
          <Ionicons name="navigate" size={16} color="#000" />
          <Text style={s.primaryText}>START JOURNEY</Text>
        </TouchableOpacity>

        <View style={s.secondaryRow}>
          {/* SAVE ZONE removed for now — circle zones are disabled (coming soon). */}
          <TouchableOpacity style={s.secondaryBtn} onPress={handleDropMarker} activeOpacity={0.85}>
            <Ionicons name="pin" size={15} color={C.green} />
            <Text style={s.secondaryText}>DROP MARKER</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

const s = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFill, justifyContent: 'flex-end', pointerEvents: 'box-none' } as any,
  card: {
    marginHorizontal: 14,
    marginBottom: 134, // sit above the collapsed nav drawer peek
    backgroundColor: 'rgba(10,10,16,0.97)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    padding: 16,
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 14,
    elevation: 10,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  pin: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: C.greenDim, borderWidth: 1, borderColor: C.greenBorder,
    alignItems: 'center', justifyContent: 'center',
  },
  name: { color: '#FFFFFF', fontSize: 16, fontWeight: '900', letterSpacing: 0.3 },
  address: { color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 2 },
  dist: { color: C.green, fontSize: 11, fontWeight: '800', letterSpacing: 0.5, marginTop: 3 },
  closeBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: C.green, borderRadius: 14, paddingVertical: 15,
  },
  primaryText: { color: '#000', fontWeight: '900', fontSize: 13, letterSpacing: 1 },
  secondaryRow: { flexDirection: 'row', gap: 12 },
  secondaryBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    paddingVertical: 13, borderRadius: 14,
    borderWidth: 1.5, borderColor: C.greenBorder, backgroundColor: C.greenDim,
  },
  secondaryText: { color: C.green, fontWeight: '900', fontSize: 11, letterSpacing: 0.8 },
});
