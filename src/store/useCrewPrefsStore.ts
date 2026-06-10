/**
 * useCrewPrefsStore — per-crew and per-member notification preferences.
 *
 * Persisted locally (instant + offline) AND synced to Supabase via the
 * crewPrefs service for cross-device permanence. Mirrors the pattern used by
 * useNotificationStore. DB sync is best-effort; the local copy is authoritative
 * if the network/table is unavailable.
 *
 * Layered model:
 *   global defaults (useNotificationStore)  ← baseline
 *   per-crew override (crewZoneActivity, mute) ← this store
 *   per-member override (enter/leave/overstay/mute) ← this store
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import {
  fetchCrewPrefs,
  fetchMemberPrefs,
  upsertCrewPref,
  upsertMemberPref,
} from '@/services/crewPrefs';

export interface CrewPref {
  muted: boolean;
  /** null = inherit the global notifyCrewZoneActivity default */
  crewZoneActivity: boolean | null;
}

export interface MemberPref {
  enter: boolean;
  leave: boolean;
  overstay: boolean;
  muted: boolean;
}

const DEFAULT_CREW: CrewPref = { muted: false, crewZoneActivity: null };
const DEFAULT_MEMBER: MemberPref = { enter: true, leave: true, overstay: true, muted: false };

const memberKey = (groupId: string, targetUserId: string) => `${groupId}:${targetUserId}`;

interface CrewPrefsState {
  crew: Record<string, CrewPref>;                 // keyed by groupId
  member: Record<string, MemberPref>;             // keyed by `${groupId}:${targetUserId}`

  getCrewPref: (groupId: string) => CrewPref;
  getMemberPref: (groupId: string, targetUserId: string) => MemberPref;

  setCrewMuted: (userId: string, groupId: string, muted: boolean) => void;
  setCrewZoneActivity: (userId: string, groupId: string, value: boolean | null) => void;
  setMemberPref: (userId: string, groupId: string, targetUserId: string, patch: Partial<MemberPref>) => void;

  /** Hydrate from Supabase after sign-in (merges over local). */
  hydrate: (userId: string) => Promise<void>;
}

export const useCrewPrefsStore = create<CrewPrefsState>()(
  persist(
    (set, get) => ({
      crew: {},
      member: {},

      getCrewPref: (groupId) => get().crew[groupId] ?? DEFAULT_CREW,
      getMemberPref: (groupId, targetUserId) =>
        get().member[memberKey(groupId, targetUserId)] ?? DEFAULT_MEMBER,

      setCrewMuted: (userId, groupId, muted) => {
        const next = { ...(get().crew[groupId] ?? DEFAULT_CREW), muted };
        set((s) => ({ crew: { ...s.crew, [groupId]: next } }));
        upsertCrewPref(userId, {
          group_id: groupId,
          muted: next.muted,
          notify_crew_zone_activity: next.crewZoneActivity,
          notify_sos: null,
        });
      },

      setCrewZoneActivity: (userId, groupId, value) => {
        const next = { ...(get().crew[groupId] ?? DEFAULT_CREW), crewZoneActivity: value };
        set((s) => ({ crew: { ...s.crew, [groupId]: next } }));
        upsertCrewPref(userId, {
          group_id: groupId,
          muted: next.muted,
          notify_crew_zone_activity: next.crewZoneActivity,
          notify_sos: null,
        });
      },

      setMemberPref: (userId, groupId, targetUserId, patch) => {
        const key = memberKey(groupId, targetUserId);
        const next = { ...(get().member[key] ?? DEFAULT_MEMBER), ...patch };
        set((s) => ({ member: { ...s.member, [key]: next } }));
        upsertMemberPref(userId, {
          group_id: groupId,
          target_user_id: targetUserId,
          notify_enter: next.enter,
          notify_leave: next.leave,
          notify_overstay: next.overstay,
          muted: next.muted,
        });
      },

      hydrate: async (userId) => {
        const [crewRows, memberRows] = await Promise.all([
          fetchCrewPrefs(userId),
          fetchMemberPrefs(userId),
        ]);
        if (crewRows.length) {
          set((s) => {
            const crew = { ...s.crew };
            crewRows.forEach((r) => {
              crew[r.group_id] = { muted: r.muted, crewZoneActivity: r.notify_crew_zone_activity };
            });
            return { crew };
          });
        }
        if (memberRows.length) {
          set((s) => {
            const member = { ...s.member };
            memberRows.forEach((r) => {
              member[memberKey(r.group_id, r.target_user_id)] = {
                enter: r.notify_enter,
                leave: r.notify_leave,
                overstay: r.notify_overstay,
                muted: r.muted,
              };
            });
            return { member };
          });
        }
      },
    }),
    {
      name: 'crew-prefs',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ crew: s.crew, member: s.member }),
    },
  ),
);
