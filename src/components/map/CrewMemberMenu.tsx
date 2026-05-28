/**
 * CrewMemberMenu — bottom sheet shown when tapping another user's marker.
 */
import React, { memo } from 'react';
import { Clipboard, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Sheet } from '@/components/ui/Sheet';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Toggle } from '@/components/ui/Toggle';
import { BatteryIndicator } from '@/components/ui/BatteryIndicator';
import { useGroupStore } from '@/store/useGroupStore';
import { useMapStore } from '@/store/useMapStore';
import { useAuthStore } from '@/store/useAuthStore';
import { useToast } from '@/components/ui/Toast';
import { formatHeading, formatSpeed } from '@/utils/heading';
import { formatDistance, getDistance } from '@/utils/distance';
import { getLocationStatus, timeAgo } from '@/utils/time';
import { getCrewColor } from '@/constants/map';
import { FEATURES } from '@/config/features';

interface CrewMemberMenuProps {
  visible: boolean;
  onClose: () => void;
  userId: string;
}

export const CrewMemberMenu: React.FC<CrewMemberMenuProps> = memo(({ visible, onClose, userId }) => {
  const members = useGroupStore((s) => s.groupMembers);
  const crewLocations = useMapStore((s) => s.crewLocations);
  const myLocation = useMapStore((s) => s.myLocation);
  const visibleTrailUsers = useMapStore((s) => s.visibleTrailUsers);
  const toggleTrail = useMapStore((s) => s.toggleTrailForUser);
  const startMarkerPlacement = useMapStore((s) => s.startMarkerPlacement);
  const toast = useToast();

  const member = members.find((m) => m.user_id === userId);
  const location = crewLocations[userId];
  const color = getCrewColor(userId);
  const trailVisible = visibleTrailUsers[userId] ?? false;

  const displayName =
    member?.nickname_override || member?.profile?.nickname || member?.profile?.display_name || 'Unknown';
  const initials =
    member?.initials_override || member?.profile?.initials || displayName.slice(0, 2).toUpperCase();

  const status = location ? getLocationStatus(location.last_ping_at) : 'offline';
  const distance =
    myLocation && location
      ? getDistance({ latitude: myLocation.latitude, longitude: myLocation.longitude }, { latitude: location.latitude, longitude: location.longitude })
      : null;

  const handleCopyCoords = () => {
    if (!location) return;
    const text = `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`;
    Clipboard.setString(text);
    toast.success('Coordinates copied');
  };

  const handleSetWaypoint = () => {
    onClose();
    startMarkerPlacement('waypoint');
  };

  return (
    <Sheet visible={visible} onClose={onClose} snapHeight={480}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.profileRow}>
          <Avatar uri={member?.profile?.avatar_url} initials={initials} displayName={displayName} size={56} color={color} />
          <View style={styles.profileInfo}>
            <Text style={styles.name}>{displayName}</Text>
            <View style={styles.badges}>
              <Badge label={status === 'live' ? 'Live' : status === 'stale' ? 'Stale' : 'Offline'} variant={status} dot />
              {distance !== null && <Badge label={formatDistance(distance)} variant="info" />}
            </View>
          </View>
          {location?.battery_level != null && <BatteryIndicator level={location.battery_level} size="md" />}
        </View>

        {location ? (
          <>
            <TouchableOpacity style={styles.coordBox} onPress={handleCopyCoords} activeOpacity={0.7}>
              <Text style={styles.coordLabel}>COORDINATES</Text>
              <Text style={styles.coordText}>{location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}</Text>
              <Text style={styles.coordHint}>Tap to copy</Text>
            </TouchableOpacity>

            <View style={styles.statsGrid}>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Heading</Text>
                <Text style={styles.statValue}>{formatHeading(location.heading)}</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Speed</Text>
                <Text style={styles.statValue}>{formatSpeed(location.speed)}</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Accuracy</Text>
                <Text style={styles.statValue}>±{Math.round(location.accuracy ?? 0)}m</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Last seen</Text>
                <Text style={styles.statValue}>{timeAgo(location.last_ping_at)}</Text>
              </View>
            </View>
          </>
        ) : (
          <View style={styles.noLocation}>
            <Text style={styles.noLocationText}>Location unavailable</Text>
          </View>
        )}

        <View style={styles.toggleGroup}>
          <View style={[styles.toggleRow, styles.noBorder]}>
            <Text style={styles.toggleLabel}>Show Trail</Text>
            <Toggle value={trailVisible} onValueChange={() => toggleTrail(userId)} />
          </View>
        </View>

        {location && (
          <View style={styles.actions}>
            {FEATURES.EXPORT_COORDINATES && (
              <TouchableOpacity style={styles.actionBtn} onPress={handleCopyCoords}>
                <Text style={styles.actionBtnText}>📋  Copy Coordinates</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.actionBtn} onPress={handleSetWaypoint}>
              <Text style={styles.actionBtnText}>📍  Waypoint Here</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </Sheet>
  );
});

const styles = StyleSheet.create({
  content: { padding: 16, gap: 16 },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  profileInfo: { flex: 1, gap: 6 },
  name: { color: '#e8e8f0', fontSize: 18, fontWeight: '700' },
  badges: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  coordBox: { backgroundColor: '#0a0a0f', borderRadius: 10, padding: 14, borderWidth: 1, borderColor: '#2a2a3a' },
  coordLabel: { color: '#8888aa', fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 },
  coordText: { color: '#22c55e', fontSize: 14, fontFamily: 'Courier New', fontWeight: '600' },
  coordHint: { color: '#5555aa', fontSize: 10, marginTop: 4 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statItem: { flex: 1, minWidth: '45%', backgroundColor: '#12121a', borderRadius: 8, padding: 10, borderWidth: 1, borderColor: '#2a2a3a' },
  statLabel: { color: '#8888aa', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.8 },
  statValue: { color: '#e8e8f0', fontSize: 14, fontWeight: '600', marginTop: 2 },
  noLocation: { padding: 24, alignItems: 'center' },
  noLocationText: { color: '#8888aa', fontSize: 14 },
  toggleGroup: { backgroundColor: '#12121a', borderRadius: 10, borderWidth: 1, borderColor: '#2a2a3a' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, borderBottomWidth: 1, borderBottomColor: '#2a2a3a' },
  noBorder: { borderBottomWidth: 0 },
  toggleLabel: { color: '#e8e8f0', fontSize: 15 },
  actions: { gap: 10 },
  actionBtn: { backgroundColor: '#1a1a24', borderRadius: 10, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: '#2a2a3a' },
  actionBtnText: { color: '#e8e8f0', fontSize: 15, fontWeight: '600' },
});
