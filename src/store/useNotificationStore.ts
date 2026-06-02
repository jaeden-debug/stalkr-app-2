/**
 * useNotificationStore
 *
 * Per-user notification preferences, persisted locally.
 * These control which zone/SOS events this device shows alerts for.
 *
 * Note: push suppression for background notifications requires server-side
 * filtering. These prefs currently suppress foreground alerts and control
 * whether this device sends outbound zone pushes to crew.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { supabase } from '@/services/supabase';

/** Upsert a single pref column for the current user. Fire-and-forget. */
async function syncPref(column: string, value: boolean) {
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user?.id;
  if (!userId) return;
  supabase
    .from('user_notification_prefs')
    .upsert({ user_id: userId, [column]: value, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
    .then(({ error }) => { if (error) console.warn('[notif prefs] sync error', error.message); });
}

/** Call after sign-in to hydrate prefs from the DB (multi-device consistency). */
export async function loadNotificationPrefs() {
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user?.id;
  if (!userId) return;

  const { data, error } = await supabase
    .from('user_notification_prefs')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error || !data) return;

  useNotificationStore.setState({
    notifyZoneEnter: data.notify_zone_enter,
    notifyZoneLeave: data.notify_zone_leave,
    notifyZoneOverstay: data.notify_zone_overstay,
    notifyCrewZoneActivity: data.notify_crew_zone_activity,
    notifySOSAlerts: data.notify_sos_alerts,
    notifySOSCancel: data.notify_sos_cancel,
  });
}

export interface NotificationPrefs {
  /** Show alert when this user enters a zone */
  notifyZoneEnter: boolean;
  /** Show alert when this user leaves a zone */
  notifyZoneLeave: boolean;
  /** Show alert when this user overstays a zone */
  notifyZoneOverstay: boolean;
  /** Show alert when a crew member enters/leaves a zone (crew push) */
  notifyCrewZoneActivity: boolean;
  /** Show SOS alerts from crew members */
  notifySOSAlerts: boolean;
  /** Show SOS cancellation alerts from crew members */
  notifySOSCancel: boolean;
}

interface NotificationState extends NotificationPrefs {
  setNotifyZoneEnter: (v: boolean) => void;
  setNotifyZoneLeave: (v: boolean) => void;
  setNotifyZoneOverstay: (v: boolean) => void;
  setNotifyCrewZoneActivity: (v: boolean) => void;
  setNotifySOSAlerts: (v: boolean) => void;
  setNotifySOSCancel: (v: boolean) => void;
  /** Returns true if a notification of the given type should be shown */
  shouldShow: (type: 'zone_enter' | 'zone_leave' | 'zone_stay' | 'zone_crew' | 'sos' | 'sos_cancel') => boolean;
}

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set, get) => ({
      notifyZoneEnter: true,
      notifyZoneLeave: true,
      notifyZoneOverstay: true,
      notifyCrewZoneActivity: true,
      notifySOSAlerts: true,
      notifySOSCancel: true,

      setNotifyZoneEnter: (v) => { set({ notifyZoneEnter: v }); syncPref('notify_zone_enter', v); },
      setNotifyZoneLeave: (v) => { set({ notifyZoneLeave: v }); syncPref('notify_zone_leave', v); },
      setNotifyZoneOverstay: (v) => { set({ notifyZoneOverstay: v }); syncPref('notify_zone_overstay', v); },
      setNotifyCrewZoneActivity: (v) => { set({ notifyCrewZoneActivity: v }); syncPref('notify_crew_zone_activity', v); },
      setNotifySOSAlerts: (v) => { set({ notifySOSAlerts: v }); syncPref('notify_sos_alerts', v); },
      setNotifySOSCancel: (v) => { set({ notifySOSCancel: v }); syncPref('notify_sos_cancel', v); },

      shouldShow: (type) => {
        const s = get();
        switch (type) {
          case 'zone_enter': return s.notifyZoneEnter;
          case 'zone_leave': return s.notifyZoneLeave;
          case 'zone_stay': return s.notifyZoneOverstay;
          case 'zone_crew': return s.notifyCrewZoneActivity;
          case 'sos': return s.notifySOSAlerts;
          case 'sos_cancel': return s.notifySOSCancel;
          default: return true;
        }
      },
    }),
    {
      name: 'notification-prefs',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
