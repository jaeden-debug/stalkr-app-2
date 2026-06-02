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
export async function sendPushNotification(
  tokens: string[],
  title: string,
  body: string,
  data?: Record<string, unknown>,
  channelId?: string,
  recipientUserIds?: string[],
): Promise<void> {
  const valid = tokens.filter((t) => t?.startsWith('ExponentPushToken'));
  if (valid.length === 0) return;

  // Get the current session's access token for the Edge Function
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;

  try {
    await fetch(SEND_PUSH_FUNCTION_URL, {
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
      }),
    });
  } catch (err) {
    console.error('[notifications] Push send error:', err);
  }
}

export async function sendLocalNotification(
  title: string,
  body: string,
  data?: Record<string, unknown>,
  channelId?: string,
): Promise<void> {
  try {
    await Notifications.scheduleNotificationAsync({
      content: { title, body, data: data ?? {}, sound: 'default' },
      trigger: null,
      ...(channelId ? { identifier: channelId } : {}),
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
  coords: { latitude: number; longitude: number },
  recipientUserIds?: string[],
): Promise<void> {
  await sendPushNotification(
    tokens,
    `🆘 SOS — ${userName}`,
    `${userName} activated SOS. Tap to view their location.`,
    { type: 'sos', latitude: coords.latitude, longitude: coords.longitude },
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
