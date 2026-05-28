import React, { useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useGroupStore } from '@/store/useGroupStore';
import { useAuthStore } from '@/store/useAuthStore';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ActionRow } from '@/components/ui/ActionRow';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Sheet } from '@/components/ui/Sheet';
import { Toggle } from '@/components/ui/Toggle';
import { LoadingOverlay } from '@/components/ui/LoadingOverlay';
import { useToast } from '@/components/ui/Toast';
import { getCrewColor } from '@/constants/map';
import type { GroupMember } from '@/types/models';

export default function GroupDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const {
    groups,
    groupMembers,
    membersLoading,
    loadGroupMembers,
    updateGroup,
    deleteGroup,
    leaveGroup,
    removeMember,
  } = useGroupStore();
  const userId = useAuthStore((s) => s.user?.id);

  const group = groups.find((g) => g.id === id);
  const myMembership = groupMembers.find((m) => m.user_id === userId);
  const isOwner = myMembership?.role === 'owner' || group?.created_by === userId;
  const isAdmin = isOwner || myMembership?.role === 'admin';

  const [showSettings, setShowSettings] = useState(false);
  const [groupName, setGroupName] = useState(group?.name ?? '');
  const [inviteEnabled, setInviteEnabled] = useState(group?.invite_enabled ?? true);
  const [enforcedTracking, setEnforcedTracking] = useState(group?.tracking_mode === 'enforced');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (id) loadGroupMembers(id);
  }, [id]);

  const handleSaveSettings = async () => {
    if (!id) return;
    setSaving(true);
    const ok = await updateGroup(id, {
      name: groupName,
      invite_enabled: inviteEnabled,
      tracking_mode: enforcedTracking ? 'enforced' : 'flexible',
    });
    setSaving(false);
    if (ok) { setShowSettings(false); toast.success('Group settings saved'); }
    else toast.error('Failed to save settings');
  };

  const handleDeleteGroup = () => {
    Alert.alert(
      'Delete Group',
      `Delete "${group?.name}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const ok = await deleteGroup(id!);
            if (ok) { toast.success('Group deleted'); router.back(); }
            else toast.error('Failed to delete group');
          },
        },
      ],
    );
  };

  const handleLeave = () => {
    Alert.alert('Leave Group', `Leave "${group?.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: async () => {
          const ok = await leaveGroup(id!);
          if (ok) { toast.success('Left group'); router.back(); }
          else toast.error('Failed to leave group');
        },
      },
    ]);
  };

  const handleRemoveMember = (member: GroupMember) => {
    if (!isAdmin || member.user_id === userId) return;
    const displayName = member.profile?.display_name ?? 'member';
    Alert.alert('Remove Member', `Remove ${displayName} from this group?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          const ok = await removeMember(member.id);
          if (ok) toast.success(`${displayName} removed`);
          else toast.error('Failed to remove member');
        },
      },
    ]);
  };

  const renderMember = ({ item }: { item: GroupMember }) => {
    const displayName =
      item.nickname_override ||
      item.profile?.nickname ||
      item.profile?.display_name ||
      'Unknown';
    const color = getCrewColor(item.user_id);
    const isMe = item.user_id === userId;

    return (
      <TouchableOpacity
        style={styles.memberRow}
        onLongPress={() => handleRemoveMember(item)}
        activeOpacity={0.8}
      >
        <Avatar
          uri={item.avatar_url_override || item.profile?.avatar_url}
          initials={item.initials_override || item.profile?.initials}
          displayName={displayName}
          size={44}
          color={color}
        />
        <View style={styles.memberInfo}>
          <Text style={styles.memberName}>{displayName}{isMe ? ' (You)' : ''}</Text>
          <Text style={styles.memberRole}>{item.role}</Text>
        </View>
        <Badge
          label={item.status === 'live' ? 'Live' : item.status === 'stale' ? 'Stale' : 'Offline'}
          variant={item.status as any}
          dot
        />
      </TouchableOpacity>
    );
  };

  if (!group) return <LoadingOverlay visible fullScreen />;

  return (
    <SafeAreaView style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>{group.name}</Text>
        {isAdmin && (
          <TouchableOpacity onPress={() => setShowSettings(true)} style={styles.settingsBtn}>
            <Text style={styles.settingsBtnText}>⚙️</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Invite code */}
      {group.invite_enabled && group.invite_code && (
        <View style={styles.inviteCard}>
          <Text style={styles.inviteLabel}>INVITE CODE</Text>
          <Text style={styles.inviteCode}>{group.invite_code}</Text>
          <Text style={styles.inviteHint}>Share this code to invite members</Text>
        </View>
      )}

      {/* Members */}
      <SectionHeader title={`Members (${groupMembers.length})`} />
      {membersLoading ? (
        <LoadingOverlay visible />
      ) : (
        <FlatList
          data={groupMembers}
          keyExtractor={(m) => m.id}
          renderItem={renderMember}
          contentContainerStyle={styles.memberList}
          scrollEnabled={false}
        />
      )}

      {/* Actions */}
      <View style={styles.actions}>
        {!isOwner && (
          <ActionRow
            label="Leave Group"
            leftIcon={<Text>🚪</Text>}
            onPress={handleLeave}
            destructive
            showChevron={false}
          />
        )}
        {isOwner && (
          <ActionRow
            label="Delete Group"
            leftIcon={<Text>🗑️</Text>}
            onPress={handleDeleteGroup}
            destructive
            showChevron={false}
          />
        )}
      </View>

      {/* Settings sheet */}
      <Sheet
        visible={showSettings}
        onClose={() => setShowSettings(false)}
        title="Group Settings"
        snapHeight={420}
      >
        <ScrollView contentContainerStyle={styles.sheetContent}>
          <Text style={styles.sheetLabel}>Group Name</Text>
          <TextInput
            style={styles.sheetInput}
            value={groupName}
            onChangeText={setGroupName}
            placeholder="Group name"
            placeholderTextColor="#5555aa"
            selectionColor="#22c55e"
          />
          <View style={styles.sheetToggle}>
            <View>
              <Text style={styles.sheetToggleLabel}>Invite Link Enabled</Text>
              <Text style={styles.sheetToggleHint}>Allow others to join with code</Text>
            </View>
            <Toggle value={inviteEnabled} onValueChange={setInviteEnabled} />
          </View>
          <View style={styles.sheetToggle}>
            <View>
              <Text style={styles.sheetToggleLabel}>Enforce Tracking</Text>
              <Text style={styles.sheetToggleHint}>Members must share location</Text>
            </View>
            <Toggle value={enforcedTracking} onValueChange={setEnforcedTracking} />
          </View>
          <Button label="Save Settings" onPress={handleSaveSettings} loading={saving} fullWidth size="lg" />
        </ScrollView>
      </Sheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0a0a0f' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a3a',
  },
  backBtn: { padding: 4 },
  backBtnText: { color: '#22c55e', fontSize: 28, fontWeight: '300' },
  title: { flex: 1, color: '#e8e8f0', fontSize: 20, fontWeight: '700' },
  settingsBtn: { padding: 4 },
  settingsBtnText: { fontSize: 22 },
  inviteCard: {
    margin: 16,
    backgroundColor: '#1a1a24',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#22c55e',
    alignItems: 'center',
    gap: 4,
  },
  inviteLabel: { color: '#8888aa', fontSize: 10, letterSpacing: 1.2, textTransform: 'uppercase' },
  inviteCode: { color: '#22c55e', fontSize: 28, fontWeight: '800', fontFamily: 'Courier New', letterSpacing: 4 },
  inviteHint: { color: '#8888aa', fontSize: 12 },
  memberList: { paddingHorizontal: 16, gap: 8 },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a24',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#2a2a3a',
    gap: 12,
  },
  memberInfo: { flex: 1 },
  memberName: { color: '#e8e8f0', fontSize: 15, fontWeight: '600' },
  memberRole: { color: '#8888aa', fontSize: 12, textTransform: 'capitalize', marginTop: 2 },
  actions: { margin: 16, marginTop: 8 },
  sheetContent: { padding: 20, gap: 16 },
  sheetLabel: { color: '#8888aa', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 },
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
  sheetToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#12121a',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#2a2a3a',
  },
  sheetToggleLabel: { color: '#e8e8f0', fontSize: 15, fontWeight: '500' },
  sheetToggleHint: { color: '#8888aa', fontSize: 12, marginTop: 2 },
});
