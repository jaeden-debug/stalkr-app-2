import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';

export interface PermissionState {
  location: 'granted' | 'denied' | 'undetermined';
  backgroundLocation: 'granted' | 'denied' | 'undetermined';
  notifications: 'granted' | 'denied' | 'undetermined';
}

/**
 * Request foreground location permission
 */
export async function requestForegroundLocation(): Promise<boolean> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  return status === 'granted';
}

/**
 * Request background location permission (must request foreground first)
 */
export async function requestBackgroundLocation(): Promise<boolean> {
  const foreground = await Location.getForegroundPermissionsAsync();
  if (foreground.status !== 'granted') return false;
  const { status } = await Location.requestBackgroundPermissionsAsync();
  return status === 'granted';
}

/**
 * Request notification permission
 */
export async function requestNotificationPermission(): Promise<boolean> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

/**
 * Get current permission states without requesting
 */
export async function getPermissionStates(): Promise<PermissionState> {
  const [fg, bg, notif] = await Promise.all([
    Location.getForegroundPermissionsAsync(),
    Location.getBackgroundPermissionsAsync(),
    Notifications.getPermissionsAsync(),
  ]);

  return {
    location: fg.status as PermissionState['location'],
    backgroundLocation: bg.status as PermissionState['backgroundLocation'],
    notifications: notif.status as PermissionState['notifications'],
  };
}
