/**
 * useSafetyStore — single source of truth for the active safety timer
 * (check-in or dead-man switch). Shared by the Safety Center and the
 * on-map CheckInBadge so they never drift.
 *
 * Flow:
 *   arm → schedules a local reminder notification at the deadline (fires even
 *   in the background). When the deadline passes without confirmation, escalate()
 *   alerts the crew (push + activity event) and, for dead-man, texts emergency
 *   contacts with last known location, battery and timestamp.
 *
 * NOTE: client timers cannot fire when the app is force-killed. The DB function
 * public.escalate_overdue_checkins() (migration 010) is the server-side backstop
 * — schedule it via pg_cron and pair with an edge function for background push.
 */
import { create } from 'zustand';
import * as Notifications from 'expo-notifications';
import * as Haptics from 'expo-haptics';
import {
  createCheckInTimer,
  resolveCheckInTimer,
  deleteCheckInTimer,
  fetchActiveTimer,
  clearActiveTimers,
} from '@/services/checkInTimers';
import { logEvent } from '@/services/groupEvents';
import { fetchEmergencyContacts } from '@/services/emergencyContacts';
import { sendPushNotification, sendLocalNotification } from '@/services/notifications';
import { openSms, mapsLink } from '@/utils/contactActions';
import { useAuthStore } from './useAuthStore';
import { useGroupStore } from './useGroupStore';
import { useMapStore } from './useMapStore';
import { useLocationStore } from './useLocationStore';
import type { CheckInTimer } from '@/types/models';

type SafetyMode = 'checkin' | 'deadman';

interface SafetyState {
  activeTimer: CheckInTimer | null;
  schedNotifId: string | null;
  escalating: boolean;
  centerOpen: boolean;

  setCenterOpen: (v: boolean) => void;
  loadActive: (userId: string) => Promise<void>;
  /**
   * Returns false when the timer could NOT be persisted. A deadman switch that
   * silently fails to arm is worse than no deadman switch, because the user
   * walks away believing someone will come looking.
   */
  arm: (mode: SafetyMode, minutes: number, label?: string) => Promise<boolean>;
  confirm: () => Promise<void>;
  cancel: () => Promise<void>;
  escalate: () => Promise<void>;
}

async function scheduleReminder(mode: SafetyMode, when: Date, label?: string): Promise<string | null> {
  try {
    return await Notifications.scheduleNotificationAsync({
      content: {
        title: mode === 'deadman' ? '⏱️ Dead-man check' : '⏱️ Time to check in',
        body: label ? `"${label}" — open Stalkr and confirm you're OK.` : "Open Stalkr and confirm you're OK.",
        data: { type: 'checkin_due' },
        sound: 'default',
      },
      trigger: { date: when } as any,
    });
  } catch {
    return null;
  }
}

async function cancelScheduled(id: string | null) {
  if (!id) return;
  try { await Notifications.cancelScheduledNotificationAsync(id); } catch {}
}

