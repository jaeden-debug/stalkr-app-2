import { create } from 'zustand';
import type { Session, SessionWatcher } from '@/types/models';
import * as sessionService from '@/services/sessions';
import * as eventService from '@/services/groupEvents';
import { sendPushNotification, sendLocalNotification } from '@/services/notifications';
import { openSms, openEmail } from '@/utils/contactActions';
import { useAuthStore } from './useAuthStore';
import { useGroupStore } from './useGroupStore';

export interface JourneyWatcher {
  key: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  userId?: string | null;
  pushToken?: string | null;
  source: 'emergency' | 'contact' | 'manual';
}

export interface JourneyPrefill {
  destinationName?: string;
  destinationAddress?: string;
  destinationLat?: number;
  destinationLng?: number;
}

export interface StartJourneyOptions {
  name: string;
  destinationName?: string;
  destinationAddress?: string;
  destinationLat?: number;
  destinationLng?: number;
  message?: string;
  watchers: JourneyWatcher[];
}

interface SessionStoreState {
  sessions: Session[];
  activeSession: Session | null;       // group session (for the group feed)
  activeJourneySession: Session | null; // personal journey session (for tracking)
  isLoading: boolean;
  error: string | null;

  /** Transient hand-off used to pre-fill the New Journey sheet (e.g. from map search). */
  journeyDraft: {
    name: string;
    destinationName: string;
    destinationLat?: number;
    destinationLng?: number;
  } | null;
  setJourneyDraft: (d: SessionStoreState['journeyDraft']) => void;
  clearJourneyDraft: () => void;

  // Unified Journey sheet
  journeySheetOpen: boolean;
  journeyPrefill: JourneyPrefill | null;
  summarySession: Session | null;
  openJourneySheet: (prefill?: JourneyPrefill | null) => void;
  closeJourneySheet: () => void;
  setSummarySession: (s: Session | null) => void;
  startJourney: (opts: StartJourneyOptions) => Promise<Session | null>;

  loadGroupSessions: (groupId: string) => Promise<void>;
  loadMyJourneySession: () => Promise<void>;
  createSession: (options: {
    name: string;
    groupId?: string | null;
    travelerName?: string;
    destinationName?: string;
    destinationLat?: number;
    destinationLng?: number;
    autoEndAt?: string;
    notifyOnEnd?: boolean;
    watchers?: { userId: string; pushToken: string | null }[];
  }) => Promise<Session | null>;
  joinSessionByCode: (code: string) => Promise<Session | null>;
  endSession: (sessionId: string) => Promise<boolean>;
  markArrived: (sessionId: string) => Promise<boolean>;
  setActiveSession: (session: Session | null) => void;
  clearError: () => void;
}

