import React, { useEffect, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSessionStore } from '@/store/useSessionStore';
import { useGroupStore } from '@/store/useGroupStore';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Sheet } from '@/components/ui/Sheet';
import { useToast } from '@/components/ui/Toast';
import type { Session } from '@/types/models';

function timeAgo(iso: string | null): string {
  if (!iso) return 'unknown';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function SessionsScreen() {
  const router = useRouter();
  const toast = useToast();
  const { sessions, isLoading, loadGroupSessions, createSession, endSession } = useSessionStore();
  const { activeGroup } = useGroupStore();

  const [showCreateSheet, setShowCreateSheet] = useState(false);
  const [sessionName, setSessionName] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (activeGroup?.id) loadGroupSessions(activeGroup.id);
  }, [activeGroup?.id]);

  const handleCreate = async () => {
    if (!activeGroup) { toast.error('Select an active group first'); return; }
    if (!sessionName.trim()) { toast.error('Enter a session name'); return; }
    setCreating(true);
    const session = await createSession(activeGroup.id, sessionName.trim());
    setCreating(false);
    if (session) {
      setShowCreateSheet(false);
      setSessionName('');
      toast.success(`Session "${session.name}" started`);
    } else {
      toast.error('Failed to create session');
    }
  };

  const handleEndSession = async (sessionId: string) => {
    const ok = await endSession(sessionId);
    if (ok) toast.success('Session ended');
    else toast.error('Failed to end session');
  };

  const renderSession = ({ item }: { item: Session }) => (
    <View style={styles.sessionCard}>
      <View style={styles.sessionHeader}>
        <Text style={styles.sessionName}>{item.name}</Text>
        <Badge
          label={item.is_active ? 'Active' : 'Ended'}
          variant={item.is_active ? 'live' : 'offline'}
          dot
        />
      </View>
      <Text style={styles.sessionMeta}>
        Started {timeAgo(item.started_at)}
        {item.destination_name ? ` • To: ${item.destination_name}` : ''}
      </Text>
      {item.is_active && (
        <TouchableOpacity
          style={styles.endBtn}
          onPress={() => handleEndSession(item.id)}
        >
          <Text style={styles.endBtnText}>End Session</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>Sessions</Text>
        {activeGroup && (
          <TouchableOpacity
            style={styles.createBtn}
            onPress={() => setShowCreateSheet(true)}
          >
            <Text style={styles.createBtnText}>+ New</Text>
          </TouchableOpacity>
        )}
      </View>

      {!activeGroup ? (
        <EmptyState
          emoji="👥"
          title="No active group"
          subtitle="Select a group on the Crew tab to manage sessions."
        />
      ) : (
        <FlatList
          data={sessions}
          keyExtractor={(s) => s.id}
          renderItem={renderSession}
          contentContainerStyle={sessions.length === 0 ? styles.emptyList : styles.list}
          refreshControl={
            <RefreshControl
              refreshing={isLoading}
              onRefresh={() => loadGroupSessions(activeGroup.id)}
              tintColor="#22c55e"
            />
          }
          ListEmptyComponent={
            !isLoading ? (
              <EmptyState
                emoji="⚡"
                title="No sessions"
                subtitle="Start a session to track movement and share with your crew."
                action={{ label: 'Start Session', onPress: () => setShowCreateSheet(true) }}
              />
            ) : null
          }
        />
      )}

      <Sheet
        visible={showCreateSheet}
        onClose={() => { setShowCreateSheet(false); setSessionName(''); }}
        title="New Session"
        snapHeight={320}
      >
        <View style={styles.sheetContent}>
          <Text style={styles.sheetHint}>Active group: {activeGroup?.name ?? '—'}</Text>
          <TextInput
            style={styles.sheetInput}
            placeholder="Session name (e.g. Morning Hunt)"
            placeholderTextColor="#5555aa"
            value={sessionName}
            onChangeText={setSessionName}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={handleCreate}
            selectionColor="#22c55e"
          />
          <Button label="Start Session" onPress={handleCreate} loading={creating} fullWidth size="lg" />
        </View>
      </Sheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0a0a0f' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    paddingTop: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a3a',
  },
  title: { color: '#e8e8f0', fontSize: 24, fontWeight: '800' },
  createBtn: {
    backgroundColor: '#22c55e',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
  },
  createBtnText: { color: '#000', fontWeight: '700', fontSize: 14 },
  list: { padding: 16, gap: 12 },
  emptyList: { flex: 1 },
  sessionCard: {
    backgroundColor: '#1a1a24',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2a2a3a',
    padding: 14,
    gap: 6,
  },
  sessionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sessionName: { color: '#e8e8f0', fontSize: 16, fontWeight: '700', flex: 1 },
  sessionMeta: { color: '#8888aa', fontSize: 12 },
  endBtn: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#2a2a3a',
    paddingTop: 10,
    alignItems: 'center',
  },
  endBtnText: { color: '#ef4444', fontSize: 13, fontWeight: '600' },
  sheetContent: { padding: 20, gap: 16 },
  sheetHint: { color: '#8888aa', fontSize: 13 },
  sheetInput: {
    backgroundColor: '#0a0a0f',
    borderWidth: 1,
    borderColor: '#2a2a3a',
    borderRadius: 12,
    padding: 14,
    color: '#e8e8f0',
    fontSize: 16,
    height: 52,
  },
});
