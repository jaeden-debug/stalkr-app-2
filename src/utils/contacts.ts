/**
 * Pure helpers for turning raw expo-contacts results into the clean,
 * de-duplicated, searchable list the Journey sheet and the Emergency Contacts
 * screen render. Free of React/native imports so it is unit-testable.
 */

export interface ContactChannel {
  /** Stable identity for this specific number/address on this contact. */
  id: string;
  /** As the user recognises it: "+1 (613) 555-0142". */
  display: string;
  /** Comparable/dialable form: digits with a leading + when international. */
  normalized: string;
  /** "mobile", "home", "work"… when the OS supplies one. */
  label?: string;
  isEmail: boolean;
}

export interface DeviceContact {
  id: string;
  name: string;
  /**
   * Preferred channel's raw value. Kept for existing call sites; new code
   * should prefer `selected` / `channels` so a contact with several numbers is
   * unambiguous.
   */
  value: string;
  isEmail: boolean;
  /** Every usable phone/email on the contact, phones first. */
  channels: ContactChannel[];
  /** The channel `value` refers to — the default pick. */
  selected: ContactChannel;
}

/** Shape we read from expo-contacts (loosely typed — versions differ). */
export interface RawContact {
  id?: string | number;
  name?: string | null;
  phoneNumbers?: { number?: string | null; label?: string | null; id?: string | null }[] | null;
  emails?: { email?: string | null; label?: string | null; id?: string | null }[] | null;
}

/**
 * Reduce a phone number to a comparable form.
 *
 * Address books store the same number many ways — "(613) 555-0142",
 * "613-555-0142", "+16135550142". Without a canonical form the same person
 * appears several times, and worse, a de-dupe keyed on raw text can keep two
 * entries that dial the same number while dropping a genuinely different one.
 *
 * Deliberately NOT a full E.164 parser: that needs a region database we do not
 * ship. This preserves an explicit country code when present and otherwise
 * compares on digits, which is correct for the dedupe/compare job it does.
 * Extensions are dropped from the comparable form but kept in `display`.
 */
export function normalizePhone(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  // Strip extensions ("x123", "ext. 4") before looking at digits.
  const withoutExt = trimmed.replace(/\s*(?:x|ext\.?|extension)\s*\d+\s*$/i, '');
  const hasPlus = withoutExt.trimStart().startsWith('+');
  const digits = withoutExt.replace(/\D/g, '');
  if (!digits) return '';

  // North American Numbering Plan canonicalisation. "+1 (613) 555-0142",
  // "1-613-555-0142" and "6135550142" are all the same phone; without this they
  // produce three different keys, so the same person appears three times in the
  // picker and a journey could notify a number the user did not think they had
  // chosen.
  if (digits.length === 11 && digits.startsWith('1')) return `+1${digits.slice(1)}`;
  if (digits.length === 10 && !hasPlus) return `+1${digits}`;

  // Anything with an explicit country code keeps it verbatim.
  if (hasPlus) return `+${digits}`;

  // Short/unknown formats (internal extensions, partial entries) compare on
  // digits alone. NOTE: the bare-10-digit rule above assumes NANP, matching the
  // product's stated US/Canada market. This is a comparison key, not a full
  // E.164 parser — that needs a region database we do not ship.
  return digits;
}

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

function buildChannels(contact: RawContact, contactKey: string): ContactChannel[] {
  const channels: ContactChannel[] = [];
  const seen = new Set<string>();

  (contact.phoneNumbers ?? []).forEach((p, i) => {
    const display = (p?.number ?? '').trim();
    if (!display) return;
    const normalized = normalizePhone(display);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    channels.push({
      id: `${contactKey}:phone:${p?.id ?? i}`,
      display,
      normalized,
      label: p?.label ?? undefined,
      isEmail: false,
    });
  });

  (contact.emails ?? []).forEach((e, i) => {
    const display = (e?.email ?? '').trim();
    if (!display) return;
    const normalized = normalizeEmail(display);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    channels.push({
      id: `${contactKey}:email:${e?.id ?? i}`,
      display,
      normalized,
      label: e?.label ?? undefined,
      isEmail: true,
    });
  });

  return channels;
}

/**
 * Normalise raw contacts: collect every usable phone/email, drop entries with
 * neither, drop contacts that duplicate an already-seen channel, sort by name.
 *
 * Identity never uses array position — an index-derived id would be reassigned
 * to a different person whenever the address book or the filter changes.
 */
export function cleanDeviceContacts(data: RawContact[]): DeviceContact[] {
  if (!Array.isArray(data)) return [];

  const seenPrimary = new Set<string>();
  const out: DeviceContact[] = [];

  data.forEach((c, i) => {
    if (!c) return;
    // Prefer the OS id; fall back to a content-derived key rather than the
    // array index so the id survives reordering.
    const name = (c.name ?? '').trim() || 'Unknown';
    const contactKey = String(c.id ?? `${name}-${c.phoneNumbers?.[0]?.number ?? c.emails?.[0]?.email ?? i}`);

    const channels = buildChannels(c, contactKey);
    if (channels.length === 0) return;

    const selected = channels[0];
    if (seenPrimary.has(selected.normalized)) return;
    seenPrimary.add(selected.normalized);

    out.push({
      id: contactKey,
      name,
      value: selected.display,
      isEmail: selected.isEmail,
      channels,
      selected,
    });
  });

  return out.sort((a, b) => a.name.localeCompare(b.name));
}

/** Return a copy of `contact` with a different channel chosen. */
export function withSelectedChannel(contact: DeviceContact, channelId: string): DeviceContact {
  const channel = contact.channels.find((c) => c.id === channelId);
  if (!channel) return contact;
  return { ...contact, selected: channel, value: channel.display, isEmail: channel.isEmail };
}

/** Case-insensitive filter over name and every channel. Empty query passes through. */
export function filterContacts(list: DeviceContact[], query: string): DeviceContact[] {
  const q = query.trim().toLowerCase();
  if (!q) return list;
  // Also match on digits so typing "6135550142" finds "(613) 555-0142".
  const digits = q.replace(/\D/g, '');
  return list.filter(
    (c) =>
      c.name.toLowerCase().includes(q) ||
      c.channels.some(
        (ch) =>
          ch.display.toLowerCase().includes(q) ||
          (digits.length >= 3 && ch.normalized.includes(digits)),
      ),
  );
}
