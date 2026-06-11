/**
 * Native call / text helpers — no backend required. Opens the OS dialer or
 * SMS composer pre-filled, letting the user confirm send.
 */
import { Linking, Platform, Share } from 'react-native';

const clean = (n: string) => n.replace(/[^+\d]/g, '');

/**
 * Share a message + link the right way per platform.
 * iOS: pass `url` separately so iMessage renders ONE rich link card (and never
 * duplicates the URL). The message must NOT contain the url.
 * Android: Share ignores `url`, so append it to the message instead.
 * `url` should point at a page with OG tags so the preview is a rich card.
 */
export async function shareWithLink(message: string, url: string, title?: string): Promise<void> {
  try {
    if (Platform.OS === 'ios') {
      await Share.share({ title, message, url });
    } else {
      await Share.share({ title, message: `${message} ${url}` });
    }
  } catch {
    /* user cancelled */
  }
}

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

export async function openEmail(emails: string[], subject: string, body: string): Promise<boolean> {
  const to = emails.map((e) => e.trim()).filter(Boolean).join(',');
  if (!to) return false;
  const url = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  try {
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}
