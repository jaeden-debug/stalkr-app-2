/**
 * SelfSelectionPin — the avatar / initials pin shown above the self puck while
 * the user has their own marker selected.
 *
 * This is an ADDITIVE sibling of the puck, never a replacement. The puck keeps
 * rendering, keeps its coordinate and keeps its rotation the whole time this is
 * mounted; selecting and deselecting only mounts and unmounts this one node.
 * That is what keeps location tracking untouched by opening the drawer.
 *
 * It is one of the few remaining React-view markers, which is justified: it
 * shows a profile photo or initials, so its artwork is genuinely dynamic and
 * cannot be pre-generated. It is also singular and short-lived, so the
 * rasterisation cost is bounded — unlike the field pins, of which there may be
 * dozens on screen at once.
 */
import React, { memo } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { Marker } from 'react-native-maps';
import { useAuthStore } from '@/store/useAuthStore';
import { useMarkerSnapshot } from '@/hooks/useMarkerSnapshot';
import { MAP_Z_MARKER } from '@/constants/mapLayers';
import type { LatLng } from '@/types/database';

const ACCENT = '#4ADE80';

interface SelfSelectionPinProps {
  coordinate: LatLng;
}

export const SelfSelectionPin: React.FC<SelfSelectionPinProps> = memo(({ coordinate }) => {
  const avatarUrl = useAuthStore((s) => s.profile?.avatar_url);
  const nickname = useAuthStore((s) => s.profile?.nickname);
  const displayName = useAuthStore((s) => s.profile?.display_name);
  const profileInitials = useAuthStore((s) => s.profile?.initials);

  const name = nickname || displayName || 'You';
  const initials = (profileInitials || name.slice(0, 2)).toUpperCase();

  // Re-rasterise when the artwork actually changes. The coordinate is
  // deliberately NOT a reset key: moving a marker does not change its bitmap,
  // and including it would re-snapshot the pin on every GPS fix.
  const { tracksViewChanges, onLayout } = useMarkerSnapshot([avatarUrl ?? '', initials]);

  return (
    <Marker
      coordinate={coordinate}
      // Anchored at the bottom of the wrapper, which ends in a transparent
      // spacer — so the visible pin floats clear of the puck's ring rather than
      // sitting on top of it, while both still resolve to the same coordinate.
      anchor={{ x: 0.5, y: 1 }}
      tracksViewChanges={tracksViewChanges}
      zIndex={MAP_Z_MARKER.SELF_SELECTED}
    >
      <View style={styles.wrapper} onLayout={onLayout}>
        <View style={styles.bubble}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatar} />
          ) : (
            <Text style={styles.initials} numberOfLines={1}>
              {initials}
            </Text>
          )}
        </View>
        <View style={styles.stem} />
        {/* Transparent standoff so the pin tip clears the puck below it. */}
        <View style={styles.standoff} />
      </View>
    </Marker>
  );
});

SelfSelectionPin.displayName = 'SelfSelectionPin';

const styles = StyleSheet.create({
  wrapper: { alignItems: 'center' },
  bubble: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111',
    borderWidth: 3,
    borderColor: ACCENT,
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 8,
    elevation: 10,
    overflow: 'hidden',
  },
  avatar: { width: '100%', height: '100%' },
  initials: {
    color: ACCENT,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  stem: {
    width: 0,
    height: 0,
    marginTop: -1,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: ACCENT,
  },
  /** Height ≈ the puck's outer ring radius, so the tip sits just above it. */
  standoff: { width: 1, height: 20 },
});