export const useSessionStore = create<SessionStoreState>()((set, get) => ({
  sessions: [],
  activeSession: null,
  activeJourneySession: null,
  isLoading: false,
  error: null,
  journeyDraft: null,

  setJourneyDraft: (d) => set({ journeyDraft: d }),
  clearJourneyDraft: () => set({ journeyDraft: null }),

  journeySheetOpen: false,
  journeyPrefill: null,
  summarySession: null,
  openJourneySheet: (prefill = null) => set({ journeySheetOpen: true, journeyPrefill: prefill }),
  closeJourneySheet: () => set({ journeySheetOpen: false, journeyPrefill: null }),
  setSummarySession: (s) => set({ summarySession: s }),

  startJourney: async (opts) => {
    const userId = useAuthStore.getState().session?.user?.id;
    const profile = useAuthStore.getState().profile;
    if (!userId) return null;
    const groupId = useGroupStore.getState().activeGroupId;
    const travelerName = profile?.nickname || profile?.display_name || 'Someone';

    const session = await sessionService.createSession({
      group_id: groupId ?? null,
      created_by: userId,
      name: opts.name || opts.destinationName || 'Journey',
      traveler_name: travelerName,
      destination_name: opts.destinationName ?? null,
      destination_latitude: opts.destinationLat ?? null,
      destination_longitude: opts.destinationLng ?? null,
      message: opts.message ?? null,
      notify_on_end: true,
    } as any);
    if (!session) return null;

    // Watcher records.
    for (const w of opts.watchers) {
      await sessionService.addWatcher(session.id, {
        userId: w.userId ?? null, name: w.name, phone: w.phone ?? null,
        email: w.email ?? null, pushToken: w.pushToken ?? null, inviteSent: true,
      }).catch(() => {});
    }

    // Invite delivery.
    const url = sessionService.buildWatchUrl(session.watch_token);
    const dest = opts.destinationName ? ` to ${opts.destinationName}` : '';
    const inviteMsg = `${opts.message ? opts.message + '\n\n' : ''}${travelerName} is sharing a journey${dest} with you on Stalkr. Follow live progress and get notified when they arrive safely: ${url}`;
    const phones = opts.watchers.filter((w) => w.phone).map((w) => w.phone as string);
    const emails = opts.watchers.filter((w) => !w.phone && w.email).map((w) => w.email as string);
    if (phones.length) openSms(phones, inviteMsg).catch(() => {});
    if (emails.length) openEmail(emails, `${travelerName}'s journey on Stalkr`, inviteMsg).catch(() => {});

    // In-app watchers get a push.
    const memberWatchers = opts.watchers.filter((w) => w.pushToken && w.userId);
    if (memberWatchers.length) {
      sendPushNotification(
        memberWatchers.map((w) => w.pushToken as string),
        `${travelerName} started a journey`,
        opts.destinationName ? `Heading to ${opts.destinationName}. Tap to follow live.` : 'Tap to follow their live progress.',
        { type: 'general', sessionId: session.id },
        'default',
        memberWatchers.map((w) => w.userId as string),
      ).catch(() => {});
    }

    // Activity events (only when crew-tied).
    if (groupId) {
      eventService.logEvent(groupId, userId, 'journey_started',
        `Journey started${dest}`, opts.destinationName ? `${travelerName} is heading to ${opts.destinationName}.` : undefined).catch(() => {});
      if (opts.watchers.length) {
        eventService.logEvent(groupId, userId, 'journey_invite_sent',
          `Invited ${opts.watchers.length} watcher${opts.watchers.length === 1 ? '' : 's'}`, undefined).catch(() => {});
      }
    }

    set((s) => ({
      sessions: [session, ...s.sessions],
      activeJourneySession: session,
      journeySheetOpen: false,
      journeyPrefill: null,
    }));
    return session;
  },

  loadGroupSessions: async (groupId) => {
    set({ isLoading: true, error: null });
    const sessions = await sessionService.fetchGroupSessions(groupId);
    const active = sessions.find((s) => s.is_active) ?? null;
    set({ sessions, activeSession: active, isLoading: false });
  },

  loadMyJourneySession: async () => {
    const userId = useAuthStore.getState().session?.user?.id;
    if (!userId) return;
    const session = await sessionService.fetchMyActiveJourneySession(userId);
    set({ activeJourneySession: session });
  },

  createSession: async (options) => {
    const userId = useAuthStore.getState().session?.user?.id;
    const profile = useAuthStore.getState().profile;
    if (!userId) return null;

    const travelerName =
      options.travelerName ??
      profile?.nickname ??
      profile?.display_name ??
      'Someone';

    const session = await sessionService.createSession({
      group_id: options.groupId ?? null,
      created_by: userId,
      name: options.name,
      traveler_name: travelerName,
      destination_name: options.destinationName ?? null,
      destination_latitude: options.destinationLat ?? null,
      destination_longitude: options.destinationLng ?? null,
      auto_end_at: options.autoEndAt ?? null,
      notify_on_end: options.notifyOnEnd ?? true,
    });

    if (!session) return null;

    // Add watchers
    if (options.watchers?.length) {
      await Promise.all(
        options.watchers.map((w) =>
          sessionService.addMemberWatcher(session.id, w.userId, w.pushToken),
        ),
      );
    }

    // Log to group feed if group-tied
    const groupId = options.groupId ?? useGroupStore.getState().activeGroupId;
    if (groupId) {
      await eventService.logEvent(
        groupId,
        userId,
        'session_started',
        `Journey started: ${options.name}`,
        options.destinationName ? `Heading to ${options.destinationName}` : undefined,
      );
    }

    set((s) => ({
      sessions: [session, ...s.sessions],
      activeSession: s.activeSession ?? (options.groupId ? session : s.activeSession),
      activeJourneySession: session,
    }));

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
    const session = get().sessions.find((s) => s.id === sessionId)
      ?? get().activeJourneySession;
    const ok = await sessionService.endSession(sessionId);
    if (ok) {
      set((s) => ({
        sessions: s.sessions.map((sess) =>
          sess.id === sessionId ? { ...sess, is_active: false, status: 'cancelled' } : sess,
        ),
        activeSession: s.activeSession?.id === sessionId ? null : s.activeSession,
        activeJourneySession: s.activeJourneySession?.id === sessionId ? null : s.activeJourneySession,
      }));
      const wasActiveJourney = session && session.status === 'active';
      if (session) {
        const now = new Date().toISOString();
        set({ summarySession: { ...session, is_active: false, status: 'cancelled', ended_at: now } });
      }
      const groupId = session?.group_id ?? useGroupStore.getState().activeGroupId;
      if (session && userId && groupId) {
        await eventService.logEvent(groupId, userId, wasActiveJourney ? 'journey_cancelled' : 'session_ended', `Journey ended: ${session.name}`);
      }
    }
    return ok;
  },

  markArrived: async (sessionId) => {
    const userId = useAuthStore.getState().session?.user?.id;
    const session = get().sessions.find((s) => s.id === sessionId)
      ?? get().activeJourneySession;
    const ok = await sessionService.markSessionArrived(sessionId);
    if (ok) {
      set((s) => ({
        sessions: s.sessions.map((sess) =>
          sess.id === sessionId
            ? { ...sess, is_active: false, status: 'arrived', arrived_at: new Date().toISOString() }
            : sess,
        ),
        activeSession: s.activeSession?.id === sessionId ? null : s.activeSession,
        activeJourneySession: null,
      }));
      // Show the styled Journey Summary to the traveler.
      if (session) {
        const now = new Date().toISOString();
        set({ summarySession: { ...session, is_active: false, status: 'arrived', arrived_at: now, ended_at: now } });
        sendLocalNotification('You arrived safely', 'Journey complete.', { type: 'arrival', sessionId }, 'safety').catch(() => {});
      }
      const groupId = session?.group_id ?? useGroupStore.getState().activeGroupId;
      if (session && userId && groupId) {
        await eventService.logEvent(
          groupId, userId, 'journey_arrived',
          `Arrived safely${session.destination_name ? `: ${session.destination_name}` : ''}`,
          `${session.traveler_name ?? 'A crew member'} reached their destination.`,
        );
        eventService.logEvent(groupId, userId, 'journey_completed', `Journey completed: ${session.name}`, undefined).catch(() => {});
      }
      // Trigger arrival email Edge Function (fire and forget)
      if (session) {
        const fnUrl = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/send-arrival-email`;
        fetch(fnUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId }),
        }).catch(() => {});
      }
    }
    return ok;
  },

  setActiveSession: (session) => set({ activeSession: session }),
  clearError: () => set({ error: null }),
}));
