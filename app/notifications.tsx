/**
 * Notification Center — permanent, categorized inbox over group_events with
 * read/unread, mark-all-read, dismiss, category filter, and search.
 */
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { FlatList, RefreshControl, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/services/supabase';
import { fetchGroupEvents } from '@/services/groupEvents';
import { useGroupStore } from '@/store/useGroupStore';
import { useNotifCenterStore } from '@/store/useNotifCenterStore';
import { EmptyState } from '@/components/ui/EmptyState';
import { timeAgo } from '@/utils/time';
import { C } from '@/constants/theme';
import type { GroupEvent } from '@/types/models';
import type { GroupEventType } from '@/types/database';

type Category = 'SOS' | 'Alerts' | 'Crew' | 'Zones' | 'Journeys' | 'Sessions' | 'System';
type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const CATEGORY: Record<GroupEventType, Category> = {
  sos_triggered: 'SOS', sos_cancelled: 'SOS', deadman_triggered: 'SOS', deadman_cancelled: 'SOS',
  checkin_timer_missed: 'Alerts', checkin_timer_completed: 'Alerts', member_offline: 'Alerts', member_online: 'Alerts', low_signal_alert: 'Alerts',
  member_joined: 'Crew', member_left: 'Crew', member_kicked: 'Crew', role_changed: 'Crew',
  zone_entered: 'Zones', zone_left: 'Zones', zone_created: 'Zones', zone_deleted: 'Zones',
  arrival: 'Journeys',
  journey_started: 'Journeys', journey_invite_sent: 'Journeys', journey_watcher_added: 'Journeys',
  journey_arrived: 'Journeys', journey_completed: 'Journeys', journey_cancelled: 'Journeys',
  journey_viewed: 'Journeys', journey_failed_to_notify: 'Alerts',
  session_started: 'Sessions', session_ended: 'Sessions',
  marker_created: 'System', marker_deleted: 'System', danger_marker_added: 'System', rally_point_set: 'System', settings_changed: 'System',
};

const UI: Partial<Record<GroupEventType, { icon: IoniconName; color: string }>> = {
  sos_triggered: { icon: 'alert-circle', color: C.red }, deadman_triggered: { icon: 'pulse', color: C.red },
  sos_cancelled: { icon: 'checkmark-circle', color: C.green }, deadman_cancelled: { icon: 'shield-checkmark', color: C.green },
  checkin_timer_missed: { icon: 'warning', color: C.red }, checkin_timer_completed: { icon: 'checkmark-circle', color: C.green },
  arrival: { icon: 'flag', color: C.green }, member_offline: { icon: 'cloud-offline', color: C.amber }, member_online: { icon: 'cloud-done', color: C.green },
  journey_started: { icon: 'navigate', color: C.blue }, journey_arrived: { icon: 'flag', color: C.green }, journey_completed: { icon: 'checkmark-circle', color: C.green },
  journey_cancelled: { icon: 'close-circle', color: C.amber }, journey_invite_sent: { icon: 'send', color: C.blue },
  zone_entered: { icon: 'enter', color: C.blue }, zone_left: { icon: 'exit', color: C.amber }, zone_created: { icon: 'scan', color: C.green }, zone_deleted: { icon: 'trash', color: 'rgba(255,255,255,0.5)' },
  marker_created: { icon: 'pin', color: C.green }, marker_deleted: { icon: 'trash', color: 'rgba(255,255,255,0.5)' },
  session_started: { icon: 'navigate', color: C.blue }, session_ended: { icon: 'flag', color: 'rgba(255,255,255,0.6)' },
  member_joined: { icon: 'person-add', color: C.green }, member_left: { icon: 'person-remove', color: 'rgba(255,255,255,0.6)' },
  rally_point_set: { icon: 'flag', color: C.amber }, low_signal_alert: { icon: 'cellular', color: C.amber },
};

const FILTERS: ('All' | Category)[] = ['All', 'SOS', 'Alerts', 'Crew', 'Zones', 'Journeys', 'Sessions', 'System'];

export default function NotificationsScreen() {
  const router = useRouter();
  const activeGroupId = useGroupStore((s) => s.activeGroupId);
  const { readIds, dismissedIds, markRead, markReadMany, dismiss, clearUnseen } = useNotifCenterStore();

  const [events, setEvents] = useState<GroupEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'All' | Category>('All');
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    if (!activeGroupId) return;
    setLoading(true);
    setEvents(await fetchGroupEvents(activeGroupId, 150));
    setLoading(false);
  }, [activeGroupId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { clearUnseen(); }, [clearUnseen]);

  useEffect(() => {
    if (!activeGroupId) return;
    const ch = supabase
      .channel(`notif_${activeGroupId}_${Date.now()}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'group_events', filter: `group_id=eq.${activeGroupId}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [activeGroupId, load]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return events.filter((e) => {
      if (dismissedIds[e.id]) return false;
      if (filter !== 'All' && CATEGORY[e.event_type] !== filter) return false;
      if (q && !(`${e.title} ${e.body ?? ''}`.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [events, dismissedIds, filter, query]);

  const unreadVisibleIds = visible.filter((e) => !readIds[e.id]).map((e) => e.id);

  const renderItem = ({ item }: { item: GroupEvent }) => {
    const ui = UI[item.event_type] ?? { icon: 'ellipse' as IoniconName, color: 'rgba(255,255,255,0.5)' };
    const unread = !readIds[item.id];
    const who = item.profile?.nickname || item.profile?.display_name || '';
    return (
      <TouchableOpacity style={[s.row, unread && s.rowUnread]} activeOpacity={0.8} onPress={() => markRead(item.id)}>
        <View style={[s.iconWrap, { borderColor: ui.color + '55', backgroundColor: ui.color + '18' }]}>
          <Ionicons name={ui.icon} size={18} color={ui.color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>{item.title}</Text>
          {!!item.body && <Text style={s.body} numberOfLines={2}>{item.body}</Text>}
          <Text style={s.meta}>{CATEGORY[item.event_type]}{who ? ` · ${who}` : ''} · {timeAgo(item.created_at)}</Text>
        </View>
        {unread && <View style={s.unreadDot} />}
        <TouchableOpacity onPress={() => dismiss(item.id)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="close" size={16} color="rgba(255,255,255,0.4)" />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <TouchableOpacity style={s.iconBtn} onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>NOTIFICATIONS</Text>
        <TouchableOpacity onPress={() => markReadMany(unreadVisibleIds)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} disabled={unreadVisibleIds.length === 0}>
          <Text style={[s.markAll, unreadVisibleIds.length === 0 && { color: 'rgba(255,255,255,0.25)' }]}>Read all</Text>
        </TouchableOpacity>
      </View>

      <View style={s.searchWrap}>
        <Ionicons name="search" size={16} color="rgba(255,255,255,0.4)" />
        <TextInput style={s.search} value={query} onChangeText={setQuery} placeholder="Search notifications" placeholderTextColor="rgba(255,255,255,0.35)" selectionColor={C.green} />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
        {FILTERS.map((f) => (
          <TouchableOpacity key={f} style={[s.chip, filter === f && s.chipActive]} onPress={() => setFilter(f)} activeOpacity={0.8}>
            <Text style={[s.chipText, filter === f && s.chipTextActive]}>{f}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <FlatList
        data={visible}
        keyExtractor={(e) => e.id}
        renderItem={renderItem}
        contentContainerStyle={visible.length === 0 ? s.empty : s.list}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={C.green} />}
        ListEmptyComponent={!loading ? <EmptyState emoji="🔔" title="You're all caught up" subtitle="Crew alerts, zones, journeys, check-ins and SOS events show up here." /> : null}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.border },
  iconBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: '#FFFFFF', fontSize: 15, fontWeight: '900', letterSpacing: 1.2 },
  markAll: { color: C.green, fontSize: 13, fontWeight: '800' },
  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginTop: 12, paddingHorizontal: 14, height: 44, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  search: { flex: 1, color: '#FFFFFF', fontSize: 14 },
  chips: { paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', backgroundColor: 'rgba(255,255,255,0.05)' },
  chipActive: { borderColor: C.greenBorder, backgroundColor: C.greenDim },
  chipText: { color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: '800' },
  chipTextActive: { color: C.green },
  list: { padding: 16, gap: 10 },
  empty: { flex: 1 },
  row: { flexDirection: 'row', gap: 12, alignItems: 'center', backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 14, padding: 14 },
  rowUnread: { borderColor: 'rgba(74,222,128,0.3)', backgroundColor: 'rgba(74,222,128,0.05)' },
  iconWrap: { width: 38, height: 38, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  title: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  body: { color: 'rgba(255,255,255,0.55)', fontSize: 12, marginTop: 2, lineHeight: 16 },
  meta: { color: 'rgba(255,255,255,0.35)', fontSize: 11, marginTop: 4, fontWeight: '600' },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.green },
});
