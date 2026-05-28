import { supabase } from './supabase';
import type { Group, GroupMember } from '@/types/models';
import type { DbGroupInsert, DbGroupUpdate, DbGroupMemberUpdate } from '@/types/database';

export async function fetchMyGroups(userId: string): Promise<Group[]> {
  const { data, error } = await supabase
    .from('group_members')
    .select(`
      role,
      group:groups (
        id, name, type, created_by, invite_code, invite_enabled, tracking_mode, created_at, updated_at
      )
    `)
    .eq('user_id', userId);

  if (error || !data) return [];

  return data
    .filter((row: any) => row.group !== null)
    .map((row: any) => ({
      ...row.group,
      member_role: row.role,
    })) as Group[];
}

export async function createGroup(insert: DbGroupInsert): Promise<Group | null> {
  // Insert group
  const { data: group, error: groupErr } = await supabase
    .from('groups')
    .insert(insert)
    .select()
    .single();
  if (groupErr || !group) return null;

  // Add creator as owner
  await supabase.from('group_members').insert({
    group_id: group.id,
    user_id: insert.created_by,
    role: 'owner',
  });

  return { ...group, member_role: 'owner' } as Group;
}

export async function joinGroupByInviteCode(
  code: string,
  userId: string,
): Promise<Group | null> {
  const { data: group, error } = await supabase
    .from('groups')
    .select('*')
    .eq('invite_code', code.toUpperCase())
    .eq('invite_enabled', true)
    .single();

  if (error || !group) return null;

  // Upsert member (handles re-joining)
  const { error: joinErr } = await supabase.from('group_members').upsert(
    { group_id: group.id, user_id: userId, role: 'member' },
    { onConflict: 'group_id,user_id' },
  );
  if (joinErr) return null;

  return { ...group, member_role: 'member' } as Group;
}

export async function leaveGroup(groupId: string, userId: string): Promise<boolean> {
  const { error } = await supabase
    .from('group_members')
    .delete()
    .eq('group_id', groupId)
    .eq('user_id', userId);
  return !error;
}

export async function deleteGroup(groupId: string): Promise<boolean> {
  const { error } = await supabase.from('groups').delete().eq('id', groupId);
  return !error;
}

export async function updateGroup(groupId: string, updates: DbGroupUpdate): Promise<boolean> {
  const { error } = await supabase
    .from('groups')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', groupId);
  return !error;
}

export async function fetchGroupMembers(groupId: string): Promise<GroupMember[]> {
  const { data, error } = await supabase
    .from('group_members')
    .select(`
      *,
      profile:profiles (id, display_name, nickname, initials, avatar_url, phone)
    `)
    .eq('group_id', groupId);

  if (error || !data) return [];

  return data.map((row: any) => {
    const member = row as GroupMember;
    member.displayName =
      row.nickname_override ||
      row.profile?.nickname ||
      row.profile?.display_name ||
      'Unknown';
    member.displayInitials =
      row.initials_override ||
      row.profile?.initials ||
      (member.displayName[0] ?? '?').toUpperCase();
    member.displayAvatar = row.avatar_url_override || row.profile?.avatar_url || null;
    return member;
  });
}

export async function updateGroupMember(
  memberId: string,
  updates: DbGroupMemberUpdate,
): Promise<boolean> {
  const { error } = await supabase
    .from('group_members')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', memberId);
  return !error;
}

export async function removeGroupMember(memberId: string): Promise<boolean> {
  const { error } = await supabase.from('group_members').delete().eq('id', memberId);
  return !error;
}

export async function regenerateInviteCode(groupId: string): Promise<string | null> {
  // Generate new code on server side by updating a dummy field then letting the DB trigger handle it
  // Since we don't have a trigger, we generate client-side
  const newCode = Math.random().toString(36).substring(2, 10).toUpperCase();
  const { error } = await supabase
    .from('groups')
    .update({ invite_code: newCode, updated_at: new Date().toISOString() })
    .eq('id', groupId);
  return error ? null : newCode;
}
