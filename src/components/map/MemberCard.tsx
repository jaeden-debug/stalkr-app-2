/**
 * MemberCard — shared rich detail card for the self marker and crew markers.
 * Rendered inside a Sheet by SelfMarkerMenu / CrewMemberMenu.
 *
 * Shows name, avatar, distance, heading, speed, battery, accuracy, status,
 * last-updated and live coordinates. When the member is dark/offline the avatar
 * becomes a greyed skull, coordinates read as frozen "LAST KNOWN", and Go To
 * Location is disabled.
 */
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '@/components/ui/Avatar';
import { BatteryIndicator } from '@/components/ui/BatteryIndicator';
import { formatHeading, formatSpeed } from '@/utils/heading';
import { formatDistanceBoth } from '@/utils/distance';
import { timeAgo } from '@/utils/time';
import { C } from '@/constants/theme';

export interface MemberCardProps {
  name: string;
  avatarUri?: string | null;
  initials: string;
  color: string;
  isSelf: boolean;
  isDark: boolean;
  status: 'live' | 'stale' | 'offline';
  coords?: { latitude: number; longitude: number } | null;
  heading?: number;
  speed?: number;
  battery?: number | null;
  accuracy?: number;
  lastUpdated?: string | null;
  distanceM?: number | null;
  medical?: { bloodType?: string | null; allergies?: string | null; medications?: string | null; notes?: string | null } | null;
  onSetWaypoint: () => void;
  onGoTo: () => void;
  onCopyCoords: () => void;
  children?: React.ReactNode;
}

