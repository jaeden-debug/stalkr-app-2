import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Group, GroupMember } from '@/types/models';
import * as groupService from '@/services/groups';
import * as eventService from '@/services/groupEvents';
import { useAuthStore } from './useAuthStore';

/** Guards against a double-tapped "Create crew" producing two crews. */
let createInFlight = false;

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
  joinByInviteCode: (code: string) => Promise<groupService.JoinCrewResult>;
  leaveGroup: (groupId: string) => Promise<groupService.LeaveCrewResult>;
  deleteGroup: (groupId: string) => Promise<groupService.DeleteCrewResult>;
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

export const useGroupStore = create<GroupState>()(
  persist(
  (set, get) => ({
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

    const currentActiveId = get().activeGroupId;
    const stillAMember = !!currentActiveId && groups.some((g) => g.id === currentActiveId);

    if (stillAMember) return;

    // We are no longer in the crew that is currently on screen — either removed
    // by an admin, or it was deleted. Its markers, zones and crew positions are
    // now unauthorized data sitting in memory, so drop them BEFORE switching.
    //
    // Nothing used to do this: loadGroups ran only at launch and on auth change,
    // so a member removed while the app was open kept seeing the crew, its map
    // population and its realtime channel until the app restarted.
    if (currentActiveId) {
      // Lazy require avoids a circular import between the two stores.
      const { useMapStore } = require('./useMapStore');
      useMapStore.getState().suspendPopulation();
      set({ groupMembers: [] });
    }

    set({ activeGroupId: groups.length > 0 ? groups[0].id : null });
  },

  createGroup: async (name, type = 'custom', enforceTracking = false) => {
    const userId = useAuthStore.getState().session?.user?.id;
    if (!userId) return null;
    // Double-tapping "Create" fired two inserts and produced two crews with the
    // same name. The guard lives in the store rather than the button so every
    // entry point (Crews tab, nav drawer) is covered by one rule.
    if (createInFlight) return null;
    createInFlight = true;
    try {
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
    } finally {
      createInFlight = false;
    }
  },

  joinByInviteCode: async (code) => {
    const userId = useAuthStore.getState().session?.user?.id;
    if (!userId) {
      return { ok: false, reason: 'auth_required', message: 'Sign in to join a crew.' };
    }

    const result = await groupService.joinCrewByInviteCode(code);
    if (!result.ok) return result;

    const { group } = result;
    // Idempotent in the store as well as the database: re-accepting an invite
    // must not add a second copy of the crew to the list.
    const alreadyMember = get().groups.some((g) => g.id === group.id);
    set((s) => ({
      groups: alreadyMember ? s.groups : [group, ...s.groups],
      activeGroupId: group.id,
    }));

    if (!alreadyMember) {
      await eventService.logEvent(group.id, userId, 'member_joined', 'Member joined', `A new member joined ${group.name}.`);
    }
    return result;
  },

  leaveGroup: async (groupId) => {
    const userId = useAuthStore.getState().session?.user?.id;
    if (!userId) return { ok: false, reason: 'error', message: 'Sign in first.' };
    const group = get().groups.find((g) => g.id === groupId);
    const result = await groupService.leaveCrew(groupId);
    if (result.ok) {
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
    return result;
  },

  deleteGroup: async (groupId) => {
    const result = await groupService.deleteCrew(groupId);
    if (result.ok) {
      set((s) => {
        const groups = s.groups.filter((g) => g.id !== groupId);
        return {
          groups,
          activeGroupId: s.activeGroupId === groupId ? (groups[0]?.id ?? null) : s.activeGroupId,
        };
      });
      // Drop the deleted crew's map data rather than leaving unauthorized
      // markers and zones in memory.
      const { useMapStore } = require('./useMapStore');
      useMapStore.getState().suspendPopulation();
    }
    return result;
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

  setActiveGroupId: (id) => {
    // Deliberately does NOT touch broadcasting state.
    //
    // This used to mirror the per-crew flag into the global isBroadcasting flag
    // and DEFAULT IT TO TRUE when a crew had no saved entry — so simply
    // switching to a crew you had never opted into marked you as broadcasting,
    // contradicting the default-dark posture.
    //
    // Broadcasting is now decided in exactly one place, from the per-crew map
    // plus crew policy: utils/broadcast.ts. There is nothing to mirror.
    set({ activeGroupId: id });
  },

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
  }),
  {
    name: 'group-store',
    storage: createJSONStorage(() => AsyncStorage),
    partialize: (s) => ({
      activeGroupId: s.activeGroupId,
    }),
  },
));
