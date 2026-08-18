/**
 * SelfMarker — the current user's location presentation.
 *
 * Renders three independent siblings, in this order:
 *   1. accuracy halo   <Circle>  — sized from the GPS-reported horizontal accuracy
 *   2. location puck   <Marker image={...}>  — always mounted while a fix exists
 *   3. selection pin   <SelfSelectionPin>    — additive, only while self is selected
 *
 * ── Design rules this component exists to enforce ────────────────────────────
 * • The puck is a static IMAGE marker, not a React child view. It therefore has
 *   no bitmap-snapshot lifecycle and cannot blank out. It is also the element
 *   that rotates, which is exactly where view-marker rasterisation hurts most.
 * • Selection is ADDITIVE. Selecting self mounts a sibling; it never changes the
 *   puck's key, props or position in the child list, so tracking cannot be
 *   disturbed by opening or closing the drawer.
 * • Heading comes from useSelfPoseStore, never useMapStore. The compass fires
 *   ~10x/second; routing it through the collection store re-rendered MarkerLayer
 *   and ZoneLayer at the same rate.
 * • Every subscription below selects a PRIMITIVE. Object selectors would break
 *   Zustand's Object.is check and re-render on unrelated map-store writes.
 */
import React, { memo } from 'react';
import { Circle, Marker } from 'react-native-maps';
import { useMapStore } from '@/store/useMapStore';
import { useLocationStore } from '@/store/useLocationStore';
import { useGroupStore } from '@/store/useGroupStore';
import { useAuthStore } from '@/store/useAuthStore';
import { useSelfPoseStore } from '@/store/useSelfPoseStore';
import { SELF_PUCK_IMAGE } from '@/constants/mapMarkerImages';
import { MAP_Z_MARKER, MAP_Z_SHAPE } from '@/constants/mapLayers';
import { SelfSelectionPin } from './SelfSelectionPin';

/**
 * Accuracy is quantised before it reaches the Circle. Raw GPS accuracy jitters
 * by fractions of a metre on every fix, which would make the halo visibly
 * breathe and re-render this component far more often than the user moves.
 */
const ACCURACY_QUANTUM_M = 5;
/** Below this the halo is smaller than the puck itself, so it just adds noise. */
const MIN_ACCURACY_TO_DRAW_M = 8;
/** Above this the fix is too poor to depict honestly as a circle. */
const MAX_ACCURACY_TO_DRAW_M = 500;

export const SelfMarker: React.FC = memo(() => {
  const userId = useAuthStore((s) => s.user?.id);

  // Primitive selectors — these change only when the value genuinely changes,
  // so an unrelated map-store write (a marker being added, a zone selected)
  // cannot re-render the puck.
  const latitude = useMapStore((s) => s.myLocation?.latitude);
  const longitude = useMapStore((s) => s.myLocation?.longitude);
  const rawAccuracy = useMapStore((s) => s.myLocation?.accuracy);
  const isSelected = useMapStore((s) => s.selectedMapUser?.type === 'self');

  const heading = useSelfPoseStore((s) => s.heading);

  // Go Dark is per-crew; fall back to the global flag when this crew has no
  // explicit override yet.
  const activeGroupId = useGroupStore((s) => s.activeGroupId);
  const isDark = useLocationStore((s) => {
    const perCrew = activeGroupId ? s.groupBroadcastingStatus[activeGroupId] : undefined;
    return perCrew !== undefined ? !perCrew : !s.isBroadcasting;
  });

  if (latitude == null || longitude == null || !userId) return null;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  const coordinate = { latitude, longitude };

  // A heading of null means "compass unavailable", which is different from 0°.
  // Going dark also suppresses direction, matching how crew members see you.
  const hasHeading = !isDark && heading != null && Number.isFinite(heading);

  const image = isDark
    ? SELF_PUCK_IMAGE.dark
    : hasHeading
      ? SELF_PUCK_IMAGE.live
      : SELF_PUCK_IMAGE.noHeading;

  const accuracyRadius =
    rawAccuracy != null &&
    Number.isFinite(rawAccuracy) &&
    rawAccuracy >= MIN_ACCURACY_TO_DRAW_M &&
    rawAccuracy <= MAX_ACCURACY_TO_DRAW_M
      ? Math.round(rawAccuracy / ACCURACY_QUANTUM_M) * ACCURACY_QUANTUM_M
      : null;

  const handlePress = () => {
    useMapStore.getState().setSelectedMapUser({ userId, type: 'self' });
  };

  return (
    <>
      {accuracyRadius !== null && (
        <Circle
          center={coordinate}
          radius={accuracyRadius}
          strokeColor={isDark ? 'rgba(107,114,128,0.35)' : 'rgba(34,197,94,0.35)'}
          fillColor={isDark ? 'rgba(107,114,128,0.10)' : 'rgba(34,197,94,0.10)'}
          strokeWidth={1}
          testID="self-accuracy"
          zIndex={MAP_Z_SHAPE.SELF_ACCURACY}
        />
      )}

      <Marker
        testID="self-puck"
        coordinate={coordinate}
        anchor={{ x: 0.5, y: 0.5 }}
        image={image}
        // flat + rotation makes the SDK rotate the puck in MAP space, measured
        // clockwise from north. Google Maps compensates for the camera's own
        // bearing internally, so we must NOT subtract map bearing ourselves —
        // doing so would double-count when the user rotates the map.
        flat
        rotation={hasHeading ? heading : 0}
        onPress={handlePress}
        zIndex={MAP_Z_MARKER.SELF_PUCK}
      />

      {isSelected && <SelfSelectionPin coordinate={coordinate} />}
    </>
  );
});

SelfMarker.displayName = 'SelfMarker';
