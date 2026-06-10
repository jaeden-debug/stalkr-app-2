import React, { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { uploadCrewAvatar } from '@/services/auth';
import { useGroupStore } from '@/store/useGroupStore';
import { useAuthStore } from '@/store/useAuthStore';
import { useNotificationStore } from '@/store/useNotificationStore';
import { useCrewPrefsStore } from '@/store/useCrewPrefsStore';
import { Avatar } from '@/components/ui/Avatar';
import { Toggle } from '@/components/ui/Toggle';
import { LoadingOverlay } from '@/components/ui/LoadingOverlay';
import { useToast } from '@/components/ui/Toast';
import { getCrewColor } from '@/constants/map';
import { can, assignableRoles, ROLE_LABEL, ROLE_COLOR } from '@/utils/roles';
import { transferOwnership } from '@/services/groups';
import { C } from '@/constants/theme';
import type { GroupMember } from '@/types/models';
import type { MemberRole } from '@/types/database';

export default function CrewSettingsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const {
    groups, groupMembers, membersLoading,
    loadGroupMembers, updateGroup, deleteGroup, leaveGroup, removeMember, updateMember,
  } = useGroupStore();
  const userId = useAuthStore((s) => s.user?.id);

  const globalCrewActivity = useNotificationStore((s) => s.notifyCrewZoneActivity);
  const crewMap = useCrewPrefsStore((s) => s.crew);
  const memberMap = useCrewPrefsStore((s) => s.member);
  const setCrewMuted = useCrewPrefsStore((s) => s.setCrewMuted);
  const setCrewZoneActivity = useCrewPrefsStore((s) => s.setCrewZoneActivity);
  const setMemberPref = useCrewPrefsStore((s) => s.setMemberPref);

  const group = groups.find((g) => g.id === id);
  const myMembership = groupMembers.find((m) => m.user_id === userId);
  const isOwner = myMembership?.role === 'owner' || group?.created_by === userId;
  const isAdmin = isOwner || myMembership?.role === 'admin';

  // My call sign in this crew
  const [callSign, setCallSign] = useState('');
  const [crewInitials, setCrewInitials] = useState('');
  const [savingId, setSavingId] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Crew management (owner)
  const [groupName, setGroupName] = useState(group?.name ?? '');
  const [inviteEnabled, setInviteEnabled] = useState(group?.invite_enabled ?? true);
  const [enforced, setEnforced] = useState(group?.tracking_mode === 'enforced');
  const [savingMgmt, setSavingMgmt] = useState(false);

  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => { if (id) loadGroupMembers(id); }, [id]);
  useEffect(() => {
    setCallSign(myMembership?.nickname_override ?? '');
    setCrewInitials(myMembership?.initials_override ?? '');
  }, [myMembership?.id]);
  useEffect(() => {
    if (group) {
      setGroupName(group.name);
      setInviteEnabled(group.invite_enabled);
      setEnforced(group.tracking_mode === 'enforced');
    }
  }, [group?.id]);

  if (!group) return <LoadingOverlay visible fullScreen />;

  const crewPref = crewMap[group.id] ?? { muted: false, crewZoneActivity: null };
  const effectiveCrewActivity = crewPref.crewZoneActivity ?? globalCrewActivity;

  const handlePickCrewAvatar = async () => {
    if (!myMembership || !userId || !id) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { toast.error('Photo permission needed'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 0.6 });
    if (result.canceled || !result.assets?.[0]?.uri) return;
    setUploadingAvatar(true);
    const url = await uploadCrewAvatar(id, userId, result.assets[0].uri);
    if (url) {
      await updateMember(myMembership.id, { avatar_url_override: url });
      toast.success('Crew photo updated');
    } else toast.error('Upload failed');
    setUploadingAvatar(false);
  };

  const handleSaveIdentity = async () => {
    if (!myMembership) return;
    setSavingId(true);
    const ok = await updateMember(myMembership.id, {
      nickname_override: callSign.trim() || null,
      initials_override: crewInitials.trim().toUpperCase() || null,
    });
    setSavingId(false);
    if (ok) toast.success('Call sign saved'); else toast.error('Failed to save');
  };

  const handleSaveMgmt = async () => {
    setSavingMgmt(true);
    const ok = await updateGroup(group.id, {
      name: groupName.trim() || group.name,
      invite_enabled: inviteEnabled,
      tracking_mode: enforced ? 'enforced' : 'flexible',
    });
    setSavingMgmt(false);
    if (ok) toast.success('Crew settings saved'); else toast.error('Failed to save');
  };

  const handleDelete = () => {
    Alert.alert('Delete Crew', `Delete "${group.name}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        const ok = await deleteGroup(group.id);
        if (ok) { toast.success('Crew deleted'); router.back(); } else toast.error('Failed to delete');
      } },
    ]);
  };

  const handleLeave = () => {
    Alert.alert('Leave Crew', `Leave "${group.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Leave', style: 'destructive', onPress: async () => {
        const ok = await leaveGroup(group.id);
        if (ok) { toast.success('Left crew'); router.back(); } else toast.error('Failed to leave');
      } },
    ]);
  };

  const handleRemoveMember = (m: GroupMember) => {
    if (!isAdmin || m.user_id === userId) return;
    const name = m.nickname_override ?? m.profile?.display_name ?? 'member';
    Alert.alert('Remove Member', `Remove ${name} from this crew?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => {
        const ok = await removeMember(m.id);
        if (ok) toast.success(`${name} removed`); else toast.error('Failed to remove');
      } },
    ]);
  };

  const myRole = (myMembership?.role ?? 'member') as MemberRole;
  const canManageMembers = can(myRole, 'manageMembers');
  const roleOptions = assignableRoles(myRole);

  const handleSetRole = async (m: GroupMember, role: MemberRole) => {
    if (m.role === role) return;
    const ok = await updateMember(m.id, { role });
    if (ok) toast.success(`${ROLE_LABEL[role]} role set`); else toast.error('Failed to set role');
  };

  const handleTransfer = (m: GroupMember) => {
    const name = m.nickname_override ?? m.profile?.display_name ?? 'this member';
    Alert.alert('Transfer Ownership', `Make ${name} the owner? You'll become an admin. This cannot be undone by you afterward.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Transfer', style: 'destructive', onPress: async () => {
        const ok = await transferOwnership(group.id, m.user_id);
        if (ok) { toast.success('Ownership transferred'); loadGroupMembers(group.id); } else toast.error('Transfer failed');
      } },
    ]);
  };

  const toggleExpand = (uid: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(uid) ? next.delete(uid) : next.add(uid);
      return next;
    });

  const otherMembers = groupMembers.filter((m) => m.user_id !== userId);

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <TouchableOpacity style={s.iconBtn} onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={s.title} numberOfLines={1}>{group.name.toUpperCase()}</Text>
        <View style={{ width: 38 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          {/* Invite code */}
          {group.invite_enabled && group.invite_code && (
            <View style={s.inviteCard}>
              <Text style={s.inviteLabel}>INVITE CODE</Text>
              <Text style={s.inviteCode}>{group.invite_code}</Text>
              <Text style={s.inviteHint}>Share this code to add members</Text>
            </View>
          )}

          {/* Your identity in this crew */}
          <Text style={s.sectionLabel}>YOUR IDENTITY IN THIS CREW</Text>
          <View style={s.card}>
            <View style={{ alignItems: 'center', gap: 6, paddingBottom: 4 }}>
              <TouchableOpacity onPress={handlePickCrewAvatar} activeOpacity={0.85} disabled={uploadingAvatar}>
                <Avatar
                  uri={myMembership?.avatar_url_override || myMembership?.profile?.avatar_url}
                  initials={(crewInitials || myMembership?.initials_override || myMembership?.profile?.initials) ?? undefined}
                  displayName={callSign || 'You'}
                  size={72}
                  color={C.green}
                />
                <View style={s.crewAvatarBadge}><Ionicons name="camera" size={13} color="#000" /></View>
              </TouchableOpacity>
              <Text style={s.crewAvatarHint}>{uploadingAvatar ? 'Uploading…' : 'Tap to set a crew-only photo'}</Text>
            </View>
            <Text style={s.fieldLabel}>CALL SIGN</Text>
            <TextInput
              style={s.input}
              value={callSign}
              onChangeText={setCallSign}
              placeholder="Defaults to your profile name"
              placeholderTextColor="rgba(255,255,255,0.3)"
              selectionColor={C.green}
              maxLength={24}
            />
            <Text style={s.fieldLabel}>INITIALS</Text>
            <TextInput
              style={s.input}
              value={crewInitials}
              onChangeText={setCrewInitials}
              placeholder="e.g. JD"
              placeholderTextColor="rgba(255,255,255,0.3)"
              selectionColor={C.green}
              autoCapitalize="characters"
              maxLength={3}
            />
            <TouchableOpacity style={[s.saveBtn, savingId && { opacity: 0.6 }]} onPress={handleSaveIdentity} disabled={savingId} activeOpacity={0.85}>
              <Text style={s.saveBtnText}>{savingId ? 'SAVING...' : 'SAVE CALL SIGN'}</Text>
            </TouchableOpacity>
          </View>

          {/* This crew's alerts */}
          <Text style={s.sectionLabel}>THIS CREW'S ALERTS</Text>
          <View style={s.card}>
            <Row label="Mute this crew" sub="Silence all alerts from this crew" value={crewPref.muted}
              onChange={(v) => userId && setCrewMuted(userId, group.id, v)} />
            <Row label="Crew zone activity" sub={`Alerts when crew members enter/leave zones${crewPref.crewZoneActivity == null ? ' (following global default)' : ''}`}
              value={effectiveCrewActivity}
              disabled={crewPref.muted}
              onChange={(v) => userId && setCrewZoneActivity(userId, group.id, v)} last />
          </View>

          {/* Per-member alerts */}
          <Text style={s.sectionLabel}>MEMBERS ({groupMembers.length})</Text>
          {membersLoading ? (
            <LoadingOverlay visible />
          ) : (
            <View style={s.card}>
              {groupMembers.map((m, idx) => {
                const name = m.nickname_override || m.profile?.nickname || m.profile?.display_name || 'Unknown';
                const isMe = m.user_id === userId;
                const mp = memberMap[`${group.id}:${m.user_id}`] ?? { enter: true, leave: true, overstay: true, muted: false };
                const open = expanded.has(m.user_id);
                return (
                  <View key={m.id} style={[s.memberBlock, idx > 0 && s.memberDivider]}>
                    <TouchableOpacity
                      style={s.memberRow}
                      onPress={() => !isMe && toggleExpand(m.user_id)}
                      onLongPress={() => handleRemoveMember(m)}
                      activeOpacity={isMe ? 1 : 0.7}
                    >
                      <Avatar uri={m.avatar_url_override || m.profile?.avatar_url} initials={m.initials_override || m.profile?.initials} displayName={name} size={40} color={getCrewColor(m.user_id)} />
                      <View style={{ flex: 1 }}>
                        <Text style={s.memberName}>{name}{isMe ? ' (You)' : ''}</Text>
                        <View style={s.roleRow}>
                          <View style={[s.roleBadge, { borderColor: ROLE_COLOR[m.role] }]}>
                            <Text style={[s.roleBadgeText, { color: ROLE_COLOR[m.role] }]}>{ROLE_LABEL[m.role].toUpperCase()}</Text>
                          </View>
                          {!isMe && mp.muted && <Text style={s.mutedTag}>muted</Text>}
                        </View>
                      </View>
                      {!isMe && <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color="rgba(255,255,255,0.4)" />}
                    </TouchableOpacity>

                    {!isMe && open && canManageMembers && (
                      <View style={s.roleManage}>
                        <Text style={s.roleManageLabel}>ROLE</Text>
                        <View style={s.roleChips}>
                          {roleOptions.map((r) => (
                            <TouchableOpacity key={r} style={[s.roleChip, m.role === r && s.roleChipActive]} onPress={() => handleSetRole(m, r)} activeOpacity={0.8}>
                              <Text style={[s.roleChipText, m.role === r && { color: C.green }]}>{ROLE_LABEL[r]}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                        {isOwner && (
                          <TouchableOpacity style={s.transferBtn} onPress={() => handleTransfer(m)} activeOpacity={0.85}>
                            <Ionicons name="ribbon" size={14} color={C.amber} />
                            <Text style={s.transferText}>Transfer ownership</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    )}

                    {!isMe && open && userId && (
                      <View style={s.memberPrefs}>
                        <Row label="Mute this member" sub="Ignore all their alerts" value={mp.muted}
                          onChange={(v) => setMemberPref(userId, group.id, m.user_id, { muted: v })} small />
                        <Row label="Enters a zone" value={mp.enter} disabled={mp.muted}
                          onChange={(v) => setMemberPref(userId, group.id, m.user_id, { enter: v })} small />
                        <Row label="Leaves a zone" value={mp.leave} disabled={mp.muted}
                          onChange={(v) => setMemberPref(userId, group.id, m.user_id, { leave: v })} small />
                        <Row label="Overstays a zone" value={mp.overstay} disabled={mp.muted}
                          onChange={(v) => setMemberPref(userId, group.id, m.user_id, { overstay: v })} small last />
                        {isOwner && (
                          <TouchableOpacity style={s.removeBtn} onPress={() => handleRemoveMember(m)}>
                            <Text style={s.removeText}>Remove from crew</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    )}
                  </View>
                );
              })}
              {otherMembers.length === 0 && (
                <Text style={s.emptyMembers}>No other members yet — share the invite code above.</Text>
              )}
            </View>
          )}

          {/* Crew management (owner) */}
          {isOwner && (
            <>
              <Text style={s.sectionLabel}>CREW MANAGEMENT</Text>
              <View style={s.card}>
                <Text style={s.fieldLabel}>CREW NAME</Text>
                <TextInput
                  style={s.input}
                  value={groupName}
                  onChangeText={setGroupName}
                  placeholder="Crew name"
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  selectionColor={C.green}
                  maxLength={40}
                />
                <Row label="Invite link enabled" sub="Allow joining with the code" value={inviteEnabled} onChange={setInviteEnabled} />
                <Row label="Enforce tracking" sub="Members can't go dark in this crew" value={enforced} onChange={setEnforced} last />
                <TouchableOpacity style={[s.saveBtn, savingMgmt && { opacity: 0.6 }]} onPress={handleSaveMgmt} disabled={savingMgmt} activeOpacity={0.85}>
                  <Text style={s.saveBtnText}>{savingMgmt ? 'SAVING...' : 'SAVE CREW SETTINGS'}</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {/* Danger */}
          <TouchableOpacity style={s.dangerBtn} onPress={isOwner ? handleDelete : handleLeave} activeOpacity={0.85}>
            <Ionicons name={isOwner ? 'trash' : 'exit'} size={16} color={C.red} />
            <Text style={s.dangerText}>{isOwner ? 'DELETE CREW' : 'LEAVE CREW'}</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Reusable toggle row ──
const Row: React.FC<{
  label: string; sub?: string; value: boolean; onChange: (v: boolean) => void;
  disabled?: boolean; last?: boolean; small?: boolean;
}> = ({ label, sub, value, onChange, disabled, last, small }) => (
  <View style={[s.row, last && s.rowLast, disabled && { opacity: 0.45 }]}>
    <View style={{ flex: 1, paddingRight: 12 }}>
      <Text style={[s.rowLabel, small && { fontSize: 13 }]}>{label}</Text>
      {sub && <Text style={s.rowSub}>{sub}</Text>}
    </View>
    <Toggle value={value} onValueChange={disabled ? () => {} : onChange} />
  </View>
);

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  iconBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    alignItems: 'center', justifyContent: 'center',
  },
  title: { flex: 1, textAlign: 'center', color: '#FFFFFF', fontSize: 16, fontWeight: '900', letterSpacing: 1 },
  content: { padding: 16, gap: 10, paddingBottom: 40 },

  inviteCard: {
    backgroundColor: C.greenDim, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: C.greenBorder, alignItems: 'center', gap: 4, marginBottom: 6,
  },
  inviteLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 10, fontWeight: '900', letterSpacing: 1.4 },
  inviteCode: { color: C.green, fontSize: 28, fontWeight: '900', fontFamily: 'Courier New', letterSpacing: 4 },
  inviteHint: { color: 'rgba(255,255,255,0.4)', fontSize: 12 },

  sectionLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: '900', letterSpacing: 1.6, marginTop: 12, marginLeft: 4, marginBottom: 2 },
  card: {
    backgroundColor: C.surface, borderRadius: 16, borderWidth: 1, borderColor: C.border, padding: 14, gap: 8,
  },
  fieldLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  crewAvatarBadge: { position: 'absolute', right: -2, bottom: -2, width: 26, height: 26, borderRadius: 13, backgroundColor: C.green, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: C.bg },
  crewAvatarHint: { color: 'rgba(255,255,255,0.45)', fontSize: 11, fontWeight: '600' },
  input: {
    backgroundColor: 'rgba(0,0,0,0.3)', borderWidth: 1, borderColor: C.border,
    borderRadius: 12, paddingHorizontal: 14, height: 50, color: '#FFFFFF', fontSize: 15, fontWeight: '600',
  },
  saveBtn: { backgroundColor: C.green, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  saveBtnText: { color: '#000', fontWeight: '900', fontSize: 12, letterSpacing: 1 },

  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.07)' },
  rowLast: { borderBottomWidth: 0 },
  rowLabel: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  rowSub: { color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 2 },

  memberBlock: { paddingVertical: 4 },
  memberDivider: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.07)', marginTop: 4, paddingTop: 8 },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 },
  memberName: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  roleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  roleBadge: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  roleBadgeText: { fontSize: 8, fontWeight: '900', letterSpacing: 0.8 },
  mutedTag: { color: 'rgba(255,255,255,0.4)', fontSize: 11 },
  roleManage: { marginTop: 8, marginLeft: 4, paddingLeft: 12, borderLeftWidth: 2, borderLeftColor: C.blueBorder, gap: 6 },
  roleManageLabel: { color: 'rgba(255,255,255,0.45)', fontSize: 9, fontWeight: '900', letterSpacing: 1.2 },
  roleChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  roleChip: { paddingHorizontal: 11, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', backgroundColor: 'rgba(255,255,255,0.05)' },
  roleChipActive: { borderColor: C.greenBorder, backgroundColor: C.greenDim },
  roleChipText: { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '800' },
  transferBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8 },
  transferText: { color: C.amber, fontSize: 13, fontWeight: '700' },
  memberPrefs: {
    marginTop: 6, marginLeft: 4, paddingLeft: 12,
    borderLeftWidth: 2, borderLeftColor: C.greenBorder,
  },
  removeBtn: { paddingVertical: 10 },
  removeText: { color: C.red, fontSize: 13, fontWeight: '700' },
  emptyMembers: { color: 'rgba(255,255,255,0.4)', fontSize: 13, paddingVertical: 8, textAlign: 'center' },

  dangerBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginTop: 16, paddingVertical: 15, borderRadius: 14,
    borderWidth: 1, borderColor: C.redBorder, backgroundColor: C.redDim,
  },
  dangerText: { color: C.red, fontWeight: '900', fontSize: 13, letterSpacing: 1 },
});