export const MemberCard: React.FC<MemberCardProps> = ({
  name, avatarUri, initials, color, isSelf, isDark, status, coords,
  heading, speed, battery, accuracy, lastUpdated, distanceM, medical,
  onSetWaypoint, onGoTo, onCopyCoords, children,
}) => {
  const hasMedical = !!medical && (medical.bloodType || medical.allergies || medical.medications || medical.notes);
  const statusColor = status === 'live' ? C.green : status === 'stale' ? C.amber : C.red;
  const statusLabel = status === 'live' ? 'LIVE LOCATION' : status === 'stale' ? 'STALE' : 'LAST KNOWN';
  const hasCoords = !!coords;

  return (
    <View style={s.wrap}>
      {/* Header */}
      <View style={s.headerRow}>
        {isDark ? (
          <View style={[s.skull, { borderColor: 'rgba(255,255,255,0.25)' }]}>
            <Ionicons name="skull" size={28} color="rgba(255,255,255,0.5)" />
          </View>
        ) : (
          <Avatar uri={avatarUri} initials={initials} displayName={name} size={56} color={color} />
        )}
        <View style={{ flex: 1 }}>
          <Text style={[s.name, isDark && s.dim]}>{name}</Text>
          <View style={s.badgeRow}>
            <View style={[s.statusPill, { borderColor: statusColor }]}>
              <View style={[s.dot, { backgroundColor: statusColor }]} />
              <Text style={[s.statusText, { color: statusColor }]}>{statusLabel}</Text>
            </View>
            {distanceM != null && (
              <View style={s.metaPill}><Text style={s.metaPillText}>{formatDistanceBoth(distanceM)}</Text></View>
            )}
          </View>
        </View>
        {battery != null && <BatteryIndicator level={battery} size="md" />}
      </View>

      {/* Stats grid */}
      <View style={s.grid}>
        <Stat label="Heading" value={heading != null ? formatHeading(heading) : '—'} dim={isDark} />
        <Stat label="Speed" value={speed != null ? formatSpeed(speed) : '—'} dim={isDark} />
        <Stat label="Accuracy" value={accuracy != null ? `±${Math.round(accuracy)}m` : '—'} dim={isDark} />
        <Stat label="Last updated" value={timeAgo(lastUpdated ?? null)} dim={isDark} />
      </View>

      {/* Coordinates */}
      <TouchableOpacity style={[s.coordBox, isDark && s.coordBoxDim]} onPress={hasCoords ? onCopyCoords : undefined} activeOpacity={hasCoords ? 0.7 : 1}>
        <Text style={s.coordLabel}>{isDark ? 'LAST KNOWN COORDINATES' : 'LIVE COORDINATES'}</Text>
        <Text style={[s.coordText, isDark && s.dim]}>
          {hasCoords ? `${coords!.latitude.toFixed(6)}, ${coords!.longitude.toFixed(6)}` : 'Acquiring GPS…'}
        </Text>
        {hasCoords && <Text style={s.coordHint}>Tap to copy</Text>}
      </TouchableOpacity>

      {/* Emergency medical */}
      {hasMedical && (
        <View style={s.medBox}>
          <View style={s.medHead}>
            <Ionicons name="medkit" size={14} color={C.red} />
            <Text style={s.medTitle}>EMERGENCY MEDICAL</Text>
          </View>
          {!!medical!.bloodType && <Text style={s.medLine}><Text style={s.medKey}>Blood: </Text>{medical!.bloodType}</Text>}
          {!!medical!.allergies && <Text style={s.medLine}><Text style={s.medKey}>Allergies: </Text>{medical!.allergies}</Text>}
          {!!medical!.medications && <Text style={s.medLine}><Text style={s.medKey}>Meds: </Text>{medical!.medications}</Text>}
          {!!medical!.notes && <Text style={s.medLine}><Text style={s.medKey}>Notes: </Text>{medical!.notes}</Text>}
        </View>
      )}

      {/* Extra controls (toggles etc.) */}
      {children}

      {/* Actions */}
      <View style={s.actions}>
        <TouchableOpacity
          style={[s.goBtn, (isDark || !hasCoords) && s.btnDisabled]}
          onPress={hasCoords && !isDark ? onGoTo : undefined}
          activeOpacity={hasCoords && !isDark ? 0.85 : 1}
        >
          <Ionicons name="navigate" size={16} color={isDark || !hasCoords ? 'rgba(255,255,255,0.35)' : '#000'} />
          <Text style={[s.goText, (isDark || !hasCoords) && { color: 'rgba(255,255,255,0.35)' }]}>GO TO LOCATION</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.wpBtn} onPress={onSetWaypoint} activeOpacity={0.85}>
          <Ionicons name="pin" size={16} color={C.green} />
          <Text style={s.wpText}>{isSelf ? 'WAYPOINT HERE' : 'WAYPOINT'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const Stat: React.FC<{ label: string; value: string; dim?: boolean }> = ({ label, value, dim }) => (
  <View style={s.stat}>
    <Text style={s.statLabel}>{label}</Text>
    <Text style={[s.statValue, dim && s.dim]}>{value}</Text>
  </View>
);

const s = StyleSheet.create({
  wrap: { padding: 16, gap: 14 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  skull: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
  },
  name: { color: '#FFFFFF', fontSize: 18, fontWeight: '800' },
  dim: { color: 'rgba(255,255,255,0.45)' },
  badgeRow: { flexDirection: 'row', gap: 8, marginTop: 6, alignItems: 'center', flexWrap: 'wrap' },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  dot: { width: 7, height: 7, borderRadius: 3.5 },
  statusText: { fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  metaPill: { backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  metaPillText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  stat: { flex: 1, minWidth: '45%', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 11, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  statLabel: { color: 'rgba(255,255,255,0.45)', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.8 },
  statValue: { color: '#FFFFFF', fontSize: 15, fontWeight: '700', marginTop: 3 },
  coordBox: { backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  coordBoxDim: { opacity: 0.7 },
  coordLabel: { color: 'rgba(255,255,255,0.45)', fontSize: 10, letterSpacing: 1, fontWeight: '800', marginBottom: 4 },
  coordText: { color: C.green, fontSize: 14, fontFamily: 'Courier New', fontWeight: '700' },
  coordHint: { color: 'rgba(255,255,255,0.35)', fontSize: 10, marginTop: 4 },
  medBox: { backgroundColor: C.redDim, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: C.redBorder, gap: 3 },
  medHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 },
  medTitle: { color: C.red, fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  medLine: { color: '#FFFFFF', fontSize: 13, lineHeight: 18 },
  medKey: { color: 'rgba(255,255,255,0.55)', fontWeight: '700' },
  actions: { flexDirection: 'row', gap: 10 },
  goBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: C.green, borderRadius: 14, paddingVertical: 14 },
  goText: { color: '#000', fontWeight: '900', fontSize: 12, letterSpacing: 0.8 },
  btnDisabled: { backgroundColor: 'rgba(255,255,255,0.06)' },
  wpBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderWidth: 1.5, borderColor: C.greenBorder, backgroundColor: C.greenDim, borderRadius: 14, paddingVertical: 14 },
  wpText: { color: C.green, fontWeight: '900', fontSize: 12, letterSpacing: 0.8 },
});
