/**
 * JourneySummary — styled overview shown after a journey arrives/ends.
 * Premium tactical card; share via the OS share sheet (text + watch link).
 * (Image capture/save is a documented follow-up — it needs react-native-view-shot
 * + expo-media-library, which aren't installed; we avoid untested native deps.)
 */
import React, { useEffect, useState } from 'react';
import { Modal, ScrollView, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/services/supabase';
import { buildWatchUrl } from '@/services/sessions';
import { useSessionStore } from '@/store/useSessionStore';
import { getDistance, formatDistance, formatDistanceMiles } from '@/utils/distance';
import { formatSpeed } from '@/utils/heading';
import { C } from '@/constants/theme';
import type { LatLng } from '@/types/database';

function fmtTime(iso?: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
function fmtDuration(a?: string | null, b?: string | null) {
  if (!a || !b) return '—';
  const sec = Math.max(0, Math.floor((new Date(b).getTime() - new Date(a).getTime()) / 1000));
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export const JourneySummary: React.FC = () => {
  const session = useSessionStore((s) => s.summarySession);
  const setSummary = useSessionStore((s) => s.setSummarySession);
  const [distance, setDistance] = useState<number | null>(null);
  const [topSpeed, setTopSpeed] = useState<number | null>(null);
  const [directLine, setDirectLine] = useState<number | null>(null);

  useEffect(() => {
    if (!session) { setDistance(null); setTopSpeed(null); setDirectLine(null); return; }
    (async () => {
      const { data } = await supabase
        .from('trail_points').select('latitude, longitude, speed').eq('session_id', session.id).order('created_at', { ascending: true });
      if (!data || data.length < 2) { setDistance(null); return; }
      let total = 0; let maxSpd = 0;
      for (let i = 1; i < data.length; i++) {
        total += getDistance(data[i - 1] as LatLng, data[i] as LatLng);
        const sp = (data[i] as any).speed ?? 0;
        if (sp > maxSpd) maxSpd = sp;
      }
      setDistance(total);
      setTopSpeed(maxSpd > 0.5 ? maxSpd : null);
      // Straight-line distance from the first recorded point to the destination.
      if (session.destination_latitude != null && session.destination_longitude != null) {
        setDirectLine(getDistance(data[0] as LatLng, { latitude: session.destination_latitude, longitude: session.destination_longitude }));
      }
    })();
  }, [session?.id]);

  if (!session) return null;

  const arrived = session.status === 'arrived';
  const durationStr = fmtDuration(session.started_at, session.arrived_at ?? session.ended_at);
  const durSec = session.started_at && (session.arrived_at ?? session.ended_at)
    ? Math.max(1, (new Date(session.arrived_at ?? session.ended_at!).getTime() - new Date(session.started_at).getTime()) / 1000) : null;
  const avgSpeed = distance != null && durSec ? distance / durSec : null;

  const handleShare = async () => {
    const url = buildWatchUrl(session.watch_token);
    const dest = session.destination_name ? ` to ${session.destination_name}` : '';
    try {
      await Share.share({
        message: `${session.traveler_name ?? 'I'} ${arrived ? 'arrived safely' : 'completed a journey'}${dest} on Stalkr. ${durationStr} · view: ${url}`,
        url,
      });
    } catch {}
  };

  const Row: React.FC<{ icon: React.ComponentProps<typeof Ionicons>['name']; label: string; value: string }> = ({ icon, label, value }) => (
    <View style={s.statRow}>
      <Ionicons name={icon} size={15} color="rgba(255,255,255,0.5)" />
      <Text style={s.statLabel}>{label}</Text>
      <Text style={s.statValue}>{value}</Text>
    </View>
  );

  return (
    <Modal visible animationType="fade" transparent onRequestClose={() => setSummary(null)}>
      <View style={s.backdrop}>
        <SafeAreaView style={{ width: '100%' }}>
          <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
            <View style={s.card}>
              <View style={s.brandRow}>
                <View style={s.brandDot} />
                <Text style={s.brand}>STALKR</Text>
              </View>

              <View style={[s.statusBadge, arrived ? s.statusOk : s.statusEnd]}>
                <Ionicons name={arrived ? 'shield-checkmark' : 'flag'} size={16} color={arrived ? C.green : 'rgba(255,255,255,0.7)'} />
                <Text style={[s.statusText, { color: arrived ? C.green : 'rgba(255,255,255,0.7)' }]}>{arrived ? 'ARRIVED SAFELY' : 'JOURNEY ENDED'}</Text>
              </View>

              <Text style={s.traveler}>{session.traveler_name ?? 'Traveler'}</Text>
              {!!session.destination_name && <Text style={s.dest}>→ {session.destination_name}</Text>}

              <View style={s.statsBox}>
                <Row icon="time" label="Started" value={fmtTime(session.started_at)} />
                <Row icon="flag" label={arrived ? 'Arrived' : 'Ended'} value={fmtTime(session.arrived_at ?? session.ended_at)} />
                <Row icon="hourglass" label="Duration" value={durationStr} />
                {distance != null && <Row icon="walk" label="Distance traveled" value={`${formatDistance(distance)} · ${formatDistanceMiles(distance)}`} />}
                {directLine != null && <Row icon="navigate" label="Direct line" value={`${formatDistance(directLine)} · ${formatDistanceMiles(directLine)}`} />}
                {avgSpeed != null && <Row icon="speedometer" label="Avg speed" value={formatSpeed(avgSpeed)} />}
                {topSpeed != null && <Row icon="flash" label="Top speed" value={formatSpeed(topSpeed)} />}
              </View>

              <View style={s.timeline}>
                <Text style={s.timelineLabel}>JOURNEY EVENTS</Text>
                <Text style={s.event}>• Journey started — {fmtTime(session.started_at)}</Text>
                <Text style={s.event}>• Watchers invited</Text>
                {arrived && <Text style={[s.event, { color: C.green }]}>• Arrived safely — {fmtTime(session.arrived_at)}</Text>}
                <Text style={s.event}>• Journey {arrived ? 'completed' : 'ended'}</Text>
              </View>

              <View style={s.actions}>
                <TouchableOpacity style={s.shareBtn} onPress={handleShare} activeOpacity={0.85}>
                  <Ionicons name="share-social" size={16} color="#000" />
                  <Text style={s.shareText}>SHARE</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.closeBtn} onPress={() => setSummary(null)} activeOpacity={0.85}>
                  <Text style={s.closeText}>CLOSE</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
};

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center' },
  scroll: { padding: 22 },
  card: { backgroundColor: '#0c0c12', borderRadius: 24, borderWidth: 1, borderColor: C.greenBorder, padding: 22, gap: 12, shadowColor: C.green, shadowOpacity: 0.25, shadowRadius: 20, shadowOffset: { width: 0, height: 0 } },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brandDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: C.green, shadowColor: C.green, shadowOpacity: 0.9, shadowRadius: 6 },
  brand: { color: '#fff', fontSize: 13, fontWeight: '900', letterSpacing: 4 },
  statusBadge: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1 },
  statusOk: { borderColor: C.greenBorder, backgroundColor: C.greenDim },
  statusEnd: { borderColor: 'rgba(255,255,255,0.2)', backgroundColor: 'rgba(255,255,255,0.05)' },
  statusText: { fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  traveler: { color: '#fff', fontSize: 26, fontWeight: '900', marginTop: 2 },
  dest: { color: 'rgba(255,255,255,0.6)', fontSize: 14, fontWeight: '600' },
  statsBox: { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', padding: 14, gap: 10, marginTop: 4 },
  statRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  statLabel: { flex: 1, color: 'rgba(255,255,255,0.5)', fontSize: 13 },
  statValue: { color: '#fff', fontSize: 14, fontWeight: '800', fontVariant: ['tabular-nums'] },
  timeline: { gap: 5, marginTop: 2 },
  timelineLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: '900', letterSpacing: 1.2, marginBottom: 2 },
  event: { color: 'rgba(255,255,255,0.6)', fontSize: 12 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 6 },
  shareBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.green, borderRadius: 14, paddingVertical: 15 },
  shareText: { color: '#000', fontWeight: '900', fontSize: 13, letterSpacing: 1 },
  closeBtn: { paddingHorizontal: 22, alignItems: 'center', justifyContent: 'center', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  closeText: { color: 'rgba(255,255,255,0.7)', fontWeight: '900', fontSize: 13, letterSpacing: 1 },
});
