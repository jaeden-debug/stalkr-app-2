/**
 * Logic tests for the device-contacts helper. No jest in this project — run with:
 *   npx tsx src/utils/contacts.test.ts
 * Exits non-zero on failure.
 */
import { cleanDeviceContacts, filterContacts } from './contacts';

let pass = 0, fail = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++; console.log('  ✓ ' + label); }
  else { fail++; console.log('  ✗ ' + label + '\n      got:  ' + g + '\n      want: ' + w); }
};

// 1. phone preferred over email, name trimmed, sorted by name
const a = cleanDeviceContacts([
  { id: 1, name: 'Zoe',   phoneNumbers: [{ number: '555-2' }], emails: [{ email: 'z@x.com' }] },
  { id: 2, name: ' Ana ', phoneNumbers: [], emails: [{ email: 'ana@x.com' }] },
]);
eq('sorted by name', a.map(c => c.name), ['Ana', 'Zoe']);
eq('phone preferred for Zoe', a.find(c => c.name === 'Zoe')!.value, '555-2');
eq('Zoe is not email', a.find(c => c.name === 'Zoe')!.isEmail, false);
eq('Ana falls back to email', a.find(c => c.name === 'Ana')!.value, 'ana@x.com');
eq('Ana flagged isEmail', a.find(c => c.name === 'Ana')!.isEmail, true);

// 2. contacts with neither phone nor email are dropped
const b = cleanDeviceContacts([
  { id: 3, name: 'NoContact', phoneNumbers: [], emails: [] },
  { id: 4, name: 'Has', phoneNumbers: [{ number: '999' }] },
]);
eq('drops contacts with no value', b.map(c => c.name), ['Has']);

// 3. duplicate phone numbers (whitespace/case-insensitive) de-duplicated
const c = cleanDeviceContacts([
  { id: 5, name: 'Bob',   phoneNumbers: [{ number: '555 123' }] },
  { id: 6, name: 'Bobby', phoneNumbers: [{ number: '555123' }] },
]);
eq('dedupes equal numbers ignoring spaces', c.length, 1);

// 4. missing name -> 'Unknown'; null number skipped to next
const d = cleanDeviceContacts([
  { id: 7, phoneNumbers: [{ number: null }, { number: '777' }] },
]);
eq('missing name -> Unknown', d[0].name, 'Unknown');
eq('skips null number to next', d[0].value, '777');

// 5. empty input -> empty list (the "no contacts shared" / Limited Access case)
eq('empty input -> empty list', cleanDeviceContacts([]), []);

// 6. filter: name and value, case-insensitive; empty query passthrough
eq('filter empty query passthrough', filterContacts(a, '').length, 2);
eq('filter by name ci', filterContacts(a, 'zo').map(x => x.name), ['Zoe']);
eq('filter by value', filterContacts(a, 'ana@').map(x => x.name), ['Ana']);
eq('filter no match', filterContacts(a, 'qqq'), []);

console.log('\n' + (fail === 0 ? 'ALL PASS (' + pass + ')' : fail + ' FAILED, ' + pass + ' passed'));
process.exit(fail === 0 ? 0 : 1);
