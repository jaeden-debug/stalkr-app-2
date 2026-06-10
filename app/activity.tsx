/**
 * Activity Feed — crew safety + event timeline over group_events.
 */
import React, { useEffect, useState, useCallback } from 'react';
import { FlatList, RefreshControl, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/services/supabase';
import { fetchGroupEvents } from '@/services/groupEvents';
import { useGroupStore } from '@/store/useGroupStore';
import { EmptyState } from '@/components/ui/EmptyState';
import { timeAgo } from '@/utils/time';
import { C } from '@/constants/theme';
import type { GroupEvent } from '@/types/models';
import type { GroupEventType } from '@/types/database';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const EVENT_UI: Partial<Record<GroupEventType, { icon: IoniconName; color: string }>> = {
  sos_triggered:           { icon: 'alert-circle', color: C.red },
  sos_cancelled:           { icon: 'checkmark-circle', color: C.green },
  deadman_triggered:       { icon: 'pulse', color: C.red },
  deadman_cancelled:       { icon: 'shield-checkmark', color: C.green },
  checkin_timer_missed:    { icon: 'warning', color: C.red },
  checkin_timer_completed: { icon: 'checkmark-circle', color: C.green },
  arrival:                 { icon: 'flag', color: C.green },
  member_offline:          { icon: 'cloud-offline', color: C.amber },
  member_online:           { icon: 'cloud-done', color: C.green },
  zone_entered:            { icon: 'enter', color: C.blue },
  zone_left:               { icon: 'exit', color: C.amber },
  zone_created:            { icon: 'scan', color: C.green },
  marker_created:          { icon: 'pin', color: C.green },
  session_started:         { icon: 'navigate', color: C.blue },
  session_ended:           { icon: 'flag', color: 'rgba(255,255,255,0.6)' },
  member_joined:           { icon: 'person-add', color: C.green },
  member_left:             { icon: 'person-remove', color: 'rgba(255,255,255,0.6)' },
  rally_point_set:         { icon: 'flag', color: C.amber },
  low_signal_alert:        { icon: 'cellular', color: C.amber },
};

export default function ActivityScreen() {
  const router = useRouter();
  const activeGroupId = useGroupStore((s) => s.activeGroupId);
  const [events, setEvents] = useState<GroupEvent[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!activeGroupId) return;
    setLoading(true);
    setEvents(await fetchGroupEvents(activeGroupId, 100));
    setLoading(false);
  }, [activeGroupId]);

  useEffect(() => { load(); }, [load]);

  // Live updates.
  useEffect(() => {
    if (!activeGroupId) return;
    const ch = supabase
      .channel(`activity_${activeGroupId}_${Date.now()}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'group_events', filter: `group_id=eq.${activeGroupId}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [activeGroupId, load]);

  const renderItem = ({ item }: { item: GroupEvent }) => {
    const ui = EVENT_UI[item.event_type] ?? { icon: 'ellipse' as IoniconName, color: 'rgba(255,255,255,0.5)' };
    const who = item.profile?.nickname || item.profile?.display_name || '';
    return (
      <View style={s.row}>
        <View style={[s.iconWrap, { borderColor: ui.color + '55', backgroundColor: ui.color + '18' }]}>
          <Ionicons name={ui.icon} size={18} color={ui.color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>{item.title}</Text>
          {!!item.body && <Text style={s.body} numberOfLines={2}>{item.body}</Text>}
          <Text style={s.meta}>{who ? `${who} · ` : ''}{timeAgo(item.created_at)}</Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <TouchableOpacity style={s.iconBtn} onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>ACTIVITY</Text>
        <View style={{ width: 38 }} />
      </View>

      <FlatList
        data={events}
        keyExtractor={(e) => e.id}
        renderItem={renderItem}
        contentContainerStyle={events.length === 0 ? s.empty : s.list}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={C.green} />}
        ListEmptyComponent={!loading ? (
          <EmptyState emoji="📡" title="No activity yet" subtitle="Crew movements, zone crossings, check-ins, journeys and SOS events will appear here." />
        ) : null}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.border },
  iconBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '900', letterSpacing: 1.5 },
  list: { padding: 16, gap: 10 },
  empty: { flex: 1 },
  row: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 14, padding: 14 },
  iconWrap: { width: 38, height: 38, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  title: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  body: { color: 'rgba(255,255,255,0.55)', fontSize: 12, marginTop: 2, lineHeight: 16 },
  meta: { color: 'rgba(255,255,255,0.35)', fontSize: 11, marginTop: 4, fontWeight: '600' },
});
