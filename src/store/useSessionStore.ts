import { create } from 'zustand';
import type { Session } from '@/types/models';
import * as sessionService from '@/services/sessions';
import * as eventService from '@/services/groupEvents';
import { useAuthStore } from './useAuthStore';

interface SessionStoreState {
  sessions: Session[];
  activeSession: Session | null;
  isLoading: boolean;
  error: string | null;

  loadGroupSessions: (groupId: string) => Promise<void>;
  createSession: (groupId: string, name: string, options?: {
    destinationName?: string;
    destinationLat?: number;
    destinationLng?: number;
    autoEndAt?: string;
    notifyOnEnd?: boolean;
  }) => Promise<Session | null>;
  joinSessionByCode: (code: string) => Promise<Session | null>;
  endSession: (sessionId: string) => Promise<boolean>;
  setActiveSession: (session: Session | null) => void;
  clearError: () => void;
}

export const useSessionStore = create<SessionStoreState>()((set, get) => ({
  sessions: [],
  activeSession: null,
  isLoading: false,
  error: null,

  loadGroupSessions: async (groupId) => {
    set({ isLoading: true, error: null });
    const sessions = await sessionService.fetchGroupSessions(groupId);
    const active = sessions.find((s) => s.is_active) ?? null;
    set({ sessions, activeSession: active, isLoading: false });
  },

  createSession: async (groupId, name, options = {}) => {
    const userId = useAuthStore.getState().session?.user?.id;
    if (!userId) return null;

    const session = await sessionService.createSession({
      group_id: groupId,
      created_by: userId,
      name,
      destination_name: options.destinationName ?? null,
      destination_latitude: options.destinationLat ?? null,
      destination_longitude: options.destinationLng ?? null,
      auto_end_at: options.autoEndAt ?? null,
      notify_on_end: options.notifyOnEnd ?? true,
    });

    if (session) {
      set((s) => ({ sessions: [session, ...s.sessions], activeSession: session }));
      await eventService.logEvent(groupId, userId, 'session_started', `Session started: ${name}`);
    }
    return session;
  },

  joinSessionByCode: async (code) => {
    const userId = useAuthStore.getState().session?.user?.id;
    if (!userId) return null;
    const session = await sessionService.joinSessionByInviteCode(code, userId);
    if (session) {
      set((s) => {
        const exists = s.sessions.find((sess) => sess.id === session.id);
        return { sessions: exists ? s.sessions : [session, ...s.sessions], activeSession: session };
      });
    }
    return session;
  },

  endSession: async (sessionId) => {
    const userId = useAuthStore.getState().session?.user?.id;
    const session = get().sessions.find((s) => s.id === sessionId);
    const ok = await sessionService.endSession(sessionId);
    if (ok) {
      set((s) => ({
        sessions: s.sessions.map((sess) => sess.id === sessionId ? { ...sess, is_active: false } : sess),
        activeSession: s.activeSession?.id === sessionId ? null : s.activeSession,
      }));
      if (session && userId) {
        await eventService.logEvent(session.group_id, userId, 'session_ended', `Session ended: ${session.name}`);
      }
    }
    return ok;
  },

  setActiveSession: (session) => set({ activeSession: session }),
  clearError: () => set({ error: null }),
}));
