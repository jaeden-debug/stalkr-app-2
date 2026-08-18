import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { supabase } from './supabase';
import Constants from 'expo-constants';

// Supabase Edge Function URL for server-side push with pref filtering
const SEND_PUSH_FUNCTION_URL = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/send-push`;

// Set handler once globally — checks user prefs to suppress foreground alerts.
// Background notifications are shown by the OS and cannot be suppressed client-side.
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    // Lazy-require to avoid circular imports
    const { useNotificationStore } = require('@/store/useNotificationStore');
    const type = (notification.request.content.data as any)?.type as string | undefined;

    let suppress = false;
    if (type) {
      suppress = !useNotificationStore.getState().shouldShow(
        type as 'zone_enter' | 'zone_leave' | 'zone_stay' | 'zone_crew' | 'sos' | 'sos_cancel',
      );
    }

    // Per-crew override: a muted crew (or crew-activity turned off for this crew)
    // suppresses crew zone-activity alerts on top of the global default.
    if (!suppress && type === 'zone_crew') {
      try {
        const { useGroupStore } = require('@/store/useGroupStore');
        const { useCrewPrefsStore } = require('@/store/useCrewPrefsStore');
        const gid = useGroupStore.getState().activeGroupId;
        if (gid) {
          const cp = useCrewPrefsStore.getState().getCrewPref(gid);
          if (cp.muted || cp.crewZoneActivity === false) suppress = true;
        }
      } catch {}
    }

    return {
      shouldShowAlert: !suppress,
      shouldShowBanner: !suppress,
      shouldShowList: !suppress,
      shouldPlaySound: !suppress,
      shouldSetBadge: false,
    };
  },
});

export async function setupAndroidChannels(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('default', {
    name: 'General',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
  });
  await Notifications.setNotificationChannelAsync('zone_alerts', {
    name: 'Zone Alerts',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 500, 250, 500],
  });
  await Notifications.setNotificationChannelAsync('sos', {
    name: 'SOS / Emergency',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 1000, 500, 1000],
    sound: 'default',
  });
  await Notifications.setNotificationChannelAsync('safety', {
    name: 'Safety Alerts',
    importance: Notifications.AndroidImportance.HIGH,
  });
  // useRealtimeGroup routes crew zone activity here. The channel was never
  // registered, so those notifications silently fell back to 'default' and
  // could not be muted separately in Android settings — which is the whole
  // point of giving them their own channel.
  await Notifications.setNotificationChannelAsync('zone_crew', {
    name: 'Crew Activity',
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 200],
  });
}

export async function registerPushToken(userId: string): Promise<string | null> {
  if (!Device.isDevice) {
    console.log('[notifications] Skipping push token: not a physical device');
    return null;
  }

  await setupAndroidChannels();

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') {
    console.log('[notifications] Push permission denied');
    return null;
  }

  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) {
    console.warn('[notifications] No EAS projectId configured — push token skipped');
    return null;
  }

  try {
    const { data: tokenData } = await Notifications.getExpoPushTokenAsync({ projectId });
    const token = tokenData;

    // Store in profiles
    await supabase.from('profiles').update({ push_token: token }).eq('id', userId);

    // Also store in device_push_tokens for multi-device support
    await supabase.from('device_push_tokens').upsert(
      {
        user_id: userId,
        token,
        platform: Platform.OS as 'ios' | 'android',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'token' },
    );

    return token;
  } catch (err) {
    console.error('[notifications] Push token error:', err);
    return null;
  }
}

/**
 * Send push notifications to a list of recipients.
 *
 * Routes through the Supabase send-push Edge Function so that each
 * recipient's server-side notification preferences are respected before
 * delivery — this suppresses background pushes for opted-out users,
 * not just foreground alerts.
 *
 * @param tokens          Expo push tokens (parallel-indexed with recipientUserIds)
 * @param title           Notification title
 * @param body            Notification body
 * @param data            Payload (must include `type` for pref filtering)
 * @param channelId       Android channel
 * @param recipientUserIds Supabase user IDs parallel to tokens (required for server-side pref filtering)
 */
/**
 * Outcome of a push dispatch attempt.
 *
 * This used to return void and swallow every error, so callers could not tell
 * "delivered" from "silently failed". SOS in particular told the user "your
 * crew has been alerted" whether or not anything left the device.
 *
 * `dispatched` means the send endpoint ACCEPTED the request — it is not
 * delivery confirmation, which push transports cannot give us synchronously.
 */
export interface PushDispatchResult {
  dispatched: boolean;
  /** Number of valid Expo tokens the request covered. */
  recipients: number;
  /** Present when dispatch failed or was skipped. */
  reason?: 'no_recipients' | 'network_error' | 'server_error';
}

export async function sendPushNotification(
  tokens: string[],
  title: string,
  body: string,
  data?: Record<string, unknown>,
  channelId?: string,
  recipientUserIds?: string[],
  groupId?: string,
  fromUserId?: string,
): Promise<PushDispatchResult> {
  const valid = tokens.filter((t) => t?.startsWith('ExponentPushToken'));
  if (valid.length === 0) return { dispatched: false, recipients: 0, reason: 'no_recipients' };

  // Get the current session's access token for the Edge Function
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;

  try {
    const res = await fetch(SEND_PUSH_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify({
        tokens: valid,
        title,
        body,
        data: data ?? {},
        channelId: channelId ?? 'default',
        type: (data as any)?.type ?? 'general',
        recipientUserIds,
        groupId,
        fromUserId,
      }),
    });
    if (!res.ok) {
      console.error('[notifications] Push send rejected:', res.status);
      return { dispatched: false, recipients: valid.length, reason: 'server_error' };
    }
    return { dispatched: true, recipients: valid.length };
  } catch (err) {
    console.error('[notifications] Push send error:', err);
    return { dispatched: false, recipients: valid.length, reason: 'network_error' };
  }
}

/**
 * Remove THIS device's push registration.
 *
 * Without this, signing out left the token attached to the old account: the
 * phone kept receiving that crew's alerts — including SOS — for someone who is
 * no longer signed in. Only this device's row is removed, so the user's other
 * devices keep working.
 */
export async function unregisterPushToken(userId: string, token: string | null): Promise<void> {
  try {
    if (token) {
      await supabase.from('device_push_tokens').delete().eq('token', token);
    }
    // profiles.push_token is a single column shared by every device, so only
    // clear it if it still points at the device that is signing out.
    await supabase.from('profiles').update({ push_token: null }).eq('id', userId).eq('push_token', token);
  } catch (err) {
    console.error('[notifications] unregister failed:', err);
  }
}

/** Android channels this app actually creates — see registerNotificationChannels. */
const ANDROID_CHANNELS = new Set(['default', 'zone_alerts', 'sos', 'safety', 'zone_crew']);

export async function sendLocalNotification(
  title: string,
  body: string,
  data?: Record<string, unknown>,
  channelId?: string,
): Promise<void> {
  try {
    // `identifier` is the notification's UNIQUE ID, not the Android channel.
    // Passing the channel there caused two separate failures:
    //
    //  1. Every notification sharing a channel name shared an identifier, so
    //     each new one REPLACED the last. Four call sites pass 'sos' and three
    //     pass 'safety' — an SOS-cancelled confirmation silently overwrote the
    //     SOS-activated one.
    //  2. The channel was never applied at all, so Android delivered these on
    //     the default channel. The 'sos' and 'zone_alerts' channels are created
    //     with AndroidImportance.MAX specifically so they break through as
    //     heads-up alerts; that was being thrown away.
    //
    // channelId belongs on the TRIGGER. `trigger: null` fires immediately but
    // carries no channel, so Android targets use a 1-second interval trigger —
    // the shortest schedulable form that accepts one.
    const useChannel =
      Platform.OS === 'android' && channelId && ANDROID_CHANNELS.has(channelId);

    if (__DEV__ && channelId && !ANDROID_CHANNELS.has(channelId)) {
      // e.g. 'zone_crew' is passed by useRealtimeGroup but no such channel is
      // registered, so it would silently fall back.
      console.warn(`[notifications] unknown Android channel "${channelId}" — falling back to default`);
    }

    await Notifications.scheduleNotificationAsync({
      content: { title, body, data: data ?? {}, sound: 'default' },
      trigger: useChannel
        ? {
            type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
            seconds: 1,
            channelId: channelId as string,
          }
        : null,
    });
  } catch (err) {
    console.error('[notifications] Local notification error:', err);
  }
}

export async function sendZoneNotification(
  title: string,
  body: string,
  zoneId: string,
  eventType: 'zone_enter' | 'zone_leave' | 'zone_stay',
): Promise<void> {
  await sendLocalNotification(title, body, { type: eventType, zoneId }, 'zone_alerts');
}

export async function sendSOSNotification(
  tokens: string[],
  userName: string,
  coords: { latitude: number; longitude: number } | null,
  recipientUserIds?: string[],
): Promise<PushDispatchResult> {
  // An SOS with no GPS fix must STILL alert the crew. Previously the caller
  // skipped the push entirely when coords were missing, so an SOS indoors or
  // before first fix notified nobody while the UI claimed success.
  return sendPushNotification(
    tokens,
    `🆘 SOS — ${userName}`,
    coords
      ? `${userName} activated SOS. Tap to view their location.`
      : `${userName} activated SOS. No location fix available.`,
    coords
      ? { type: 'sos', latitude: coords.latitude, longitude: coords.longitude }
      : { type: 'sos' },
    'sos',
    recipientUserIds,
  );
}

export async function sendSOSCancelNotification(
  tokens: string[],
  userName: string,
  recipientUserIds?: string[],
): Promise<void> {
  await sendPushNotification(
    tokens,
    `✅ SOS Cancelled — ${userName}`,
    `${userName} has cancelled their SOS alert. They are safe.`,
    { type: 'sos_cancel' },
    'safety',
    recipientUserIds,
  );
}

export async function notifyWatchersArrived(sessionId: string, sessionName: string): Promise<void> {
  const { data } = await supabase.from('sessions').select('watcher_push_tokens').eq('id', sessionId).single();
  const tokens: string[] = (data as any)?.watcher_push_tokens ?? [];
  if (tokens.length === 0) return;
  await sendPushNotification(tokens, `✅ Arrived — ${sessionName}`, 'Your crew member arrived at the destination.', { type: 'arrival', sessionId });
}

export async function notifyWatchersSessionEnded(sessionId: string, sessionName: string): Promise<void> {
  const { data } = await supabase.from('sessions').select('watcher_push_tokens').eq('id', sessionId).single();
  const tokens: string[] = (data as any)?.watcher_push_tokens ?? [];
  if (tokens.length === 0) return;
  await sendPushNotification(tokens, `Session ended — ${sessionName}`, 'The session has ended.', { type: 'session_ended', sessionId });
}

export async function notifyCheckInMissed(
  tokens: string[],
  userName: string,
  label?: string | null,
): Promise<void> {
  await sendPushNotification(
    tokens,
    `⚠️ Check-in missed — ${userName}`,
    label ? `"${label}" check-in was not confirmed.` : `${userName} missed their safety check-in.`,
    { type: 'checkin_missed' },
    'safety',
  );
}
