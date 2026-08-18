/**
 * Device address-book access — the ONLY place the app talks to expo-contacts.
 *
 * ── The bug this fixes ──────────────────────────────────────────────────────
 * expo-contacts 56.0.7 restructured the package. Importing from 'expo-contacts'
 * now gives the new class-based API, and every legacy function was replaced by
 * a stub that throws unconditionally:
 *
 *   node_modules/expo-contacts/src/legacyWarnings.ts:70
 *     export async function getContactsAsync(...) {
 *       throw errorOnLegacyMethodUse('getContactsAsync');
 *     }
 *
 * So `Contacts.getContactsAsync(...)` threw on every call, on both platforms,
 * regardless of permissions — and the callers caught it and showed a generic
 * "something went wrong". It looked like a permissions problem because
 * `requestPermissionsAsync` is still real in the new API (ContactsModule.ts:91),
 * so the OS prompt appeared normally and only the read failed afterwards.
 *
 * The `expo-contacts/legacy` subpath export is the supported compatibility path
 * and keeps the working implementation, so that is what we import.
 *
 * ── Why one module ──────────────────────────────────────────────────────────
 * Three screens each had their own copy of this logic (JourneySheet,
 * NavigationDrawer, emergency-contacts), so all three broke identically and had
 * to be fixed three times. There is now one implementation and one result type.
 */
import * as Contacts from 'expo-contacts/legacy';
import { cleanDeviceContacts, type DeviceContact } from '@/utils/contacts';

export type { DeviceContact };

/**
 * Every distinguishable outcome. Callers must never collapse these into a
 * single failure message — each one has a different recovery for the user.
 */
export type DeviceContactsResult =
  | { ok: true; contacts: DeviceContact[] }
  /** Permission refused, but the OS will still prompt again. */
  | { ok: false; reason: 'denied'; canAskAgain: true; message: string }
  /** Permanently refused — only Settings can undo it. */
  | { ok: false; reason: 'blocked'; canAskAgain: false; message: string }
  /** Granted, but zero contacts were shared (usually iOS Limited Access). */
  | { ok: false; reason: 'limited_or_empty'; message: string }
  /** The native module is genuinely absent — a stale binary. */
  | { ok: false; reason: 'module_unavailable'; message: string }
  /** Anything else. `detail` carries the real error for diagnostics. */
  | { ok: false; reason: 'error'; message: string; detail: string };

function describe(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  return String(error);
}

/**
 * Request permission if needed and read the address book.
 *
 * Never throws — every failure is returned as a typed reason so the UI can
 * offer the right recovery rather than a dead end.
 */
export async function loadDeviceContacts(): Promise<DeviceContactsResult> {
  // A genuinely missing native module (old binary) is distinct from a
  // deprecated JS export, which is what actually broke before.
  if (typeof Contacts.requestPermissionsAsync !== 'function') {
    return {
      ok: false,
      reason: 'module_unavailable',
      message:
        'Contacts support is missing from this build. Rebuild the app to enable picking from your phone.',
    };
  }

  let status: string;
  let canAskAgain: boolean;
  try {
    const perm = await Contacts.requestPermissionsAsync();
    status = perm.status;
    canAskAgain = perm.canAskAgain !== false;
  } catch (error) {
    return {
      ok: false,
      reason: 'error',
      message: 'Contacts permission could not be requested.',
      detail: describe(error),
    };
  }

  if (status !== 'granted') {
    return canAskAgain
      ? {
          ok: false,
          reason: 'denied',
          canAskAgain: true,
          message: 'Allow contacts access to pick someone from your phone.',
        }
      : {
          ok: false,
          reason: 'blocked',
          canAskAgain: false,
          message:
            'Stalkr is blocked from reading your contacts. Turn it on in Settings to pick from your phone.',
        };
  }

  let raw: unknown;
  try {
    const response = await Contacts.getContactsAsync({
      fields: [Contacts.Fields.Name, Contacts.Fields.PhoneNumbers, Contacts.Fields.Emails],
    });
    raw = response?.data;
  } catch (error) {
    // Surfacing the real error text matters: the previous generic message hid a
    // deprecation for an entire release.
    return {
      ok: false,
      reason: 'error',
      message: 'Your contacts could not be read.',
      detail: describe(error),
    };
  }

  if (!Array.isArray(raw)) {
    return {
      ok: false,
      reason: 'error',
      message: 'Your contacts could not be read.',
      detail: `getContactsAsync returned ${typeof raw} instead of an array`,
    };
  }

  const contacts = cleanDeviceContacts(raw as never);
  if (contacts.length === 0) {
    return {
      ok: false,
      reason: 'limited_or_empty',
      message:
        'No contacts were shared with Stalkr. If you chose "Limited Access", allow more in Settings — or add someone manually.',
    };
  }

  return { ok: true, contacts };
}

/** True when the reason is fixable only from the OS Settings app. */
export function needsSettings(result: DeviceContactsResult): boolean {
  return !result.ok && (result.reason === 'blocked' || result.reason === 'limited_or_empty');
}
