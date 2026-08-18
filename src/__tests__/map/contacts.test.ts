/**
 * Device contacts — the Journey "Could not load contacts" failure.
 *
 * Root cause was NOT permissions: expo-contacts 56 replaced every legacy
 * function with a stub that throws unconditionally, so the read failed after a
 * successful permission grant and three separate screens each showed their own
 * generic error.
 *
 * These tests pin two things:
 *   1. every failure mode stays distinguishable (no generic collapse), and
 *   2. contact normalization never mixes up which number belongs to whom.
 */
import {
  cleanDeviceContacts,
  filterContacts,
  normalizePhone,
  withSelectedChannel,
  type RawContact,
} from '@/utils/contacts';

jest.mock('expo-contacts/legacy', () => ({
  // __esModule matters: without it Babel's _interopRequireWildcard COPIES the
  // module's properties, so the service under test holds a snapshot and any
  // per-test reassignment below would never reach it.
  __esModule: true,
  requestPermissionsAsync: jest.fn(),
  getContactsAsync: jest.fn(),
  Fields: { Name: 'name', PhoneNumbers: 'phoneNumbers', Emails: 'emails' },
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const legacy = require('expo-contacts/legacy');
import { loadDeviceContacts, needsSettings } from '@/services/deviceContacts';

const grant = (status = 'granted', canAskAgain = true) =>
  legacy.requestPermissionsAsync.mockResolvedValue({ status, canAskAgain });

beforeEach(() => {
  jest.clearAllMocks();
  // Reassign rather than only clearing: one test deliberately deletes
  // requestPermissionsAsync to simulate a missing native module, and a bare
  // clearAllMocks would not put it back.
  legacy.requestPermissionsAsync = jest.fn();
  legacy.getContactsAsync = jest.fn();
});

describe('loadDeviceContacts — every failure is distinguishable', () => {
  it('returns contacts on the happy path', async () => {
    grant();
    legacy.getContactsAsync.mockResolvedValue({
      data: [{ id: '1', name: 'Ada', phoneNumbers: [{ number: '613-555-0142' }] }],
    });

    const result = await loadDeviceContacts();
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.contacts).toHaveLength(1);
  });

  it('reports a recoverable denial separately from a permanent block', async () => {
    grant('denied', true);
    const denied = await loadDeviceContacts();
    expect(denied).toMatchObject({ ok: false, reason: 'denied' });
    expect(needsSettings(denied)).toBe(false); // OS will ask again

    grant('denied', false);
    const blocked = await loadDeviceContacts();
    expect(blocked).toMatchObject({ ok: false, reason: 'blocked' });
    expect(needsSettings(blocked)).toBe(true); // only Settings can fix it
  });

  it('distinguishes iOS Limited Access / empty book from an error', async () => {
    grant();
    legacy.getContactsAsync.mockResolvedValue({ data: [] });

    const result = await loadDeviceContacts();
    expect(result).toMatchObject({ ok: false, reason: 'limited_or_empty' });
    expect(needsSettings(result)).toBe(true);
  });

  it('surfaces the real error text when the read throws', async () => {
    // This is the exact 56.x deprecation shape. The old code swallowed it into
    // "something went wrong", which hid the cause for a whole release.
    grant();
    legacy.getContactsAsync.mockRejectedValue(
      new Error('Method getContactsAsync imported from "expo-contacts" is deprecated.'),
    );

    const result = await loadDeviceContacts();
    expect(result.ok).toBe(false);
    if (!result.ok && result.reason === 'error') {
      expect(result.detail).toContain('deprecated');
    } else {
      throw new Error('expected an error result carrying detail');
    }
  });

  it('does not throw when the native module is absent', async () => {
    legacy.requestPermissionsAsync = undefined;
    const result = await loadDeviceContacts();
    expect(result).toMatchObject({ ok: false, reason: 'module_unavailable' });
  });

  it('never throws, whatever the platform does', async () => {
    grant();
    for (const bad of [undefined, null, { data: null }, { data: 'nope' }]) {
      legacy.getContactsAsync.mockResolvedValue(bad);
      await expect(loadDeviceContacts()).resolves.toBeDefined();
    }
  });
});

describe('normalizePhone', () => {
  it('treats the same number written differently as the same number', () => {
    const forms = ['+1 (613) 555-0142', '1-613-555-0142', '+16135550142'];
    const normalized = new Set(forms.map(normalizePhone));
    expect(normalized.size).toBe(1);
  });

  it('keeps genuinely different numbers apart', () => {
    expect(normalizePhone('613-555-0142')).not.toBe(normalizePhone('613-555-0143'));
  });

  it('preserves an explicit international prefix', () => {
    expect(normalizePhone('+44 20 7946 0958')).toBe('+442079460958');
  });

  it('canonicalises a bare NANP number to its +1 form', () => {
    expect(normalizePhone('6135550142')).toBe('+16135550142');
    expect(normalizePhone('613-555-0142')).toBe(normalizePhone('+1 613 555 0142'));
  });

  it('strips extensions from the comparable form', () => {
    expect(normalizePhone('613-555-0142 x99')).toBe(normalizePhone('613-555-0142'));
  });

  it('returns empty for unusable input', () => {
    for (const junk of ['', '   ', 'no digits']) expect(normalizePhone(junk)).toBe('');
  });
});

describe('cleanDeviceContacts', () => {
  const raw: RawContact[] = [
    {
      id: 'c1',
      name: 'Ada Lovelace',
      phoneNumbers: [
        { number: '613-555-0142', label: 'mobile', id: 'p1' },
        { number: '613-555-9999', label: 'work', id: 'p2' },
      ],
    },
    { id: 'c2', name: 'Bob', emails: [{ email: 'BOB@Example.com', id: 'e1' }] },
    { id: 'c3', name: 'No Channels' },
  ];

  it('keeps every usable number rather than only the first', () => {
    // The old shape exposed a single `value`, so a contact with a work and a
    // mobile number silently lost one — and the user could not tell which the
    // journey would notify.
    const [ada] = cleanDeviceContacts(raw);
    expect(ada.channels).toHaveLength(2);
    expect(ada.channels.map((c) => c.label)).toEqual(['mobile', 'work']);
  });

  it('defaults to the first phone and reports it as selected', () => {
    const [ada] = cleanDeviceContacts(raw);
    expect(ada.selected.display).toBe('613-555-0142');
    expect(ada.value).toBe(ada.selected.display);
    expect(ada.isEmail).toBe(false);
  });

  it('lets the user pick a different number without changing identity', () => {
    const [ada] = cleanDeviceContacts(raw);
    const switched = withSelectedChannel(ada, ada.channels[1].id);
    expect(switched.id).toBe(ada.id);
    expect(switched.value).toBe('613-555-9999');
  });

  it('drops contacts with no phone or email', () => {
    expect(cleanDeviceContacts(raw).map((c) => c.name)).not.toContain('No Channels');
  });

  it('falls back to email and normalizes case', () => {
    const bob = cleanDeviceContacts(raw).find((c) => c.name === 'Bob')!;
    expect(bob.isEmail).toBe(true);
    expect(bob.selected.normalized).toBe('bob@example.com');
  });

  it('never derives identity from array position', () => {
    // An index-derived id gets reassigned to a different person whenever the
    // list is filtered or the address book changes.
    const ids = cleanDeviceContacts(raw).map((c) => c.id);
    expect(ids).not.toContain('idx-0');
    expect(ids.every((id) => !/^idx-\d+$/.test(id))).toBe(true);
  });

  it('dedupes contacts that resolve to the same number', () => {
    const dupes: RawContact[] = [
      { id: 'a', name: 'Ada', phoneNumbers: [{ number: '+1 613 555 0142' }] },
      { id: 'b', name: 'Ada L', phoneNumbers: [{ number: '6135550142' }] },
    ];
    expect(cleanDeviceContacts(dupes)).toHaveLength(1);
  });

  it('tolerates malformed input without throwing', () => {
    expect(() => cleanDeviceContacts(null as never)).not.toThrow();
    expect(cleanDeviceContacts(null as never)).toEqual([]);
    expect(cleanDeviceContacts([null, undefined] as never)).toEqual([]);
  });
});

describe('filterContacts', () => {
  const list = cleanDeviceContacts([
    { id: '1', name: 'Ada Lovelace', phoneNumbers: [{ number: '613-555-0142' }] },
    { id: '2', name: 'Grace Hopper', phoneNumbers: [{ number: '514-555-7788' }] },
  ]);

  it('matches on name', () => {
    expect(filterContacts(list, 'grace')).toHaveLength(1);
  });

  it('matches on digits regardless of formatting', () => {
    expect(filterContacts(list, '6135550142')).toHaveLength(1);
    expect(filterContacts(list, '514')).toHaveLength(1);
  });

  it('passes everything through on an empty query', () => {
    expect(filterContacts(list, '  ')).toHaveLength(2);
  });
});
