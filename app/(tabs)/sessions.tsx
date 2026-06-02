/**
 * Sessions — personal journey sharing + group session tracking.
 *
 * Flow:
 *   1. Tap "+ New Journey"
 *   2. Enter destination name (text — coordinates resolved via Google Places on native,
 *      or stored as-is for display if no geocode available)
 *   3. Pick watchers from group members (optional)
 *   4. Tap Start → session created, share sheet opens with watch link
 *   5. Active journey banner shows at top with a "Share Link" and "End" button
 *   6. Arrival detected automatically → session marked arrived, watchers notified
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  Alert,
  FlatList,
  Platform,
  RefreshControl,
  SafeAreaView,
  Share,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ScrollView,
} from 'react-native';
import { useSessionStore } from '@/store/useSessionStore';
import { useGroupStore } from '@/store/useGroupStore';
import { useAuthStore } from '@/store/useAuthStore';
import { Sheet } from '@/components/ui/Sheet';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { EmptyState } from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';
import { buildWatchUrl } from '@/services/sessions';
import { getCrewColor } from '@/constants/map';
import type { Session } from '@/types/models';

function timeAgo(iso: string | null): string {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function SessionsScreen() {
  const toast = useToast();
  const {
    sessions, isLoading, activeJourneySession,
    loadGroupSessions, loadMyJourneySession,
    createSession, endSession, markArrived, joinSessionByCode,
  } = useSessionStore();
  const { activeGroup, groupMembers } = useGroupStore();
  const userId = useAuthStore((s) => s.user?.id);
  const profile = useAuthStore((s) => s.profile);

  // Create sheet state
  const [showCreate, setShowCreate] = useState(false);
  const [sessionName, setSessionName] = useState('');
  const [destination, setDestination] = useState('');
  const [selectedWatchers, setSelectedWatchers] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);

  // Join sheet state
  const [showJoin, setShowJoin] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    if (activeGroup?.id) loadGroupSessions(activeGroup.id);
    loadMyJourneySession();
  }, [activeGroup?.id]);

  const otherMembers = groupMembers.filter((m) => m.user_id !== userId);

  const toggleWatcher = (uid: string) => {
    setSelectedWatchers((prev) => {
      const next = new Set(prev);
      next.has(uid) ? next.delete(uid) : next.add(uid);
      return next;
    });
  };

  const handleCreate = async () => {
    if (!sessionName.trim()) { toast.error('Enter a journey name'); return; }
    setCreating(true);

    const watchers = otherMembers
      .filter((m) => selectedWatchers.has(m.user_id))
      .map((m) => ({ userId: m.user_id, pushToken: m.profile?.push_token ?? null }));

    const session = await createSession({
      name: sessionName.trim(),
      groupId: activeGroup?.id ?? null,
      destinationName: destination.trim() || undefined,
      notifyOnEnd: true,
      watchers,
    });

    setCreating(false);

    if (!session) { toast.error('Failed to start journey'); return; }

    setShowCreate(false);
    setSessionName('');
    setDestination('');
    setSelectedWatchers(new Set());

    // Auto-open share sheet
    await handleShareLink(session);
  };

  const handleShareLink = async (session: Session) => {
    const url = buildWatchUrl(session.watch_token);
    const destText = session.destination_name ? ` to ${session.destination_name}` : '';
    try {
      await Share.share({
        title: `Watch my journey${destText}`,
        message: `${session.traveler_name ?? 'Someone'} is on their way${destText}. Follow live: ${url}`,
        url,
      });
    } catch { /* user cancelled */ }
  };

  const handleEnd = (sessionId: string, sessionName: string) => {
    Alert.alert('End Journey', `End "${sessionName}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'End', style: 'destructive', onPress: async () => {
        const ok = await endSession(sessionId);
        if (ok) toast.success('Journey ended');
        else toast.error('Failed to end journey');
      }},
    ]);
  };

  const handleMarkArrived = async (sessionId: string) => {
    const ok = await markArrived(sessionId);
    if (ok) toast.success('✅ Marked as arrived');
    else toast.error('Failed to mark arrived');
  };

  const handleJoin = async () => {
    if (!joinCode.trim()) { toast.error('Enter an invite code'); return; }
    setJoining(true);
    const session = await joinSessionByCode(joinCode.trim().toUpperCase());
    setJoining(false);
    if (session) {
      setShowJoin(false);
      setJoinCode('');
      toast.success(`Joined "${session.name}"`);
    } else {
      toast.error('Invalid or expired invite code');
    }
  };

  const resetCreate = () => {
    setShowCreate(false);
    setSessionName('');
    setDestination('');
    setSelectedWatchers(new Set());
  };

  const renderSession = ({ item }: { item: Session }) => {
    const isOwner = item.created_by === userId;
    const isActive = item.is_active;
    const arrived = item.status === 'arrived';

    return (
      <View style={[styles.card, arrived && styles.cardArrived]}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardName}>{item.name}</Text>
            {item.destination_name && (
              <Text style={styles.cardDest}>📍 {item.destination_name}</Text>
            )}
          </View>
          <Badge
            label={arrived ? 'Arrived' : isActive ? 'Active' : 'Ended'}
            variant={arrived ? 'live' : isActive ? 'live' : 'offline'}
            dot={isActive}
          />
        </View>

        <Text style={styles.cardMeta}>
          {arrived
            ? `✅ Arrived ${timeAgo(item.arrived_at)}`
            : isActive
            ? `Started ${timeAgo(item.started_at)}`
            : `Ended ${timeAgo(item.ended_at)}`}
        </Text>

        {isActive && isOwner && (
          <View style={styles.cardActions}>
            <TouchableOpacity
              style={styles.shareBtn}
              onPress={() => handleShareLink(item)}
            >
              <Text style={styles.shareBtnText}>🔗  Share Link</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.arrivedBtn}
              onPress={() => handleMarkArrived(item.id)}
            >
              <Text style={styles.arrivedBtnText}>✅  I Arrived</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.endBtn}
              onPress={() => handleEnd(item.id, item.name)}
            >
              <Text style={styles.endBtnText}>End</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  const allSessions = [
    ...(activeJourneySession && !sessions.find((s) => s.id === activeJourneySession.id)
      ? [activeJourneySession]
      : []),
    ...sessions,
  ];

  return (
    <SafeAreaView style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>JOURNEYS</Text>
        <View style={styles.headerBtns}>
          <TouchableOpacity style={styles.joinBtn} onPress={() => setShowJoin(true)}>
            <Text style={styles.joinBtnText}>Join</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.createBtn} onPress={() => setShowCreate(true)}>
            <Text style={styles.createBtnText}>+ New</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Active journey banner */}
      {activeJourneySession && (
        <View style={styles.activeBanner}>
          <View style={styles.activeDot} />
          <View style={{ flex: 1 }}>
            <Text style={styles.activeBannerTitle}>{activeJourneySession.name}</Text>
            {activeJourneySession.destination_name && (
              <Text style={styles.activeBannerDest}>→ {activeJourneySession.destination_name}</Text>
            )}
          </View>
          <TouchableOpacity
            style={styles.activeBannerShare}
            onPress={() => handleShareLink(activeJourneySession)}
          >
            <Text style={styles.activeBannerShareText}>Share</Text>
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={allSessions}
        keyExtractor={(s) => s.id}
        renderItem={renderSession}
        contentContainerStyle={allSessions.length === 0 ? styles.emptyList : styles.list}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={() => {
              if (activeGroup?.id) loadGroupSessions(activeGroup.id);
              loadMyJourneySession();
            }}
            tintColor="#22c55e"
          />
        }
        ListEmptyComponent={
          !isLoading ? (
            <EmptyState
              emoji="🚗"
              title="No journeys yet"
              subtitle="Start a journey to share your live location with anyone — no app required."
              action={{ label: 'Start Journey', onPress: () => setShowCreate(true) }}
            />
          ) : null
        }
      />

      {/* ── Create Journey Sheet ───────────────────────────────── */}
      <Sheet
        visible={showCreate}
        onClose={resetCreate}
        title="New Journey"
        snapHeight={otherMembers.length > 0 ? 580 : 380}
      >
        <ScrollView contentContainerStyle={styles.sheetContent} keyboardShouldPersistTaps="handled">
          <TextInput
            style={styles.input}
            placeholder="Journey name (e.g. Heading home)"
            placeholderTextColor="#5555aa"
            value={sessionName}
            onChangeText={setSessionName}
            autoFocus
            returnKeyType="next"
            selectionColor="#22c55e"
          />
          <TextInput
            style={styles.input}
            placeholder="Destination (optional, e.g. 123 Main St)"
            placeholderTextColor="#5555aa"
            value={destination}
            onChangeText={setDestination}
            returnKeyType="done"
            selectionColor="#22c55e"
          />

          {otherMembers.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>NOTIFY CREW MEMBERS</Text>
              {otherMembers.map((m) => {
                const name = m.nickname_override ?? m.profile?.nickname ?? m.profile?.display_name ?? 'Member';
                const initials = m.initials_override ?? m.profile?.initials ?? name.slice(0, 2).toUpperCase();
                const selected = selectedWatchers.has(m.user_id);
                return (
                  <TouchableOpacity
                    key={m.user_id}
                    style={[styles.watcherRow, selected && styles.watcherRowSelected]}
                    onPress={() => toggleWatcher(m.user_id)}
                    activeOpacity={0.75}
                  >
                    <Avatar
                      uri={m.profile?.avatar_url}
                      initials={initials}
                      displayName={name}
                      size={36}
                      color={getCrewColor(m.user_id)}
                    />
                    <Text style={styles.watcherName}>{name}</Text>
                    <Switch
                      value={selected}
                      onValueChange={() => toggleWatcher(m.user_id)}
                      trackColor={{ false: '#2a2a3a', true: 'rgba(34,197,94,0.4)' }}
                      thumbColor={selected ? '#22c55e' : '#6b7280'}
                      ios_backgroundColor="#2a2a3a"
                    />
                  </TouchableOpacity>
                );
              })}
            </>
          )}

          <View style={styles.shareHint}>
            <Text style={styles.shareHintText}>
              📤 After starting, you'll get a share link — send it to anyone via iMessage, WhatsApp, or any app. They don't need Stalkr installed.
            </Text>
          </View>

          <Button
            label="Start & Share Link"
            onPress={handleCreate}
            loading={creating}
            fullWidth
            size="lg"
          />
        </ScrollView>
      </Sheet>

      {/* ── Join Sheet ─────────────────────────────────────────── */}
      <Sheet
        visible={showJoin}
        onClose={() => { setShowJoin(false); setJoinCode(''); }}
        title="Join Session"
        snapHeight={260}
      >
        <View style={styles.sheetContent}>
          <Text style={styles.sheetHint}>Enter the invite code from the session host.</Text>
          <TextInput
            style={[styles.input, { letterSpacing: 4, textAlign: 'center' }]}
            placeholder="ABCD1234"
            placeholderTextColor="#5555aa"
            value={joinCode}
            onChangeText={setJoinCode}
            autoCapitalize="characters"
            autoFocus
            returnKeyType="done"
            onSubmitEditing={handleJoin}
            selectionColor="#22c55e"
            maxLength={12}
          />
          <Button label="Join Session" onPress={handleJoin} loading={joining} fullWidth size="lg" />
        </View>
      </Sheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#080808' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  title: { color: '#FFFFFF', fontSize: 22, fontWeight: '900', letterSpacing: 1.5 },
  headerBtns: { flexDirection: 'row', gap: 8 },
  joinBtn: {
    backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999,
  },
  joinBtnText: { color: 'rgba(255,255,255,0.8)', fontWeight: '900', fontSize: 11, letterSpacing: 1 },
  createBtn: { backgroundColor: '#4ADE80', paddingHorizontal: 16, paddingVertical: 9, borderRadius: 999 },
  createBtnText: { color: '#000', fontWeight: '900', fontSize: 11, letterSpacing: 1 },

  // Active banner
  activeBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    margin: 14, backgroundColor: 'rgba(74,222,128,0.08)',
    borderRadius: 18, padding: 14, borderWidth: 1, borderColor: 'rgba(74,222,128,0.3)',
  },
  activeDot: {
    width: 10, height: 10, borderRadius: 5, backgroundColor: '#4ADE80',
    shadowColor: '#4ADE80', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.9, shadowRadius: 8,
  },
  activeBannerTitle: { color: '#FFFFFF', fontSize: 14, fontWeight: '900', letterSpacing: 0.3 },
  activeBannerDest:  { color: 'rgba(255,255,255,0.5)', fontSize: 11, marginTop: 2 },
  activeBannerShare: { backgroundColor: '#4ADE80', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999 },
  activeBannerShareText: { color: '#000', fontWeight: '900', fontSize: 11, letterSpacing: 0.8 },

  list:      { padding: 16, gap: 12 },
  emptyList: { flex: 1 },

  card: {
    backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 20, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)', padding: 16, gap: 8,
  },
  cardArrived: { borderColor: 'rgba(74,222,128,0.3)', backgroundColor: 'rgba(74,222,128,0.05)' },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  cardName:   { color: '#FFFFFF', fontSize: 15, fontWeight: '900', letterSpacing: 0.3 },
  cardDest:   { color: 'rgba(255,255,255,0.45)', fontSize: 11, marginTop: 2 },
  cardMeta:   { color: 'rgba(255,255,255,0.3)', fontSize: 11 },
  cardActions: { flexDirection: 'row', gap: 8, marginTop: 8, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.07)' },
  shareBtn: {
    flex: 1, backgroundColor: 'rgba(74,222,128,0.12)', borderRadius: 999,
    padding: 10, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(74,222,128,0.35)',
  },
  shareBtnText: { color: '#4ADE80', fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
  arrivedBtn: {
    flex: 1, backgroundColor: 'rgba(74,222,128,0.08)', borderRadius: 999,
    padding: 10, alignItems: 'center', borderWidth: 1, borderColor: '#4ADE80',
  },
  arrivedBtnText: { color: '#4ADE80', fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
  endBtn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)', alignItems: 'center' },
  endBtnText: { color: '#EF4444', fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },

  sheetContent: { padding: 20, gap: 14 },
  sheetHint:    { color: 'rgba(255,255,255,0.45)', fontSize: 12 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 14, padding: 14, color: '#FFFFFF', fontSize: 15, height: 52,
  },
  sectionLabel: { color: 'rgba(255,255,255,0.35)', fontSize: 9, fontWeight: '900', letterSpacing: 1.6, marginTop: 4 },
  watcherRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, paddingHorizontal: 14,
    borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  watcherRowSelected: { borderColor: 'rgba(74,222,128,0.4)', backgroundColor: 'rgba(74,222,128,0.06)' },
  watcherName: { flex: 1, color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  shareHint: {
    backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  shareHintText: { color: 'rgba(255,255,255,0.45)', fontSize: 12, lineHeight: 18 },
});
