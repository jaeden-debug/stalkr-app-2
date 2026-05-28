/**
 * MapControls — the HUD overlaid on the map.
 * Center button, satellite toggle, group indicator, SOS button.
 */
import React, { memo } from 'react';
import { SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useMapStore } from '@/store/useMapStore';
import { useGroupStore } from '@/store/useGroupStore';
import { FEATURES } from '@/config/features';
import type { RefObject } from 'react';
import type MapView from 'react-native-maps';

interface MapControlsProps {
  mapRef: RefObject<MapView>;
}

export const MapControls: React.FC<MapControlsProps> = memo(({ mapRef }) => {
  const isSatellite = useMapStore((s) => s.isSatellite);
  const toggleSatellite = useMapStore((s) => s.toggleSatellite);
  const triggerCenterMap = useMapStore((s) => s.triggerCenterMap);
  const placingMarker = useMapStore((s) => s.placingMarker);
  const placingPolygon = useMapStore((s) => s.placingPolygonZone);
  const placingZone = useMapStore((s) => s.placingCircleZone);
  const polygonDraftPoints = useMapStore((s) => s.polygonDraftPoints);
  const finishPolygon = useMapStore((s) => s.finishPolygonZone);
  const cancelAll = useMapStore((s) => s.cancelZonePlacement);
  const cancelMarker = useMapStore((s) => s.cancelMarkerPlacement);

  // activeGroup is a derived getter on the store
  const activeGroupId = useGroupStore((s) => s.activeGroupId);
  const groups = useGroupStore((s) => s.groups);
  const activeGroup = groups.find((g) => g.id === activeGroupId) ?? null;

  const isPlacingAnything = placingMarker || placingZone || placingPolygon;

  const handleCancel = () => {
    cancelMarker();
    cancelAll();
  };

  return (
    <SafeAreaView style={styles.overlay} pointerEvents="box-none">
      {/* Active group chip */}
      {activeGroup && (
        <View style={styles.groupChip}>
          <View style={styles.liveDot} />
          <Text style={styles.groupName} numberOfLines={1}>
            {activeGroup.name}
          </Text>
        </View>
      )}

      {/* Placement banner */}
      {isPlacingAnything && (
        <View style={styles.placementBanner}>
          <Text style={styles.placementText}>
            {placingMarker
              ? '📍 Tap map to place marker'
              : placingPolygon
              ? `📐 Tap to add point (${polygonDraftPoints.length} placed)`
              : '🎯 Tap map to place zone center'}
          </Text>
          <View style={styles.placementActions}>
            {placingPolygon && polygonDraftPoints.length >= 3 && (
              <TouchableOpacity style={styles.finishBtn} onPress={finishPolygon}>
                <Text style={styles.finishBtnText}>Finish</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Right-side controls */}
      <View style={styles.rightControls}>
        <TouchableOpacity style={styles.controlBtn} onPress={triggerCenterMap} activeOpacity={0.8}>
          <Text style={styles.controlIcon}>⊕</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.controlBtn, isSatellite && styles.controlBtnActive]}
          onPress={toggleSatellite}
          activeOpacity={0.8}
        >
          <Text style={styles.controlIcon}>🛰</Text>
        </TouchableOpacity>
      </View>

      {/* SOS button */}
      {FEATURES.SOS_MODE && (
        <TouchableOpacity
          style={styles.sosBtn}
          onLongPress={() => useMapStore.getState().triggerSOSMode()}
          delayLongPress={1500}
          activeOpacity={0.8}
        >
          <Text style={styles.sosText}>SOS</Text>
          <Text style={styles.sosHint}>Hold</Text>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
});

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, pointerEvents: 'box-none' },
  groupChip: {
    position: 'absolute',
    top: 52,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(10,10,15,0.85)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    gap: 8,
    borderWidth: 1,
    borderColor: '#2a2a3a',
  },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#22c55e' },
  groupName: { color: '#e8e8f0', fontSize: 13, fontWeight: '600', maxWidth: 200 },
  placementBanner: {
    position: 'absolute',
    top: 90,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(10,10,15,0.92)',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#22c55e',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  placementText: { color: '#e8e8f0', fontSize: 13, fontWeight: '600', flex: 1 },
  placementActions: { flexDirection: 'row', gap: 8 },
  finishBtn: { backgroundColor: '#22c55e', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8 },
  finishBtnText: { color: '#000', fontWeight: '700', fontSize: 13 },
  cancelBtn: { backgroundColor: '#2a2a3a', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8 },
  cancelBtnText: { color: '#e8e8f0', fontWeight: '600', fontSize: 13 },
  rightControls: { position: 'absolute', right: 16, bottom: 160, gap: 10 },
  controlBtn: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: 'rgba(10,10,15,0.9)',
    borderWidth: 1, borderColor: '#2a2a3a',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4, shadowRadius: 4, elevation: 4,
  },
  controlBtnActive: { borderColor: '#22c55e', backgroundColor: 'rgba(34,197,94,0.15)' },
  controlIcon: { fontSize: 20 },
  sosBtn: {
    position: 'absolute', bottom: 160, left: 16,
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: 'rgba(239,68,68,0.9)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#ef4444',
    shadowColor: '#ef4444', shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5, shadowRadius: 8, elevation: 8,
  },
  sosText: { color: '#fff', fontWeight: '800', fontSize: 14, letterSpacing: 1 },
  sosHint: { color: 'rgba(255,255,255,0.6)', fontSize: 9, letterSpacing: 0.5 },
});
