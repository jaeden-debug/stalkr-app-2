/**
 * Pure helpers for turning raw expo-contacts results into the clean,
 * de-duplicated, searchable list both the Journey sheet and the Emergency
 * Contacts screen render. Kept free of React/native imports so it is unit-testable.
 */

export interface DeviceContact {
  id: string;
  name: string;
  /** First phone number, or first email if no phone (journey watchers accept either). */
  value: string;
  /** True when `value` is an email address rather than a phone number. */
  isEmail: boolean;
}

/** Shape we read from expo-contacts (loosely typed — versions differ). */
export interface RawContact {
  id?: string | number;
  name?: string | null;
  phoneNumbers?: { number?: string | null }[] | null;
  emails?: { email?: string | null }[] | null;
}

/**
 * Normalise raw contacts: pick a usable phone (preferred) or email, drop entries
 * with neither, drop exact duplicate values, and sort by name.
 */
export function cleanDeviceContacts(data: RawContact[]): DeviceContact[] {
  const seen = new Set<string>();
  const out: DeviceContact[] = [];
  data.forEach((c, i) => {
    const phone = c.phoneNumbers?.find((p) => p?.number)?.number ?? '';
    const email = c.emails?.find((e) => e?.email)?.email ?? '';
    const value = (phone || email || '').trim();
    if (!value) return;
    const dedupeKey = value.replace(/\s+/g, '').toLowerCase();
    if (seen.has(dedupeKey)) return;
    seen.add(dedupeKey);
    out.push({
      id: String(c.id ?? `idx-${i}`),
      name: (c.name ?? '').trim() || 'Unknown',
      value,
      isEmail: !phone && value.includes('@'),
    });
  });
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

/** Case-insensitive filter over name and value. Empty query returns the list unchanged. */
export function filterContacts(list: DeviceContact[], query: string): DeviceContact[] {
  const q = query.trim().toLowerCase();
  if (!q) return list;
  return list.filter((c) => c.name.toLowerCase().includes(q) || c.value.toLowerCase().includes(q));
}
