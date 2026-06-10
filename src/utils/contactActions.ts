/**
 * Native call / text helpers — no backend required. Opens the OS dialer or
 * SMS composer pre-filled, letting the user confirm send.
 */
import { Linking, Platform } from 'react-native';

const clean = (n: string) => n.replace(/[^+\d]/g, '');

export async function callNumber(phone: string): Promise<void> {
  const num = clean(phone);
  if (!num) return;
  try {
    await Linking.openURL(`tel:${num}`);
  } catch {
    /* no dialer */
  }
}

export async function openSms(numbers: string[], body: string): Promise<boolean> {
  const recipients = numbers.map(clean).filter(Boolean).join(',');
  if (!recipients) return false;
  // iOS uses `&body=`, Android uses `?body=`.
  const sep = Platform.OS === 'ios' ? '&' : '?';
  const url = `sms:${recipients}${sep}body=${encodeURIComponent(body)}`;
  try {
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}

export function mapsLink(lat: number, lng: number): string {
  return `https://maps.google.com/?q=${lat},${lng}`;
}
