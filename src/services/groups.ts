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

/**
 * Create a crew and its owner membership atomically.
 *
 * Previously these were two separate client inserts and the SECOND one's error
 * was discarded. If it failed, the result was an orphaned crew with no members:
 * invisible to fetchMyGroups (which reads through group_members), so the user
 * could neither see nor delete it, while the app showed it as owned.
 */
export async function createGroup(insert: DbGroupInsert): Promise<Group | null> {
  const { data, error } = await supabase.rpc('create_crew', {
    p_name: insert.name,
    p_type: insert.type ?? 'custom',
    p_tracking_mode: insert.tracking_mode ?? 'flexible',
  });
  if (error || !data) {
    console.error('[groups] create_crew failed:', error?.message, error?.code);
    return null;
  }
  const group = Array.isArray(data) ? data[0] : data;
  return group ? ({ ...group, member_role: 'owner' } as Group) : null;
}

/** Distinguishable join outcomes, so the UI can say what actually happened. */
export type JoinCrewResult =
  | { ok: true; group: Group }
  | { ok: false; reason: 'invalid_code' | 'auth_required' | 'network'; message: string };

/**
 * Join a crew by invite code.
 *
 * This used to read `groups` directly by invite_code — as a NON-member. The
 * groups_select policy is `USING (is_group_member(id))`, so RLS returned zero
 * rows, .single() errored, and the function returned null. Every join entry
 * point routed through here, so joining a crew by code was impossible.
 *
 * Loosening groups_select was not an option (it would expose every crew's name
 * and invite code to any authenticated user), so the lookup happens in a
 * SECURITY DEFINER RPC that only reveals a crew to a caller who already supplied
 * that crew's valid code. Membership insert is ON CONFLICT DO NOTHING, so
 * accepting twice yields exactly one membership.
 */
export async function joinCrewByInviteCode(code: string): Promise<JoinCrewResult> {
  const { data, error } = await supabase.rpc('join_crew_by_code', {
    p_code: code.trim().toUpperCase(),
  });

  if (error) {
    const raw = `${error.message ?? ''}`;
    if (raw.includes('INVALID_INVITE')) {
      return { ok: false, reason: 'invalid_code', message: 'That invite code is not valid or has been turned off.' };
    }
    if (raw.includes('AUTH_REQUIRED')) {
      return { ok: false, reason: 'auth_required', message: 'Sign in to join a crew.' };
    }
    console.error('[groups] join_crew_by_code failed:', error.message, error.code);
    return { ok: false, reason: 'network', message: 'Could not reach the server. Check your connection and try again.' };
  }

  const group = Array.isArray(data) ? data[0] : data;
  if (!group) {
    return { ok: false, reason: 'invalid_code', message: 'That invite code is not valid or has been turned off.' };
  }
  return { ok: true, group: { ...group, member_role: 'member' } as Group };
}

/** @deprecated Use joinCrewByInviteCode — kept so older call sites still compile. */
export async function joinGroupByInviteCode(code: string, _userId?: string): Promise<Group | null> {
  const result = await joinCrewByInviteCode(code);
  return result.ok ? result.group : null;
}

export type LeaveCrewResult =
  | { ok: true }
  | { ok: false; reason: 'last_owner' | 'error'; message: string };

/**
 * Leave a crew, refusing to orphan it.
 *
 * A plain membership delete let the last owner walk away from a crew that still
 * had members. groups_update and groups_delete both require admin/owner, so the
 * crew became permanently unadministrable — nobody could rename it, change its
 * tracking policy, or delete it.
 */
export async function leaveCrew(groupId: string): Promise<LeaveCrewResult> {
  const { error } = await supabase.rpc('leave_crew', { p_group: groupId });
  if (!error) return { ok: true };
  if (`${error.message ?? ''}`.includes('LAST_OWNER')) {
    return {
      ok: false,
      reason: 'last_owner',
      message: 'You are the only owner. Transfer ownership to someone else, or delete the crew.',
    };
  }
  console.error('[groups] leave_crew failed:', error.message, error.code);
  return { ok: false, reason: 'error', message: 'Could not leave the crew. Please try again.' };
}

/** @deprecated Use leaveCrew — kept so older call sites still compile. */
export async function leaveGroup(groupId: string, _userId?: string): Promise<boolean> {
  return (await leaveCrew(groupId)).ok;
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
    const resolvedName: string = member.displayName ?? 'Unknown';
    member.displayInitials =
      row.initials_override ||
      row.profile?.initials ||
      (resolvedName[0] ?? '?').toUpperCase();
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

export async function transferOwnership(groupId: string, newOwnerId: string): Promise<boolean> {
  const { error } = await supabase.rpc('transfer_crew_ownership', { p_group: groupId, p_new_owner: newOwnerId });
  return !error;
}

/**
 * Rotate a crew's invite code, server-side.
 *
 * The old implementation built the code with Math.random(), which is not a
 * CSPRNG — and this code is the only secret guarding crew membership. Rotation
 * now uses gen_random_uuid() on the server, matching the column default, and is
 * gated on is_group_admin rather than trusting the client to check.
 */
export async function regenerateInviteCode(groupId: string): Promise<string | null> {
  const { data, error } = await supabase.rpc('regenerate_invite_code', { p_group: groupId });
  if (error) {
    console.error('[groups] regenerate_invite_code failed:', error.message, error.code);
    return null;
  }
  return typeof data === 'string' ? data : null;
}
