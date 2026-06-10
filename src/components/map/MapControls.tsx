/**
 * MapControls — placement-mode toolbar.
 *
 * Pinned to the BOTTOM of the screen (just above the navigation drawer peek) so
 * its action buttons are never occluded by the top HUD pills / CENTER button.
 *
 * Modes:
 *   • Marker            → tap map to drop · CANCEL
 *   • Circle (no draft) → tap map to set centre · CANCEL
 *   • Circle (draft)    → drag handles to size/move · BACK · CONFIRM
 *   • Polygon           → tap to add points · BACK (undo) · FINISH · CANCEL
 */
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { memo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMapStore } from '@/store/useMapStore';
import { formatDistance } from '@/utils/distance';
import { C } from '@/constants/theme';

export const MapControls: React.FC = memo(() => {
  const placingMarker          = useMapStore((s) => s.placingMarker);
  const placingPolygon         = useMapStore((s) => s.placingPolygonZone);
  const placingCircle          = useMapStore((s) => s.placingCircleZone);
  const circleDraft            = useMapStore((s) => s.circleDraft);
  const polygonDraftPoints     = useMapStore((s) => s.polygonDraftPoints);
  const finishPolygon          = useMapStore((s) => s.finishPolygonZone);
  const removeLastPolygonPoint = useMapStore((s) => s.removeLastPolygonPoint);
  const cancelMarker           = useMapStore((s) => s.cancelMarkerPlacement);
  const cancelZone             = useMapStore((s) => s.cancelZonePlacement);
  const backCircleDraft        = useMapStore((s) => s.backCircleDraft);
  const confirmCircleDraft     = useMapStore((s) => s.confirmCircleDraft);

  const isPlacing = placingMarker || placingCircle || placingPolygon;
  if (!isPlacing) return null;

  const handleCancel = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    cancelMarker();
    cancelZone();
  };

  // ── Banner text + icon ──
  let bannerText: string;
  let icon: React.ComponentProps<typeof Ionicons>['name'];
  if (placingMarker) {
    bannerText = 'TAP MAP TO DROP MARKER';
    icon = 'pin';
  } else if (placingPolygon) {
    bannerText = `TAP TO ADD POINT  ·  ${polygonDraftPoints.length} PLACED`;
    icon = 'git-network';
  } else if (placingCircle && circleDraft) {
    bannerText = `DRAG TO SIZE  ·  ${formatDistance(circleDraft.radius)}`;
    icon = 'radio-button-on';
  } else {
    bannerText = 'TAP MAP TO SET ZONE CENTRE';
    icon = 'add';
  }

  return (
    <SafeAreaView style={s.overlay} pointerEvents="box-none" edges={['bottom']}>
      <View style={s.banner}>
        <Ionicons name={icon} size={16} color={C.green} />
        <Text style={s.bannerText} numberOfLines={1}>{bannerText}</Text>

        <View style={s.actions}>
          {/* ── Polygon controls ── */}
          {placingPolygon && polygonDraftPoints.length > 0 && (
            <TouchableOpacity
              style={s.ghostBtn}
              onPress={() => { Haptics.selectionAsync(); removeLastPolygonPoint(); }}
              activeOpacity={0.8}
            >
              <Ionicons name="arrow-undo" size={13} color={C.amber} />
              <Text style={s.ghostText}>BACK</Text>
            </TouchableOpacity>
          )}
          {placingPolygon && polygonDraftPoints.length >= 3 && (
            <TouchableOpacity
              style={s.primaryBtn}
              onPress={() => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); finishPolygon(); }}
              activeOpacity={0.85}
            >
              <Text style={s.primaryText}>FINISH</Text>
            </TouchableOpacity>
          )}

          {/* ── Circle draft controls ── */}
          {placingCircle && circleDraft && (
            <>
              <TouchableOpacity
                style={s.ghostBtn}
                onPress={backCircleDraft}
                activeOpacity={0.8}
              >
                <Ionicons name="arrow-undo" size={13} color={C.amber} />
                <Text style={s.ghostText}>BACK</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={s.primaryBtn}
                onPress={confirmCircleDraft}
                activeOpacity={0.85}
              >
                <Text style={s.primaryText}>CONFIRM</Text>
              </TouchableOpacity>
            </>
          )}

          {/* ── Cancel — always available ── */}
          <TouchableOpacity style={s.cancelBtn} onPress={handleCancel} activeOpacity={0.8}>
            <Text style={s.cancelText}>CANCEL</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
});

const s = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFill, justifyContent: 'flex-end', pointerEvents: 'box-none' } as any,
  banner: {
    marginHorizontal: 14,
    // sits above the collapsed navigation drawer peek (~118px)
    marginBottom: 134,
    backgroundColor: 'rgba(8,8,12,0.97)',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: C.greenBorder,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    shadowColor: C.green,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  bannerText: {
    color: C.textPrimary,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
    flex: 1,
  },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  primaryBtn: {
    backgroundColor: C.green,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  primaryText: { color: '#000', fontWeight: '900', fontSize: 11, letterSpacing: 0.8 },
  ghostBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: C.amberDim,
    backgroundColor: C.amberDim,
  },
  ghostText: { color: C.amber, fontWeight: '900', fontSize: 11, letterSpacing: 0.8 },
  cancelBtn: {
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  cancelText: { color: 'rgba(255,255,255,0.7)', fontWeight: '900', fontSize: 11, letterSpacing: 0.8 },
});