export const useSafetyStore = create<SafetyState>((set, get) => ({
  activeTimer: null,
  schedNotifId: null,
  escalating: false,
  centerOpen: false,

  setCenterOpen: (v) => set({ centerOpen: v }),

  loadActive: async (userId) => {
    const t = await fetchActiveTimer(userId).catch(() => null);
    set({ activeTimer: t });
  },

  arm: async (mode, minutes, label) => {
    const userId = useAuthStore.getState().user?.id;
    const groupId = useGroupStore.getState().activeGroupId;
    if (!userId) return false;

    await cancelScheduled(get().schedNotifId);
    await clearActiveTimers(userId);

    const adminIds = useGroupStore.getState().groupMembers
      .filter((m) => m.role === 'owner' || m.role === 'admin')
      .map((m) => m.user_id);

    const timer = await createCheckInTimer(userId, minutes, adminIds, groupId, label ?? null, mode);
    if (!timer) {
      // The write failed — most likely authorization. Reporting it is the whole
      // point: the previous behaviour returned silently, so the sheet closed
      // and the user believed their safety timer was running when nothing had
      // been stored at all.
      set({ activeTimer: null, schedNotifId: null, escalating: false });
      return false;
    }

    const schedId = await scheduleReminder(mode, new Date(timer.check_in_at), label);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    set({ activeTimer: timer, schedNotifId: schedId, escalating: false });
    return true;
  },

  confirm: async () => {
    const { activeTimer, schedNotifId } = get();
    if (!activeTimer) return;
    await cancelScheduled(schedNotifId);
    await resolveCheckInTimer(activeTimer.id);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const userId = useAuthStore.getState().user?.id;
    const groupId = activeTimer.group_id;
    if (userId && groupId) {
      logEvent(groupId, userId, 'checkin_timer_completed', 'Checked in safe', undefined).catch(() => {});
    }
    await sendLocalNotification('✓ Checked in', "Your crew knows you're safe.", { type: 'checkin_confirmed' }, 'safety');

    // Recurring safety net — re-arm the same mode + interval ("timer resets").
    const minutes = activeTimer.interval_minutes ?? 30;
    const mode = (activeTimer.mode ?? 'checkin') as SafetyMode;
    set({ activeTimer: null, schedNotifId: null });
    await get().arm(mode, minutes, activeTimer.label ?? undefined);
  },

  cancel: async () => {
    const { activeTimer, schedNotifId } = get();
    if (!activeTimer) return;
    await cancelScheduled(schedNotifId);
    await deleteCheckInTimer(activeTimer.id);

    const userId = useAuthStore.getState().user?.id;
    if ((activeTimer.mode ?? 'checkin') === 'deadman' && userId && activeTimer.group_id) {
      logEvent(activeTimer.group_id, userId, 'deadman_cancelled', 'Dead-man switch stood down', undefined).catch(() => {});
    }
    set({ activeTimer: null, schedNotifId: null, escalating: false });
  },

  escalate: async () => {
    const { activeTimer, escalating } = get();
    if (!activeTimer || escalating || activeTimer.is_resolved) return;
    set({ escalating: true });

    const userId = useAuthStore.getState().user?.id;
    const profile = useAuthStore.getState().profile;
    const groupId = activeTimer.group_id;
    const mode = (activeTimer.mode ?? 'checkin') as SafetyMode;
    const name = profile?.nickname || profile?.display_name || 'A crew member';
    const loc = useMapStore.getState().myLocation;
    const battery = useLocationStore.getState().batteryLevel;
    const crewName = useGroupStore.getState().groups.find((g) => g.id === groupId)?.name ?? 'your crew';

    const title = mode === 'deadman' ? `🆘 Dead-man alert — ${name}` : `⚠️ Check-in missed — ${name}`;
    const body = mode === 'deadman'
      ? `${name} did not respond to their dead-man switch.`
      : `${name} missed a safety check-in.`;

    // Activity event (streams to crew via realtime → local alerts on their devices).
    if (userId && groupId) {
      logEvent(
        groupId, userId,
        mode === 'deadman' ? 'deadman_triggered' : 'checkin_timer_missed',
        mode === 'deadman' ? 'Dead-man switch activated' : 'Check-in missed',
        body,
        loc ? { latitude: loc.latitude, longitude: loc.longitude, battery } : { battery },
      ).catch(() => {});
    }

    // Crew push.
    const crew = useGroupStore.getState().groupMembers.filter((m) => m.user_id !== userId && m.profile?.push_token);
    if (crew.length > 0) {
      sendPushNotification(
        crew.map((m) => m.profile!.push_token as string),
        title, body,
        { type: 'sos', latitude: loc?.latitude, longitude: loc?.longitude },
        'sos',
        crew.map((m) => m.user_id),
      ).catch(() => {});
    }

    // Dead-man → text emergency contacts the full picture.
    if (mode === 'deadman' && userId) {
      try {
        const contacts = await fetchEmergencyContacts(userId);
        if (contacts.length > 0) {
          const locLine = loc ? ` Last location: ${mapsLink(loc.latitude, loc.longitude)}` : '';
          const batt = battery != null ? ` Battery ${battery}%.` : '';
          await openSms(
            contacts.map((c) => c.phone_number),
            `🆘 ${name} did not check in with ${crewName}.${locLine}${batt} Time: ${new Date().toLocaleString()}`,
          );
        }
      } catch {}
    }

    await sendLocalNotification(title, body, { type: 'sos' }, 'sos');
    set({ activeTimer: activeTimer ? { ...activeTimer, is_resolved: true, escalated: true } : null, escalating: false });
  },
}));
