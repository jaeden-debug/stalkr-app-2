import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { supabase } from './supabase';
import Constants from 'expo-constants';

// Set handler once globally
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
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

export async function sendPushNotification(
  tokens: string[],
  title: string,
  body: string,
  data?: Record<string, unknown>,
  channelId?: string,
): Promise<void> {
  const valid = tokens.filter((t) => t?.startsWith('ExponentPushToken'));
  if (valid.length === 0) return;

  const messages = valid.map((to) => ({
    to,
    title,
    body,
    data: data ?? {},
    sound: 'default',
    channelId: channelId ?? 'default',
    priority: 'high',
  }));

  try {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(messages),
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

export async function sendSOSNotification(tokens: string[], userName: string, coords: { latitude: number; longitude: number }): Promise<void> {
  await sendPushNotification(
    tokens,
    `🆘 SOS — ${userName}`,
    `${userName} activated SOS. Tap to view their location.`,
    { type: 'sos', latitude: coords.latitude, longitude: coords.longitude },
    'sos',
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
