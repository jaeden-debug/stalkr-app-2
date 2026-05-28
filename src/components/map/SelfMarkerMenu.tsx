/**
 * SelfMarkerMenu — bottom sheet shown when user taps their own marker.
 */
import React, { memo } from 'react';
import { Clipboard, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Sheet } from '@/components/ui/Sheet';
import { Avatar } from '@/components/ui/Avatar';
import { Toggle } from '@/components/ui/Toggle';
import { Badge } from '@/components/ui/Badge';
import { BatteryIndicator } from '@/components/ui/BatteryIndicator';
import { useAuthStore } from '@/store/useAuthStore';
import { useLocationStore } from '@/store/useLocationStore';
import { useMapStore } from '@/store/useMapStore';
import { useToast } from '@/components/ui/Toast';
import { formatHeading, formatSpeed } from '@/utils/heading';
import { timeAgo } from '@/utils/time';
import { FEATURES } from '@/config/features';

interface SelfMarkerMenuProps {
  visible: boolean;
  onClose: () => void;
}

export const SelfMarkerMenu: React.FC<SelfMarkerMenuProps> = memo(({ visible, onClose }) => {
  const profile = useAuthStore((s) => s.profile);
  const userId = useAuthStore((s) => s.user?.id ?? '');

  const myLocation = useMapStore((s) => s.myLocation);
  const visibleTrailUsers = useMapStore((s) => s.visibleTrailUsers);
  const toggleTrail = useMapStore((s) => s.toggleTrailForUser);
  const startMarkerPlacement = useMapStore((s) => s.startMarkerPlacement);

  const isBroadcasting = useLocationStore((s) => s.isBroadcasting);
  const setIsBroadcasting = useLocationStore((s) => s.setIsBroadcasting);
  const lastPingAt = useLocationStore((s) => s.lastBroadcastAt);
  const batteryLevel = useLocationStore((s) => s.batteryLevel);

  const toast = useToast();
  const myTrailVisible = visibleTrailUsers[userId] ?? false;

  const handleCopyCoords = () => {
    if (!myLocation) return;
    const text = `${myLocation.latitude.toFixed(6)}, ${myLocation.longitude.toFixed(6)}`;
    Clipboard.setString(text);
    toast.success('Coordinates copied');
  };

  const handleSetWaypoint = () => {
    if (!myLocation) return;
    onClose();
    startMarkerPlacement('waypoint');
  };

  const displayName = profile?.nickname || profile?.display_name || 'You';
  const initials = profile?.initials || displayName.slice(0, 2).toUpperCase();

  return (
    <Sheet visible={visible} onClose={onClose} title="You" snapHeight={520}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.profileRow}>
          <Avatar uri={profile?.avatar_url} initials={initials} displayName={displayName} size={56} color="#22c55e" />
          <View style={styles.profileInfo}>
            <Text style={styles.name}>{displayName}</Text>
            <Badge label={isBroadcasting ? 'Broadcasting' : 'Hidden'} variant={isBroadcasting ? 'live' : 'offline'} dot />
          </View>
          {batteryLevel !== null && batteryLevel !== undefined && (
            <BatteryIndicator level={batteryLevel} size="md" />
          )}
        </View>

        {myLocation ? (
          <TouchableOpacity style={styles.coordBox} onPress={handleCopyCoords} activeOpacity={0.7}>
            <Text style={styles.coordLabel}>COORDINATES</Text>
            <Text style={styles.coordText}>
              {myLocation.latitude.toFixed(6)}, {myLocation.longitude.toFixed(6)}
            </Text>
            <Text style={styles.coordHint}>Tap to copy</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.coordBox}>
            <Text style={styles.coordLabel}>COORDINATES</Text>
            <Text style={styles.coordHint}>Acquiring GPS…</Text>
          </View>
        )}

        {myLocation && (
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Heading</Text>
              <Text style={styles.statValue}>{formatHeading(myLocation.heading)}</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Accuracy</Text>
              <Text style={styles.statValue}>±{Math.round(myLocation.accuracy ?? 0)}m</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Last update</Text>
              <Text style={styles.statValue}>{timeAgo(lastPingAt)}</Text>
            </View>
          </View>
        )}

        <View style={styles.toggleGroup}>
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Broadcasting Location</Text>
            <Toggle value={isBroadcasting} onValueChange={setIsBroadcasting} />
          </View>
          <View style={[styles.toggleRow, styles.noBorder]}>
            <Text style={styles.toggleLabel}>Show My Trail</Text>
            <Toggle value={myTrailVisible} onValueChange={() => toggleTrail(userId)} />
          </View>
        </View>

        <View style={styles.actions}>
          {FEATURES.EXPORT_COORDINATES && myLocation && (
            <TouchableOpacity style={styles.actionBtn} onPress={handleCopyCoords}>
              <Text style={styles.actionBtnText}>📋  Copy Coordinates</Text>
            </TouchableOpacity>
          )}
          {myLocation && (
            <TouchableOpacity style={styles.actionBtn} onPress={handleSetWaypoint}>
              <Text style={styles.actionBtnText}>📍  Set Waypoint Here</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </Sheet>
  );
});

const styles = StyleSheet.create({
  content: { padding: 16, gap: 16 },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingBottom: 4 },
  profileInfo: { flex: 1, gap: 6 },
  name: { color: '#e8e8f0', fontSize: 18, fontWeight: '700' },
  coordBox: { backgroundColor: '#0a0a0f', borderRadius: 10, padding: 14, borderWidth: 1, borderColor: '#2a2a3a' },
  coordLabel: { color: '#8888aa', fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 },
  coordText: { color: '#22c55e', fontSize: 14, fontFamily: 'Courier New', fontWeight: '600' },
  coordHint: { color: '#5555aa', fontSize: 10, marginTop: 4 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statItem: { flex: 1, minWidth: '45%', backgroundColor: '#12121a', borderRadius: 8, padding: 10, borderWidth: 1, borderColor: '#2a2a3a' },
  statLabel: { color: '#8888aa', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.8 },
  statValue: { color: '#e8e8f0', fontSize: 14, fontWeight: '600', marginTop: 2 },
  toggleGroup: { backgroundColor: '#12121a', borderRadius: 10, borderWidth: 1, borderColor: '#2a2a3a', overflow: 'hidden' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, borderBottomWidth: 1, borderBottomColor: '#2a2a3a' },
  noBorder: { borderBottomWidth: 0 },
  toggleLabel: { color: '#e8e8f0', fontSize: 15 },
  actions: { gap: 10 },
  actionBtn: { backgroundColor: '#1a1a24', borderRadius: 10, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: '#2a2a3a' },
  actionBtnText: { color: '#e8e8f0', fontSize: 15, fontWeight: '600' },
});
