/**
 * PresenceBanner — states plainly how much to trust the position shown above it.
 *
 * Used by BOTH the self drawer and the crew-member drawer so the two can never
 * describe the same four states differently. All wording derives from
 * utils/presence.ts, which is the only place freshness thresholds live.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  PRESENCE_COLOR,
  describePresence,
  formatLastSeen,
  type Presence,
} from '@/utils/presence';
import type { LatLng } from '@/types/database';

const ICON: Record<Presence['state'], React.ComponentProps<typeof Ionicons>['name']> = {
  live: 'radio-button-on',
  stale: 'time-outline',
  dark: 'eye-off',
  unknown: 'help-circle-outline',
};

interface PresenceBannerProps {
  presence: Presence;
  /** Display name; use "You" for self so the copy reads naturally. */
  name: string;
  coords?: LatLng | null;
}

export const PresenceBanner: React.FC<PresenceBannerProps> = ({ presence, name, coords }) => {
  const color = PRESENCE_COLOR[presence.state];
  const isDark = presence.state === 'dark';

  return (
    <View style={[styles.wrap, { borderColor: color + '55', backgroundColor: color + '14' }]}>
      <View style={styles.headRow}>
        <Ionicons name={ICON[presence.state]} size={15} color={color} />
        <Text style={[styles.title, { color }]}>
          {isDark
            ? name === 'You'
              ? 'You went dark'
              : `${name} went dark`
            : presence.label.toUpperCase()}
        </Text>
      </View>

      <Text style={styles.body}>{describePresence(presence, name)}</Text>

      {/* For a dark or stale user the coordinate is explicitly LAST KNOWN, never
          presented as where they are now. */}
      {coords && (
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>
            {presence.isPositionCurrent ? 'Location' : 'Last known location'}
          </Text>
          <Text style={styles.metaValue}>
            {coords.latitude.toFixed(5)}, {coords.longitude.toFixed(5)}
          </Text>
        </View>
      )}

      <View style={styles.metaRow}>
        <Text style={styles.metaLabel}>Last updated</Text>
        <Text style={styles.metaValue}>{formatLastSeen(presence.ageMs)}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 6,
    marginBottom: 14,
  },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  title: { fontSize: 12, fontWeight: '900', letterSpacing: 0.8 },
  body: { color: 'rgba(255,255,255,0.72)', fontSize: 12.5, lineHeight: 17 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  metaLabel: { color: 'rgba(255,255,255,0.42)', fontSize: 11, fontWeight: '600' },
  metaValue: { color: '#e8e8f0', fontSize: 11.5, fontWeight: '700', fontVariant: ['tabular-nums'] },
});
