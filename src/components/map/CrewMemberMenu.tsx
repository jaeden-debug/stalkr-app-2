/**
 * CrewMemberMenu — bottom sheet shown when tapping another user's marker.
 */
import React, { memo } from 'react';
import { Clipboard, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Sheet } from '@/components/ui/Sheet';
import { Toggle } from '@/components/ui/Toggle';
import { MemberCard } from './MemberCard';
import { PresenceBanner } from './PresenceBanner';
import { resolvePresence } from '@/utils/presence';
import { useGroupStore } from '@/store/useGroupStore';
import { useMapStore } from '@/store/useMapStore';
import { useToast } from '@/components/ui/Toast';
import { getDistance } from '@/utils/distance';
import { getCrewColor } from '@/constants/map';
import { callNumber, openSms } from '@/utils/contactActions';

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

  // Single authoritative freshness policy — this drawer previously collapsed
  // "went dark", "signal aged out" and "no data at all" into one 'offline'
  // value, so it could not tell the user which had happened.
  const presence = resolvePresence({
    status: location?.status,
    lastPingAt: location?.last_ping_at,
  });
  const isDark = presence.state === 'dark';
  const status: 'live' | 'stale' | 'offline' =
    presence.state === 'live' ? 'live' : presence.state === 'stale' ? 'stale' : 'offline';

  const coords = location ? { latitude: location.latitude, longitude: location.longitude } : null;
  const distance = myLocation && coords
    ? getDistance({ latitude: myLocation.latitude, longitude: myLocation.longitude }, coords)
    : null;

  const handleCopyCoords = () => {
    if (!coords) return;
    Clipboard.setString(`${coords.latitude.toFixed(6)}, ${coords.longitude.toFixed(6)}`);
    toast.success('Coordinates copied');
  };

  const handleSetWaypoint = () => { onClose(); startMarkerPlacement('waypoint'); };
  const handleGoTo = () => { if (coords) { useMapStore.getState().goTo(coords); onClose(); } };

  return (
    <Sheet visible={visible} onClose={onClose} snapHeight={560}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <PresenceBanner presence={presence} name={displayName} coords={coords} />
        <MemberCard
          name={displayName}
          avatarUri={member?.avatar_url_override || member?.profile?.avatar_url}
          initials={initials}
          color={color}
          isSelf={false}
          isDark={isDark}
          status={status}
          coords={coords}
          heading={presence.isDirectional ? (location?.heading ?? undefined) : undefined}
          speed={location?.speed}
          battery={location?.battery_level ?? null}
          accuracy={location?.accuracy}
          lastUpdated={location?.last_ping_at}
          distanceM={distance}
          medical={member?.profile?.medical_share_with_crew
            ? { bloodType: member?.profile?.blood_type, allergies: member?.profile?.allergies, medications: member?.profile?.medications, notes: member?.profile?.medical_notes }
            : null}
          onSetWaypoint={handleSetWaypoint}
          onGoTo={handleGoTo}
          onCopyCoords={handleCopyCoords}
        >
          {!!member?.profile?.phone && (
            <View style={styles.contactRow}>
              <TouchableOpacity style={styles.contactBtn} onPress={() => callNumber(member.profile!.phone!)} activeOpacity={0.8}>
                <Text style={styles.contactBtnText}>📞  Call</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.contactBtn} onPress={() => openSms([member.profile!.phone!], `Hey ${displayName} — `)} activeOpacity={0.8}>
                <Text style={styles.contactBtnText}>💬  Text</Text>
              </TouchableOpacity>
            </View>
          )}
          <View style={styles.toggleGroup}>
            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>Breadcrumb Trail</Text>
              <Toggle value={trailVisible} onValueChange={() => toggleTrail(userId)} />
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
  toggleLabel: { color: '#e8e8f0', fontSize: 15 },
  contactRow: { flexDirection: 'row', gap: 10 },
  contactBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 13, borderRadius: 12,
    backgroundColor: 'rgba(74,222,128,0.12)', borderWidth: 1, borderColor: 'rgba(74,222,128,0.35)',
  },
  contactBtnText: { color: '#4ADE80', fontSize: 14, fontWeight: '800' },
});
