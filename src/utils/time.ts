import { LIVE_WINDOW_MS, STALE_WINDOW_MS } from './presence';
/**
 * Time formatting utilities for outdoor/tactical context
 */

/**
 * How long ago something happened — tactical short format
 */
export function timeAgo(isoString: string | null | undefined): string {
  if (!isoString) return 'unknown';
  const diffMs = Date.now() - new Date(isoString).getTime();
  const secs = Math.floor(diffMs / 1000);
  if (secs < 5) return 'just now';
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

/**
 * Returns location status based on last ping time
 */
export function getLocationStatus(lastPingAt: string | null | undefined): 'live' | 'stale' | 'offline' {
  // Thresholds come from the presence model rather than being restated here.
  // The same two numbers previously existed in three places (this function,
  // MAP_CONSTANTS, and presence.ts); identical today, free to drift tomorrow,
  // and the symptom of drift is one part of the UI calling a member live while
  // another calls them stale.
  //
  // This returns the coarse badge vocabulary and does NOT model deliberate
  // go-dark — callers that care about privacy state must use resolvePresence()
  // instead, which distinguishes 'dark' from 'offline'.
  if (!lastPingAt) return 'offline';
  const diffMs = Date.now() - new Date(lastPingAt).getTime();
  if (diffMs < LIVE_WINDOW_MS) return 'live';
  if (diffMs < STALE_WINDOW_MS) return 'stale';
  return 'offline';
}

/**
 * Format a timer countdown
 */
export function formatCountdown(targetIso: string): string {
  const diffMs = new Date(targetIso).getTime() - Date.now();
  if (diffMs <= 0) return 'Overdue';
  const secs = Math.floor(diffMs / 1000);
  const mins = Math.floor(secs / 60);
  const hrs = Math.floor(mins / 60);
  if (hrs > 0) return `${hrs}h ${mins % 60}m`;
  if (mins > 0) return `${mins}m ${secs % 60}s`;
  return `${secs}s`;
}

/**
 * Format ISO to display time e.g. "2:34 PM"
 */
export function formatTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/**
 * Format ISO to display date e.g. "May 27"
 */
export function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

/**
 * Add minutes to now and return ISO string
 */
export function addMinutes(minutes: number): string {
  return new Date(Date.now() + minutes * 60 * 1000).toISOString();
}

/**
 * Is quiet hours active? (checks if current time is in quiet window)
 */
export function isQuietHours(startHHMM: string, endHHMM: string): boolean {
  const now = new Date();
  const currentMins = now.getHours() * 60 + now.getMinutes();
  const [sh, sm] = startHHMM.split(':').map(Number);
  const [eh, em] = endHHMM.split(':').map(Number);
  const startMins = sh * 60 + sm;
  const endMins = eh * 60 + em;

  if (startMins <= endMins) {
    return currentMins >= startMins && currentMins < endMins;
  }
  // Overnight range e.g. 22:00 – 06:00
  return currentMins >= startMins || currentMins < endMins;
}
