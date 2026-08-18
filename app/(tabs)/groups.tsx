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
import { useGroupStore } from '@/store/useGroupStore';
import { useAuthStore } from '@/store/useAuthStore';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Sheet } from '@/components/ui/Sheet';
import { useToast } from '@/components/ui/Toast';
import { useAnalytics } from '@/hooks/useAnalytics';
import type { Group } from '@/types/models';

export default function GroupsScreen() {
  const router = useRouter();
  const toast = useToast();
  const {
    groups,
    activeGroupId,
    isLoading,
    loadGroups,
    createGroup,
    joinByInviteCode,
    setActiveGroupId,
  } = useGroupStore();
  const userId = useAuthStore((s) => s.user?.id);
  const { track } = useAnalytics();

  const [showCreateSheet, setShowCreateSheet] = useState(false);
  const [showJoinSheet, setShowJoinSheet] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    loadGroups();
  }, []);

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) { toast.error('Enter a group name'); return; }
    setCreating(true);
    const group = await createGroup(newGroupName.trim());
    setCreating(false);
    if (group) {
      track({ name: 'group_created' });
      setShowCreateSheet(false);
      setNewGroupName('');
      toast.success(`"${group.name}" created!`);
    } else {
      toast.error('Failed to create group');
    }
  };

  const handleJoinGroup = async () => {
    if (!inviteCode.trim()) { toast.error('Enter an invite code'); return; }
    setJoining(true);
    const result = await joinByInviteCode(inviteCode.trim().toUpperCase());
    setJoining(false);
    if (result.ok) {
      track({ name: 'group_joined', properties: { method: 'invite_code' } });
      setShowJoinSheet(false);
      setInviteCode('');
      toast.success(`Joined "${result.group.name}"!`);
    } else {
      // Say what actually went wrong — a network failure and a bad code need
      // different actions from the user.
      toast.error(result.message);
    }
  };

  const handleGroupPress = (group: Group) => {
    setActiveGroupId(group.id);
    router.push(`/groups/${group.id}`);
  };

  const handleSetActive = (group: Group) => {
    setActiveGroupId(group.id);
    toast.success(`${group.name} is now active`);
  };

  const renderGroup = ({ item }: { item: Group }) => {
    const isActive = item.id === activeGroupId;
    const isOwner = item.created_by === userId;

    return (
      <TouchableOpacity
        style={[styles.groupCard, isActive && styles.groupCardActive]}
        onPress={() => handleGroupPress(item)}
        activeOpacity={0.8}
      >
        <View style={styles.groupHeader}>
          <View style={styles.groupEmoji}>
            <Text style={styles.groupEmojiText}>👥</Text>
          </View>
          <View style={styles.groupInfo}>
            <Text style={styles.groupName}>{item.name}</Text>
            <Text style={styles.groupMeta}>
              {(item as any).member_count ?? ''}{(item as any).member_count ? ' members' : 'Tap to view'}
            </Text>
          </View>
          <View style={styles.groupBadges}>
            {isActive && <Badge label="Active" variant="live" dot />}
            {isOwner && <Badge label="Owner" variant="info" />}
          </View>
        </View>
        {!isActive && (
          <TouchableOpacity
            style={styles.setActiveBtn}
            onPress={() => handleSetActive(item)}
          >
            <Text style={styles.setActiveBtnText}>Set Active</Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>My Crew</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerBtn} onPress={() => setShowJoinSheet(true)}>
            <Text style={styles.headerBtnText}>Join</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.headerBtn, styles.headerBtnPrimary]} onPress={() => setShowCreateSheet(true)}>
            <Text style={[styles.headerBtnText, styles.headerBtnPrimaryText]}>+ Create</Text>
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={groups}
        keyExtractor={(g) => g.id}
        renderItem={renderGroup}
        contentContainerStyle={groups.length === 0 ? styles.emptyList : styles.list}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={loadGroups}
            tintColor="#22c55e"
          />
        }
        ListEmptyComponent={
          !isLoading ? (
            <EmptyState
              emoji="👥"
              title="No groups yet"
              subtitle="Create a group or join one with an invite code to start tracking your crew."
              action={{ label: 'Create Group', onPress: () => setShowCreateSheet(true) }}
            />
          ) : null
        }
      />

      {/* Create group sheet */}
      <Sheet
        visible={showCreateSheet}
        onClose={() => { setShowCreateSheet(false); setNewGroupName(''); }}
        title="New Group"
        snapHeight={280}
      >
        <View style={styles.sheetContent}>
          <TextInput
            style={styles.sheetInput}
            placeholder="Group name (e.g. Duck Camp 2025)"
            placeholderTextColor="#5555aa"
            value={newGroupName}
            onChangeText={setNewGroupName}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={handleCreateGroup}
            selectionColor="#22c55e"
          />
          <Button
            label="Create Group"
            onPress={handleCreateGroup}
            loading={creating}
            fullWidth
            size="lg"
          />
        </View>
      </Sheet>

      {/* Join group sheet */}
      <Sheet
        visible={showJoinSheet}
        onClose={() => { setShowJoinSheet(false); setInviteCode(''); }}
        title="Join Group"
        snapHeight={280}
      >
        <View style={styles.sheetContent}>
          <TextInput
            style={[styles.sheetInput, styles.codeInput]}
            placeholder="INVITE CODE"
            placeholderTextColor="#5555aa"
            value={inviteCode}
            onChangeText={(t) => setInviteCode(t.toUpperCase())}
            autoCapitalize="characters"
            autoFocus
            maxLength={8}
            returnKeyType="done"
            onSubmitEditing={handleJoinGroup}
            selectionColor="#22c55e"
          />
          <Button label="Join Group" onPress={handleJoinGroup} loading={joining} fullWidth size="lg" />
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
  headerActions: { flexDirection: 'row', gap: 8 },
  headerBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#1a1a24',
    borderWidth: 1,
    borderColor: '#2a2a3a',
  },
  headerBtnPrimary: { backgroundColor: '#22c55e', borderColor: '#22c55e' },
  headerBtnText: { color: '#e8e8f0', fontSize: 14, fontWeight: '600' },
  headerBtnPrimaryText: { color: '#000' },
  list: { padding: 16, gap: 12 },
  emptyList: { flex: 1 },
  groupCard: {
    backgroundColor: '#1a1a24',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2a2a3a',
    overflow: 'hidden',
  },
  groupCardActive: { borderColor: '#22c55e' },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  groupEmoji: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#2a2a3a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupEmojiText: { fontSize: 20 },
  groupInfo: { flex: 1 },
  groupName: { color: '#e8e8f0', fontSize: 16, fontWeight: '700' },
  groupMeta: { color: '#8888aa', fontSize: 12, marginTop: 2 },
  groupBadges: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', maxWidth: 120, justifyContent: 'flex-end' },
  setActiveBtn: {
    borderTopWidth: 1,
    borderTopColor: '#2a2a3a',
    padding: 10,
    alignItems: 'center',
  },
  setActiveBtnText: { color: '#22c55e', fontSize: 13, fontWeight: '600' },
  sheetContent: { padding: 20, gap: 16 },
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
  codeInput: {
    fontFamily: 'Courier New',
    fontSize: 22,
    textAlign: 'center',
    letterSpacing: 4,
    fontWeight: '700',
  },
});
