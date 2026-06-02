/**
 * MapControls — placement-mode banner only.
 * All other HUD controls (center, satellite, group chip, SOS) live in
 * TacticalHud and SOSButton, which sit above MapContainer in map.tsx.
 */
import React, { memo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMapStore } from '@/store/useMapStore';

export const MapControls: React.FC = memo(() => {
  const placingMarker = useMapStore((s) => s.placingMarker);
  const placingPolygon = useMapStore((s) => s.placingPolygonZone);
  const placingZone = useMapStore((s) => s.placingCircleZone);
  const polygonDraftPoints = useMapStore((s) => s.polygonDraftPoints);
  const finishPolygon = useMapStore((s) => s.finishPolygonZone);
  const removeLastPolygonPoint = useMapStore((s) => s.removeLastPolygonPoint);
  const cancelMarker = useMapStore((s) => s.cancelMarkerPlacement);
  const cancelZone = useMapStore((s) => s.cancelZonePlacement);

  const isPlacing = placingMarker || placingZone || placingPolygon;
  if (!isPlacing) return null;

  const handleCancel = () => {
    cancelMarker();
    cancelZone();
  };

  const bannerText = placingMarker
    ? '📍 Tap map to place marker'
    : placingPolygon
    ? `📐 Tap to add point  (${polygonDraftPoints.length} placed)`
    : '🎯 Tap map to place zone center';

  return (
    <SafeAreaView style={styles.overlay} pointerEvents="box-none">
      <View style={styles.banner}>
        <Text style={styles.bannerText} numberOfLines={1}>
          {bannerText}
        </Text>
        <View style={styles.actions}>
          {placingPolygon && polygonDraftPoints.length >= 3 && (
            <TouchableOpacity style={styles.finishBtn} onPress={finishPolygon} activeOpacity={0.8}>
              <Text style={styles.finishText}>Finish</Text>
            </TouchableOpacity>
          )}
          {placingPolygon && polygonDraftPoints.length > 0 && (
            <TouchableOpacity style={styles.undoBtn} onPress={removeLastPolygonPoint} activeOpacity={0.8}>
              <Text style={styles.undoText}>Undo</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel} activeOpacity={0.8}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
});

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    pointerEvents: 'box-none',
  },
  banner: {
    position: 'absolute',
    top: 100,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(10,10,15,0.94)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderWidth: 1,
    borderColor: '#22c55e',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#22c55e',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
  bannerText: {
    color: '#e8e8f0',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.3,
    flex: 1,
  },
  actions: { flexDirection: 'row', gap: 8, marginLeft: 8 },
  finishBtn: {
    backgroundColor: '#22c55e',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
  },
  finishText: { color: '#000', fontWeight: '700', fontSize: 13 },
  cancelBtn: {
    backgroundColor: '#2a2a3a',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3a3a4e',
  },
  cancelText: { color: '#e8e8f0', fontWeight: '600', fontSize: 13 },
  undoBtn: {
    backgroundColor: '#1a1a24',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#f59e0b',
  },
  undoText: { color: '#f59e0b', fontWeight: '600', fontSize: 13 },
});
