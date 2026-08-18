/**
 * SelfMarkerMenu — rich detail card shown when the user taps their own marker.
 */
import React, { memo } from 'react';
import { Clipboard, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Sheet } from '@/components/ui/Sheet';
import { Toggle } from '@/components/ui/Toggle';
import { MemberCard } from './MemberCard';
import { useAuthStore } from '@/store/useAuthStore';
import { useLocationStore } from '@/store/useLocationStore';
import { useGoDark } from '@/hooks/useGoDark';
import { useMapStore } from '@/store/useMapStore';
import { useToast } from '@/components/ui/Toast';
import { PresenceBanner } from './PresenceBanner';
import { resolvePresence } from '@/utils/presence';

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

  // PRIVACY-CRITICAL: this toggle must write the same state useLocationTracker
  // reads. It previously called setIsBroadcasting (the GLOBAL flag) only, while
  // the tracker gates on groupBroadcastingStatus[activeGroupId] — which
  // defaults to LIVE when undefined. Result: the marker greyed out and the user
  // believed they were hidden while their position kept broadcasting to every
  // crew. useGoDark writes both, and enforces crew tracking policy.
  const { isDark, isEnforced, toggle: toggleGoDark } = useGoDark();
  const isBroadcasting = !isDark;
  const lastPingAt = useLocationStore((s) => s.lastBroadcastAt);
  const batteryLevel = useLocationStore((s) => s.batteryLevel);

  const toast = useToast();
  const myTrailVisible = visibleTrailUsers[userId] ?? false;

  const displayName = profile?.nickname || profile?.display_name || 'You';
  const initials = profile?.initials || displayName.slice(0, 2).toUpperCase();
  const coords = myLocation ? { latitude: myLocation.latitude, longitude: myLocation.longitude } : null;

  // Self presence is authoritative locally — we know our own go-dark state
  // without waiting for a server round-trip.
  const presence = resolvePresence({ isDark, lastPingAt: lastPingAt ?? null });

  const handleCopyCoords = () => {
    if (!coords) return;
    Clipboard.setString(`${coords.latitude.toFixed(6)}, ${coords.longitude.toFixed(6)}`);
    toast.success('Coordinates copied');
  };
  const handleSetWaypoint = () => { if (!coords) return; onClose(); startMarkerPlacement('waypoint'); };
  const handleGoTo = () => { if (coords) { useMapStore.getState().goTo(coords); onClose(); } };

  return (
    <Sheet visible={visible} onClose={onClose} title="You" snapHeight={560}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <PresenceBanner presence={presence} name="You" coords={coords} />
        <MemberCard
          name={displayName}
          avatarUri={profile?.avatar_url}
          initials={initials}
          color="#4ADE80"
          isSelf
          isDark={isDark}
          status={presence.state === 'dark' ? 'offline' : presence.state === 'stale' ? 'stale' : 'live'}
          coords={coords}
          heading={myLocation?.heading}
          speed={myLocation?.speed}
          battery={batteryLevel}
          accuracy={myLocation?.accuracy}
          lastUpdated={lastPingAt}
          distanceM={null}
          medical={{ bloodType: profile?.blood_type, allergies: profile?.allergies, medications: profile?.medications, notes: profile?.medical_notes }}
          onSetWaypoint={handleSetWaypoint}
          onGoTo={handleGoTo}
          onCopyCoords={handleCopyCoords}
        >
          <View style={styles.toggleGroup}>
            <View style={[styles.toggleRow, styles.border]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.toggleLabel}>Broadcasting Location</Text>
                <Text style={styles.toggleSub}>
                  {isEnforced
                    ? 'This crew enforces tracking'
                    : isBroadcasting
                      ? 'Visible to this crew'
                      : 'You went dark — crew sees your last known location'}
                </Text>
              </View>
              <Toggle value={isBroadcasting} disabled={isEnforced} onValueChange={() => toggleGoDark()} />
            </View>
            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>Breadcrumb Trail</Text>
              <Toggle value={myTrailVisible} onValueChange={() => toggleTrail(userId)} />
            </View>
          </View>
        </MemberCard>
      </ScrollView>
    </Sheet>
  );
});

const styles = StyleSheet.create({
  toggleGroup: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14 },
  border: { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)' },
  toggleLabel: { color: '#e8e8f0', fontSize: 15, fontWeight: '600' },
  toggleSub: { color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 2 },
});
