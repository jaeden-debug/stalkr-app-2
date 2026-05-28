import { create } from 'zustand';
import type { Group, GroupMember } from '@/types/models';
import * as groupService from '@/services/groups';
import * as eventService from '@/services/groupEvents';
import { useAuthStore } from './useAuthStore';

interface GroupState {
  groups: Group[];
  activeGroupId: string | null;
  groupMembers: GroupMember[];
  isLoading: boolean;
  membersLoading: boolean;
  error: string | null;

  /** Derived: the currently active group object */
  readonly activeGroup: Group | null;

  loadGroups: () => Promise<void>;
  createGroup: (name: string, type?: string, enforceTracking?: boolean) => Promise<Group | null>;
  joinByInviteCode: (code: string) => Promise<Group | null>;
  leaveGroup: (groupId: string) => Promise<boolean>;
  deleteGroup: (groupId: string) => Promise<boolean>;
  updateGroup: (
    groupId: string,
    updates: Partial<Pick<Group, 'name' | 'tracking_mode' | 'invite_enabled'>>,
  ) => Promise<boolean>;
  setActiveGroupId: (id: string | null) => void;
  loadGroupMembers: (groupId: string) => Promise<void>;
  updateMember: (memberId: string, updates: Partial<GroupMember>) => Promise<boolean>;
  removeMember: (memberId: string) => Promise<boolean>;
  getActiveGroup: () => Group | null;
  clearError: () => void;
}

export const useGroupStore = create<GroupState>()((set, get) => ({
  groups: [],
  activeGroupId: null,
  groupMembers: [],
  isLoading: false,
  membersLoading: false,
  error: null,

  get activeGroup() {
    const { groups, activeGroupId } = get();
    return groups.find((g) => g.id === activeGroupId) ?? null;
  },

  loadGroups: async () => {
    const userId = useAuthStore.getState().session?.user?.id;
    if (!userId) return;
    set({ isLoading: true, error: null });
    const groups = await groupService.fetchMyGroups(userId);
    set({ groups, isLoading: false });
    if (!get().activeGroupId && groups.length > 0) {
      set({ activeGroupId: groups[0].id });
    }
  },

  createGroup: async (name, type = 'custom', enforceTracking = false) => {
    const userId = useAuthStore.getState().session?.user?.id;
    if (!userId) return null;
    const group = await groupService.createGroup({
      name,
      type: type as any,
      created_by: userId,
      tracking_mode: enforceTracking ? 'enforced' : 'flexible',
    });
    if (group) {
      set((s) => ({ groups: [group, ...s.groups], activeGroupId: group.id }));
      await eventService.logEvent(group.id, userId, 'member_joined', `${name} created`, `Crew "${name}" was created.`);
    }
    return group;
  },

  joinByInviteCode: async (code) => {
    const userId = useAuthStore.getState().session?.user?.id;
    if (!userId) return null;
    const group = await groupService.joinGroupByInviteCode(code, userId);
    if (group) {
      set((s) => {
        const exists = s.groups.find((g) => g.id === group.id);
        return {
          groups: exists ? s.groups : [group, ...s.groups],
          activeGroupId: group.id,
        };
      });
      await eventService.logEvent(group.id, userId, 'member_joined', 'Member joined', `A new member joined ${group.name}.`);
    }
    return group;
  },

  leaveGroup: async (groupId) => {
    const userId = useAuthStore.getState().session?.user?.id;
    if (!userId) return false;
    const group = get().groups.find((g) => g.id === groupId);
    const ok = await groupService.leaveGroup(groupId, userId);
    if (ok) {
      set((s) => {
        const groups = s.groups.filter((g) => g.id !== groupId);
        return {
          groups,
          activeGroupId: s.activeGroupId === groupId ? (groups[0]?.id ?? null) : s.activeGroupId,
        };
      });
      if (group) {
        await eventService.logEvent(groupId, userId, 'member_left', 'Member left', `A member left ${group.name}.`);
      }
    }
    return ok;
  },

  deleteGroup: async (groupId) => {
    const ok = await groupService.deleteGroup(groupId);
    if (ok) {
      set((s) => {
        const groups = s.groups.filter((g) => g.id !== groupId);
        return {
          groups,
          activeGroupId: s.activeGroupId === groupId ? (groups[0]?.id ?? null) : s.activeGroupId,
        };
      });
    }
    return ok;
  },

  updateGroup: async (groupId, updates) => {
    const ok = await groupService.updateGroup(groupId, updates);
    if (ok) {
      set((s) => ({
        groups: s.groups.map((g) => (g.id === groupId ? { ...g, ...updates } : g)),
      }));
    }
    return ok;
  },

  setActiveGroupId: (id) => set({ activeGroupId: id }),

  loadGroupMembers: async (groupId) => {
    set({ membersLoading: true });
    const members = await groupService.fetchGroupMembers(groupId);
    set({ groupMembers: members, membersLoading: false });
  },

  updateMember: async (memberId, updates) => {
    const ok = await groupService.updateGroupMember(memberId, updates as any);
    if (ok) {
      set((s) => ({
        groupMembers: s.groupMembers.map((m) => (m.id === memberId ? { ...m, ...updates } : m)),
      }));
    }
    return ok;
  },

  removeMember: async (memberId) => {
    const ok = await groupService.removeGroupMember(memberId);
    if (ok) {
      set((s) => ({ groupMembers: s.groupMembers.filter((m) => m.id !== memberId) }));
    }
    return ok;
  },

  getActiveGroup: () => {
    const { groups, activeGroupId } = get();
    return groups.find((g) => g.id === activeGroupId) ?? null;
  },

  clearError: () => set({ error: null }),
}));
