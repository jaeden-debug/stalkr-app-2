/**
 * MapControls — placement-mode banner (no emojis, tactical style).
 */
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { memo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMapStore } from '@/store/useMapStore';
import { C } from '@/constants/theme';

export const MapControls: React.FC = memo(() => {
  const placingMarker        = useMapStore((s) => s.placingMarker);
  const placingPolygon       = useMapStore((s) => s.placingPolygonZone);
  const placingZone          = useMapStore((s) => s.placingCircleZone);
  const polygonDraftPoints   = useMapStore((s) => s.polygonDraftPoints);
  const finishPolygon        = useMapStore((s) => s.finishPolygonZone);
  const removeLastPolygonPoint = useMapStore((s) => s.removeLastPolygonPoint);
  const cancelMarker         = useMapStore((s) => s.cancelMarkerPlacement);
  const cancelZone           = useMapStore((s) => s.cancelZonePlacement);

  const isPlacing = placingMarker || placingZone || placingPolygon;
  if (!isPlacing) return null;

  const handleCancel = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    cancelMarker();
    cancelZone();
  };

  const bannerText = placingMarker
    ? 'TAP MAP TO DROP MARKER'
    : placingPolygon
    ? `TAP TO ADD POINT  ·  ${polygonDraftPoints.length} PLACED`
    : 'TAP MAP TO PLACE ZONE CENTER';

  const icon: React.ComponentProps<typeof Ionicons>['name'] = placingMarker
    ? 'pin'
    : placingPolygon
    ? 'git-network'
    : 'scan';

  return (
    <SafeAreaView style={s.overlay} pointerEvents="box-none">
      <View style={s.banner}>
        <Ionicons name={icon} size={16} color={C.green} />
        <Text style={s.bannerText} numberOfLines={1}>{bannerText}</Text>
        <View style={s.actions}>
          {placingPolygon && polygonDraftPoints.length >= 3 && (
            <TouchableOpacity
              style={s.finishBtn}
              onPress={() => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); finishPolygon(); }}
              activeOpacity={0.8}
            >
              <Text style={s.finishText}>FINISH</Text>
            </TouchableOpacity>
          )}
          {placingPolygon && polygonDraftPoints.length > 0 && (
            <TouchableOpacity
              style={s.undoBtn}
              onPress={() => { Haptics.selectionAsync(); removeLastPolygonPoint(); }}
              activeOpacity={0.8}
            >
              <Text style={s.undoText}>UNDO</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={s.cancelBtn} onPress={handleCancel} activeOpacity={0.8}>
            <Text style={s.cancelText}>CANCEL</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
});

const s = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFill, pointerEvents: 'box-none' } as any,
  banner: {
    position: 'absolute',
    top: 110,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(8,8,12,0.96)',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: C.greenBorder,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    shadowColor: C.green,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  bannerText: {
    color: C.textPrimary,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
    flex: 1,
  },
  actions: { flexDirection: 'row', gap: 8 },
  finishBtn: {
    backgroundColor: C.green,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
  },
  finishText: { color: '#000', fontWeight: '900', fontSize: 11, letterSpacing: 0.8 },
  undoBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: C.amberDim,
    backgroundColor: C.amberDim,
  },
  undoText: { color: C.amber, fontWeight: '900', fontSize: 11, letterSpacing: 0.8 },
  cancelBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  cancelText: { color: 'rgba(255,255,255,0.7)', fontWeight: '900', fontSize: 11, letterSpacing: 0.8 },
});
