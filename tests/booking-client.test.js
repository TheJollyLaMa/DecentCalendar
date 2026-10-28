import test from 'node:test';
import assert from 'node:assert/strict';
import { bookingActions, bookingId, offerFromDraft, bookingAsset, createBookingClient, confirmedBookingReceipt } from '../decent-calendar-vanilla/js/booking-client.js';

const host = `0x${'a'.repeat(40)}`, buyer = `0x${'b'.repeat(40)}`;
test('booking actions use exact block-time boundaries and on-chain party roles', () => {
  const slot = { host, buyer, start: 100n, end: 200n, state: 1 };
  assert.equal(bookingActions(slot, buyer, 99n).refund, true);
  assert.equal(bookingActions(slot, buyer, 100n).refund, false);
  assert.equal(bookingActions(slot, buyer, 199n).release, false);
  assert.equal(bookingActions(slot, buyer, 200n).release, true);
  assert.equal(bookingActions(slot, buyer, 604999n).refund, false);
  assert.equal(bookingActions(slot, buyer, 605000n).refund, true);
  assert.equal(bookingActions(slot, host.toUpperCase(), 100n).refund, true);
  assert.ok(Object.values(bookingActions(slot, null, 605000n)).every(value => !value));
  assert.ok(Object.values(bookingActions({ ...slot, state: 3 }, buyer, 605000n)).every(value => !value));
  assert.equal(bookingActions({ ...slot, state: 0 }, buyer, 100n).book, false);
});
test('booking IDs include zero, reject coercion, exponent notation, negatives and uint256 overflow', () => {
  assert.equal(bookingId('0'), 0n);
  assert.equal(bookingId(2n ** 256n - 1n), 2n ** 256n - 1n);
  for (const value of ['', '00', ' 0', '-1', '1.0', '1e2', 2n ** 256n]) assert.throws(() => bookingId(value));
  assert.throws(() => bookingAsset(host), /unsupported/);
});
test('public offer keeps exact terms and hardline, never description or meeting IDs', () => {
  const event = { title: 'Learn together', creator: host, start: '2026-11-02T10:00:00Z', end: '2026-11-02T11:30:00Z',
    isPublic: true, assetId: 'base:usdc', rateAmount: '1.01', hardline: true, meetingRoomId: 'secret', description: 'private' };
  const offer = offerFromDraft(event);
  assert.equal(offer.gross, 1515000n);
  assert.equal(offer.hardline, true);
  assert.equal(offer.end - offer.start, 5400n);
  assert.equal(offer.metadata, event.title);
  assert.equal(offer.meetingRoomId, undefined);
  assert.equal(offer.description, undefined);
  for (const change of [{ isPublic: false }, { readOnly: true }, { title: 'x'.repeat(201) }, { title: '\u00e9'.repeat(101) }, { hardline: 'true' }]) {
    assert.throws(() => offerFromDraft({ ...event, ...change }));
  }
});
test('an unconfigured or disabled registry cannot request transactions or simulate empty availability', async () => {
  let requests = 0;
  const client = createBookingClient({ config: {}, provider: { send() { requests++; } }, getSession: () => { requests++; } });
  await assert.rejects(client.read(0), /not deployed and pinned/);
  await assert.rejects(client.approve(0), /remain gated/);
  await assert.rejects(client.book({ id: 0 }), /remain gated/);
  await assert.rejects(client.release(0), /remain gated/);
  await assert.rejects(client.refund(0), /remain gated/);
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
