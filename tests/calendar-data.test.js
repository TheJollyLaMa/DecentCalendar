import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_BACKUP_BYTES, createLocalBackup, restoreLocalBackup, createPublicAvailability,
  importPublicAvailability, readLocalCalendar, validateDocument,
} from '../decent-calendar-vanilla/js/calendar-data.js';

const owner = `0x${'a'.repeat(40)}`;
const other = `0x${'b'.repeat(40)}`;
const event = (overrides = {}) => ({
  version: '0.1', type: 'timeslot', title: 'A conversation', description: 'Public description',
  owner, creator: owner, start: '2026-11-01T10:00:00Z', end: '2026-11-01T11:00:00Z',
  hourlyRate: 0.1, currency: 'ETH', isPublic: true, tokenId: 0,
  meetingRoomId: 'private-room', status: 'pending', ...overrides,
});
const storage = events => {
  const values = new Map([[owner, JSON.stringify(events)], ['unrelated', 'never export me']]);
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), values };
};

test('local backup is wallet scoped and preserves private events and token zero', () => {
  const source = storage([event(), event({ isPublic: false, title: 'Private' })]);
  const data = createLocalBackup(source, owner.toUpperCase().replace('0X', '0x'));
  assert.equal(data.events.length, 2);
  assert.equal(data.events[0].tokenId, 0);
  assert.equal(data.events[1].meetingRoomId, 'private-room');
  assert.ok(!JSON.stringify(data).includes('never export me'));
});

test('public availability is a strict projection with no room, private or booking data', () => {
  const data = createPublicAvailability(storage([
    event({ privateFeedToken: 'secret', buyer: other }), event({ isPublic: false, title: 'Private title' }),
  ]), owner);
  assert.deepEqual(Object.keys(data.events[0]).sort(), [
    'version', 'type', 'owner', 'creator', 'title', 'description', 'start', 'end', 'hourlyRate', 'currency', 'isPublic',
  ].sort());
  assert.equal(data.events.length, 1);
  const json = JSON.stringify(data);
  for (const secret of ['private-room', 'Private title', 'secret', other, 'tokenId', 'pending']) assert.ok(!json.includes(secret));
});

test('public imports discard injected privileges and cannot become bookings or local restores', () => {
  const data = createPublicAvailability(storage([event()]), owner);
  Object.assign(data.events[0], { meetingRoomId: 'forged-room', status: 'booked', tokenId: 42 });
  const result = importPublicAvailability(data);
  assert.equal(result.events[0].readOnly, true);
  assert.deepEqual(result.events[0].classNames, ['imported-event']);
  for (const key of ['meetingRoomId', 'tokenId', 'status']) assert.equal(result.events[0][key], undefined);
  const local = storage([]);
  assert.throws(() => restoreLocalBackup(local, owner, data), /local-backup/);
  assert.equal(local.getItem(owner), '[]');
});

test('restore validates fully before writing, only to the same wallet', () => {
  const target = storage([event()]);
  const backup = createLocalBackup(target, owner);
  target.setItem(other, 'other wallet untouched');
  backup.events.push(event({ isPublic: false }));
  assert.throws(() => restoreLocalBackup(target, other, backup), /owns this backup/);
  assert.equal(restoreLocalBackup(target, owner, backup), 2);
  assert.equal(JSON.parse(target.getItem(owner)).length, 2);
  assert.equal(target.getItem(other), 'other wallet untouched');
  assert.equal(target.getItem('unrelated'), 'never export me');
  const before = target.getItem(owner);
  backup.events[1].end = 'not a date';
  assert.throws(() => restoreLocalBackup(target, owner, backup), /valid start and end/);
  assert.equal(target.getItem(owner), before);
});

test('invalid schema, size, visibility, owner and numeric values are rejected explicitly', () => {
  const valid = () => createLocalBackup(storage([event()]), owner);
  for (const mutate of [
    data => { data.version = 2; },
    data => { data.owner = 'not-wallet'; },
    data => { data.events[0].creator = other; },
    data => { delete data.events[0].isPublic; },
    data => { data.events[0].hourlyRate = -1; },
    data => { data.events[0].end = data.events[0].start; },
    data => { data.events[0].tokenId = Number.MAX_SAFE_INTEGER + 1; },
    data => { data.events = Array.from({ length: 2001 }, () => event()); },
    data => { data.extra = 'x'.repeat(MAX_BACKUP_BYTES); },
  ]) {
    const data = valid();
    mutate(data);
    assert.throws(() => validateDocument(data, 'local-backup'));
  }
  const publicData = createPublicAvailability(storage([event()]), owner);
  publicData.events[0].isPublic = false;
  assert.throws(() => importPublicAvailability(publicData), /cannot contain private/);
});

test('legacy POL events retain denomination; malformed legacy data is not silently replaced', () => {
  const source = storage([event({ currency: 'POL' })]);
  assert.equal(readLocalCalendar(source, owner)[0].currency, 'POL');
  source.setItem(owner, '{broken JSON');
  assert.throws(() => createLocalBackup(source, owner), SyntaxError);
  assert.equal(source.getItem(owner), '{broken JSON');
});
