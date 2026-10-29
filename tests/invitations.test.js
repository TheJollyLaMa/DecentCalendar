import test from 'node:test';
import assert from 'node:assert/strict';
import {
  inviteAddress, timeboxLink, invitationRecipient, invitationState, createInvitationStore,
  calendarICS, googleCalendarLink, foldICS, shareInvitation,
} from '../decent-calendar-vanilla/js/invitations.js';

const host = `0x${'a'.repeat(40)}`, attendee = `0x${'b'.repeat(40)}`, registry = `0x${'c'.repeat(40)}`;
const base = 'https://example.com/nested/dcal/?booking=99&private=secret#note';
const slot = {
  id: 1n, host, subject: 'Learning, together;\n🔮'.repeat(10), hostTimezone: 'America/New_York',
  start: BigInt(Date.parse('2026-11-01T05:30:00Z') / 1000),
  end: BigInt(Date.parse('2026-11-01T07:30:00Z') / 1000), hardline: true,
};
const config = { registry, base, now: new Date('2026-10-29T10:00:00Z') };

test('invite links keep the nested route but never carry unrelated data', () => {
  const link = timeboxLink(base, 1, attendee.toUpperCase().replace('0X', '0x'));
  assert.equal(link, `https://example.com/nested/dcal/?booking=1&invite=${attendee}`);
  assert.equal(invitationRecipient(link, 1), attendee);
  assert.equal(invitationRecipient(link, 2), null);
  assert.equal(invitationRecipient(timeboxLink(base, 1), 1), null);
  assert.throws(() => timeboxLink(base, 0), /positive decimal/);
  assert.throws(() => timeboxLink('javascript:alert(1)', 1), /Unsupported/);
  assert.throws(() => invitationRecipient('https://x/?booking=1&invite=not-an-address', 1), /non-zero/);
  assert.throws(() => inviteAddress(`0x${'0'.repeat(40)}`), /non-zero/);
});

test('invitation roster is scoped by registry, host and ID; deduplicates normalized addresses', () => {
  const values = new Map(), storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  const store = createInvitationStore(storage, { registry, host, id: 1 });
  assert.deepEqual(store.read(), []);
  store.add(attendee); store.add(attendee.toUpperCase().replace('0X', '0x'));
  assert.deepEqual(store.read(), [attendee]);
  assert.deepEqual(createInvitationStore(storage, { registry, host, id: 2 }).read(), []);
  assert.deepEqual(createInvitationStore(storage, { registry, host: attendee, id: 1 }).read(), []);
  assert.deepEqual(store.remove(attendee), []);
});

test('storage errors and corrupt rosters are explicit, not treated as an empty list', () => {
  const broken = createInvitationStore({ getItem() { throw new Error('denied'); } }, { registry, host, id: 1 });
  assert.throws(() => broken.read(), /denied/);
  for (const raw of ['bad JSON', '{}', '["0x0"]']) {
    const store = createInvitationStore({ getItem: () => raw }, { registry, host, id: 1 });
    assert.throws(() => store.read());
  }
});

test('local invite does not pretend to be a joined seat; chain controls seat labels', () => {
  assert.match(invitationState(attendee, []), /not joined/);
  assert.equal(invitationState(attendee, [{ attendee, state: 1 }]), 'Funded (chain)');
  assert.equal(invitationState(attendee, [{ attendee, state: 3 }]), 'Refunded (chain)');
});

test('ICS is CRLF, escaped, UTF-8 folded and uses UTC across DST with stable registry-specific UID', () => {
  const ics = calendarICS(slot, config), unfolded = ics.replace(/\r\n /g, '');
  assert.ok(ics.endsWith('END:VCALENDAR\r\n'));
  assert.ok(ics.split('\r\n').every(line => new TextEncoder().encode(line).length <= 75));
  assert.ok(!ics.replace(/\r\n/g, '').includes('\n'));
  assert.match(unfolded, /DTSTART:20261101T053000Z\r\nDTEND:20261101T073000Z/);
  assert.match(unfolded, /DTSTAMP:20261029T100000Z/);
  assert.ok(unfolded.includes(`UID:8453-${registry}-1@decentcalendar`));
  assert.ok(unfolded.includes('Learning\\, together\\;\\n🔮'));
  assert.ok(unfolded.includes('Host timezone: America/New_York'));
  assert.ok(!unfolded.includes('private=secret'));
  assert.ok(!unfolded.includes('ATTENDEE:'));
  assert.ok(unfolded.includes('does not join'));
  assert.ok(!calendarICS(slot, { ...config, registry: host }).includes(`UID:8453-${registry}`));
  assert.throws(() => calendarICS({ ...slot, end: slot.start }, config), /interval/);
});

test('ICS escaping cannot inject a new property and folding preserves Unicode', () => {
  const unfolded = calendarICS({ ...slot, subject: 'Title\r\nATTENDEE:evil\\,\rmore' }, config).replace(/\r\n /g, '');
  assert.ok(unfolded.includes('SUMMARY:Title\\nATTENDEE:evil\\\\\\,\\nmore'));
  assert.ok(!unfolded.includes('\r\nATTENDEE:'));
  const text = '🔮'.repeat(100);
  assert.equal(foldICS(text).replace(/\r\n /g, ''), text);
});

test('Google template shares the same UTC interval and strips invitation/private metadata', () => {
  const url = new URL(googleCalendarLink(slot, { base: timeboxLink(base, 1, attendee) }));
  assert.equal(url.origin, 'https://calendar.google.com');
  assert.equal(url.searchParams.get('dates'), '20261101T053000Z/20261101T073000Z');
  assert.equal(url.searchParams.get('text'), slot.subject);
  assert.ok(url.searchParams.get('details').includes('timezone: America/New_York'));
  assert.ok(!url.searchParams.get('details').includes(attendee));
});

test('share cancellation does not copy; unavailable sharing falls back explicitly; clipboard failure rejects', async () => {
  const info = { title: 'DCal', url: timeboxLink(base, 1) };
  let copied = '';
  const clipboard = { writeText: async value => { copied = value; } };
  assert.match(await shareInvitation(info, { clipboard }), /Link copied/);
  assert.equal(copied, info.url);
  copied = '';
  assert.match(await shareInvitation(info, { clipboard, share: async () => { throw Object.assign(new Error(), { name: 'AbortError' }); } }), /cancelled/);
  assert.equal(copied, '');
  assert.match(await shareInvitation(info, { clipboard, share: async () => { throw new Error('unavailable'); } }), /Device share unavailable/);
  await assert.rejects(shareInvitation(info, { clipboard: { writeText: async () => { throw new Error('denied'); } } }), /denied/);
  await assert.rejects(shareInvitation(info, {}), /Select and copy/);
});
