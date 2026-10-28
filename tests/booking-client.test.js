import test from 'node:test';
import assert from 'node:assert/strict';
import { bookingActions, bookingId, offerFromDraft, bookingAsset, createBookingClient, confirmedBookingReceipt, seatAmounts } from '../decent-calendar-vanilla/js/booking-client.js';
import { counterpartTime, validTimeZone } from '../decent-calendar-vanilla/js/timezones.js';
import { createPublicAvailability, importPublicAvailability } from '../decent-calendar-vanilla/js/calendar-data.js';

const host = `0x${'a'.repeat(40)}`, buyer = `0x${'b'.repeat(40)}`, other = `0x${'c'.repeat(40)}`;
const seat = (attendee, state = 1) => ({ attendee, state, deposit: 1n, timezone: 'Asia/Tokyo' });
test('timebox actions mirror contract roles, minimums and exact block-time boundaries', () => {
  const slot = { host, start: 100n, end: 200n, state: 0, attendees: 1, minAttendees: 1, maxAttendees: 2, seats: [seat(buyer)] };
  assert.deepEqual(bookingActions(slot, buyer, 99n).refund, []);
  assert.equal(bookingActions(slot, buyer, 199n).release, false);
  assert.equal(bookingActions(slot, buyer, 200n).release, true);
  assert.deepEqual(bookingActions(slot, buyer, 604999n).refund, []);
  assert.deepEqual(bookingActions(slot, buyer, 605000n).refund, [buyer]);
  assert.deepEqual(bookingActions(slot, host.toUpperCase(), 50n).refund, [buyer]);
  assert.equal(bookingActions(slot, host, 50n).cancel, true);
  assert.equal(bookingActions(slot, other, 99n).join, true);
  assert.equal(bookingActions(slot, other, 100n).join, false);
  assert.equal(bookingActions(slot, buyer, 99n).join, false);
  assert.equal(bookingActions({ ...slot, attendees: 2 }, other, 99n).join, false);
  const unmet = { ...slot, minAttendees: 2 };
  assert.equal(bookingActions(unmet, buyer, 200n).release, false);
  assert.deepEqual(bookingActions(unmet, buyer, 100n).refund, [buyer]);
  assert.deepEqual(bookingActions(unmet, buyer, 99n).refund, []);
  const none = bookingActions(slot, null, 605000n);
  assert.ok(!none.join && !none.cancel && !none.release && !none.refund.length);
  const cancelled = bookingActions({ ...slot, state: 1 }, host, 50n);
  assert.ok(!cancelled.cancel && !cancelled.refund.length);
});
test('split deposits total/minimum and charges total/actual, rounding up', () => {
  const split = { pricing: 1, price: 1000000000000000000n, minAttendees: 2, attendees: 3 };
  assert.deepEqual(seatAmounts(split), { deposit: 500000000000000000n, charge: 333333333333333334n });
  assert.deepEqual(seatAmounts({ pricing: 0, price: 7n, minAttendees: 2, attendees: 3 }), { deposit: 7n, charge: 7n });
});
test('timebox IDs are positive, reject coercion, exponent notation, negatives and uint256 overflow', () => {
  assert.equal(bookingId('1'), 1n);
  assert.equal(bookingId(2n ** 256n - 1n), 2n ** 256n - 1n);
  for (const value of ['', '0', '00', ' 1', '-1', '1.0', '1e2', 2n ** 256n]) assert.throws(() => bookingId(value));
  assert.throws(() => bookingAsset(host), /reviewed icon/);
});
test('public offer keeps exact terms, pricing, seats and host timezone, never description or meeting IDs', () => {
  const event = { title: 'Learn together', creator: host, start: '2026-11-02T10:00:00Z', end: '2026-11-02T11:30:00Z',
    isPublic: true, assetId: 'base:usdc', rateAmount: '1.01', hardline: true, meetingRoomId: 'secret', description: 'private',
    pricing: 'split', minAttendees: 2, maxAttendees: 5, timezone: 'America/Denver' };
  const offer = offerFromDraft(event);
  assert.equal(offer.price, 1515000n);
  assert.equal(offer.pricing, 1);
  assert.equal(offer.hardline, true);
  assert.equal(offer.end - offer.start, 5400n);
  assert.equal(offer.subject, event.title);
  assert.equal(offer.timezone, 'America/Denver');
  assert.deepEqual([offer.minAttendees, offer.maxAttendees], [2, 5]);
  assert.equal(offer.meetingRoomId, undefined);
  assert.equal(offer.description, undefined);
  for (const change of [{ isPublic: false }, { readOnly: true }, { title: 'x'.repeat(201) }, { title: '\u00e9'.repeat(101) }, { hardline: 'true' },
    { timezone: undefined }, { timezone: 'Mars/Base' }, { pricing: 'auction' }, { minAttendees: 0 }, { minAttendees: 6 }, { maxAttendees: 51 }]) {
    assert.throws(() => offerFromDraft({ ...event, ...change }));
  }
});
test('counterpart time shows their wall clock, offset, day shift and day/night without hiding DST', () => {
  assert.equal(counterpartTime('2026-11-05T17:00:00Z', '2026-11-05T18:00:00Z', 'Asia/Tokyo', 'host', 'America/Denver').replace(/\u202f/g, ' '),
    '🌙 2:00 AM - 3:00 AM Fri for host (Asia/Tokyo, +16h vs you, +1 day)');
  assert.match(counterpartTime('2026-07-05T17:00:00Z', '2026-07-05T18:00:00Z', 'Asia/Tokyo', 'host', 'America/Denver'), /\+15h vs you/);
  assert.match(counterpartTime('2026-11-05T17:00:00Z', '2026-11-05T18:00:00Z', 'Asia/Kolkata', 'them', 'America/Denver'), /☀|🌙/);
  assert.match(counterpartTime('2026-11-05T17:00:00Z', '2026-11-05T18:00:00Z', 'Asia/Kolkata', 'them', 'America/Denver'), /\+12h30 vs you/);
  assert.match(counterpartTime(0, 1, 'Mars/Base', 'them'), /unavailable/);
  for (const zone of ['', 'Europe/Lisbon;', 'America/New York', 'Mars/Base']) assert.equal(validTimeZone(zone), false);
  assert.equal(validTimeZone('Etc/GMT+5'), true);
});
test('public availability publishes host timezone and seat terms but never private events', () => {
  const owner = host, store = new Map();
  const storage = { getItem: key => store.get(key) ?? null, setItem: (key, value) => store.set(key, value) };
  storage.setItem(owner, JSON.stringify([
    { owner, title: 'Open', start: '2030-01-01T15:00:00Z', end: '2030-01-01T16:00:00Z', hourlyRate: 0, currency: 'USDC', isPublic: true,
      assetId: 'base:usdc', rateAmount: '10', pricing: 'split', minAttendees: 2, maxAttendees: 4, timezone: 'Europe/Lisbon' },
    { owner, title: 'Secret', start: '2030-01-02T15:00:00Z', end: '2030-01-02T16:00:00Z', hourlyRate: 0, currency: 'ETH', isPublic: false, meetingRoomId: 'room' },
  ]));
  const doc = createPublicAvailability(storage, owner);
  assert.equal(doc.events.length, 1);
  assert.ok(!JSON.stringify(doc).includes('Secret') && !JSON.stringify(doc).includes('room'));
  const [event] = importPublicAvailability(doc).events;
  assert.deepEqual([event.timezone, event.pricing, event.minAttendees, event.maxAttendees], ['Europe/Lisbon', 'split', 2, 4]);
  storage.setItem(owner, JSON.stringify([{ ...JSON.parse(store.get(owner))[0], timezone: 'Mars/Base' }]));
  assert.throws(() => createPublicAvailability(storage, owner), /timezone/);
});
test('an unconfigured or disabled registry cannot request transactions or simulate empty availability', async () => {
  let requests = 0;
  const client = createBookingClient({ config: {}, provider: { send() { requests++; } }, getSession: () => { requests++; } });
  await assert.rejects(client.read(1), /not deployed and pinned/);
  await assert.rejects(client.approve(1), /remain gated/);
  await assert.rejects(client.join({ id: 1 }, 'UTC'), /remain gated/);
  await assert.rejects(client.join({ id: 1 }, 'Mars/Base'), /valid IANA/);
  await assert.rejects(client.release(1), /remain gated/);
  await assert.rejects(client.refund(1, buyer), /remain gated/);
  await assert.rejects(client.cancel(1), /remain gated/);
  assert.equal(requests, 0);
});
test('receipt recovery accepts only successful identical speed-ups, never cancellation or changed instructions', async () => {
  const events = [], original = { to: host, data: '0x1234', value: 1n, hash: 'original' };
  const replacement = { ...original, hash: 'replacement' }, receipt = { hash: replacement.hash, status: 1 };
  const transaction = error => ({ ...original, wait: async () => { throw error; } });
  const replaced = { code: 'TRANSACTION_REPLACED', cancelled: false, replacement, receipt };
  assert.equal(await confirmedBookingReceipt(transaction(replaced), value => events.push(value)), receipt);
  assert.deepEqual(events.map(event => event.phase), ['replacement', 'confirmed']);
  for (const change of [
    { cancelled: true }, { replacement: { ...replacement, data: '0xabcd' } },
    { replacement: { ...replacement, to: buyer } }, { replacement: { ...replacement, value: 2n } },
    { receipt: { ...receipt, status: 0 } },
  ]) await assert.rejects(confirmedBookingReceipt(transaction({ ...replaced, ...change }), () => {}), /reconcile/i);
  const rejection = Object.assign(new Error('User rejected signing'), { code: 'ACTION_REJECTED' });
  await assert.rejects(confirmedBookingReceipt(transaction(rejection), () => {}), error => error === rejection);
});
