import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { createLayerStore, projectLayers, overlaps, layerStale } from '../decent-calendar-vanilla/js/calendar-layers.js';
import { appointmentCalendarEvent } from '../decent-calendar-vanilla/js/appointments.js';

const host = `0x${'1'.repeat(40)}`, guest = `0x${'2'.repeat(40)}`, registry = `0x${'9'.repeat(40)}`;
const now = Date.parse('2026-11-09T11:00Z');
const seconds = text => BigInt(Date.parse(text) / 1000);
const offer = (id = 1n) => ({
  id, host, invitee: guest, subject: 'Public window', timezone: 'America/New_York',
  duration: 1800, now: BigInt(now / 1000), closed: false, bookedDays: new Set(),
  windows: [{ start: seconds('2026-11-09T12:00Z'), end: seconds('2026-11-09T15:00Z'), day: 20261109 }],
});
const appointment = (cancelled = false) => ({
  id: 7n, offerId: 1n, host, invitee: guest, subject: 'Public appointment',
  timezone: 'America/New_York', start: seconds('2026-11-09T12:30Z'), end: seconds('2026-11-09T13:00Z'),
  cancelled, now: BigInt(now / 1000),
});
const data = (offers = [offer()], appointments = [appointment()]) => ({
  offers, appointments, offerCount: BigInt(offers.length), appointmentCount: BigInt(appointments.length), now: BigInt(now / 1000),
});
const layer = (address = host, value = data()) => ({
  address, label: address === host ? 'host.eth' : 'guest.eth', color: '#ffc477', visible: true,
  status: 'ready', checkedAt: now, data: value,
});
const project = (layers, options = {}) => projectLayers(layers, { registry, now, ...options });

test('wallet/ENS public reads require explicit consent, validate nonzero resolution, deduplicate casing', async () => {
  let reads = 0, resolutions = 0;
  const store = createLayerStore({ resolveAddress: async input => { resolutions++; return input === 'host.eth' ? host : input; },
    readWallet: async () => { reads++; return data(); }, now: () => now });
  await assert.rejects(store.add('host.eth', false), /Approve/);
  assert.equal(resolutions, 0);
  await assert.rejects(store.add(`0x${'0'.repeat(40)}`, true), /non-zero/);
  await assert.rejects(store.add('bad-wallet', true), /non-zero/);
  assert.equal(reads, 0);
  await store.add('host.eth', true);
  await assert.rejects(store.add(host.toUpperCase().replace('0X', '0x'), true), /already/);
  assert.equal(reads, 1);
  assert.equal(store.list()[0].label, 'host.eth');
});

test('checkbox visibility does not refetch or sign and removal cancels late reads', async () => {
  let reads = 0, complete;
  const store = createLayerStore({ resolveAddress: async input => input,
    readWallet: () => { reads++; return new Promise(resolve => { complete = resolve; }); } });
  const added = store.add(host, true);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(store.list()[0].status, 'loading');
  store.toggle(host, false); store.toggle(host, true);
  assert.equal(reads, 1);
  store.remove(host);
  complete(data()); await added;
  assert.deepEqual(store.list(), []);
});

test('session reset clears resolved wallets, pending requests and previous data', async () => {
  let resolve;
  const store = createLayerStore({ resolveAddress: () => new Promise(done => { resolve = done; }), readWallet: async () => data() });
  const pending = store.add('host.eth', true);
  store.clear(); resolve(host); await pending;
  assert.deepEqual(store.list(), []);
});

test('registry/RPC failures are errors, retry is real, failure preserves only marked stale evidence', async () => {
  let fail = true, reads = 0;
  const store = createLayerStore({ resolveAddress: async input => input, now: () => now,
    readWallet: async () => { reads++; if (fail) throw new Error('RPC unavailable; availability unknown'); return data(); } });
  await store.add(host, true);
  assert.equal(store.list()[0].status, 'error');
  assert.match(store.list()[0].error, /unknown/);
  assert.deepEqual(project(store.list()), []);
  fail = false; await store.refresh(host, 100);
  assert.equal(store.list()[0].status, 'ready'); assert.equal(store.list()[0].limit, 100);
  fail = true; await store.refresh(host);
  assert.equal(store.list()[0].status, 'stale');
  assert.ok(project(store.list()).every(event => event.stale));
  assert.equal(reads, 3);
});

test('multi-wallet merge preserves source/event/wallet identity without duplicate host/guest records', () => {
  const events = project([layer(), layer(guest)]);
  assert.equal(events.length, 2);
  for (const event of events) {
    assert.deepEqual(event.layerWallets, [host, guest]);
    assert.deepEqual(event.layerLabels, ['host.eth', 'guest.eth']);
    assert.equal(event.sourceRegistry, registry);
    assert.equal(event.readOnly, true);
  }
  assert.equal(events.find(event => event.layerKind === 'candidate').conflictIds.length, 1);
  const own = appointmentCalendarEvent(appointment(), registry);
  const withoutDuplicate = project([layer(), layer(guest)], { ownEvents: [own] });
  assert.equal(withoutDuplicate.length, 1);
  assert.deepEqual(withoutDuplicate[0].conflictIds, [own.id]);
  assert.equal(project([{ ...layer(), visible: false }]).length, 0);
});

test('cancelled snapshots are visible but not busy; stale mixed-source merge remains stale', () => {
  const events = project([layer(host, data([offer()], [appointment(true)])), { ...layer(guest), status: 'stale' }]);
  assert.ok(events.every(event => event.stale));
  assert.equal(project([layer(host, data([offer()], [appointment(true)]))])[0].conflictIds.length, 0);
  assert.equal(events.find(event => event.layerKind === 'cancelled').cancelled, true);
  assert.equal(layerStale(layer(), now + 60000), true);
});

test('newer checked cancellation and closed policies supersede older participant snapshots', () => {
  const older = layer();
  const newerOffer = { ...offer(), closed: true, now: BigInt(now / 1000) + 60n };
  const newerAppointment = { ...appointment(true), now: BigInt(now / 1000) + 60n };
  const events = project([older, layer(guest, data([newerOffer], [newerAppointment]))]);
  assert.equal(events.length, 1);
  assert.equal(events[0].layerKind, 'cancelled');
  assert.deepEqual(events[0].layerWallets, [host, guest]);
});

test('each layer read is bounded and the six-layer maximum is explicit', async () => {
  const limits = [];
  const store = createLayerStore({ resolveAddress: async input => input,
    readWallet: async (_address, limit) => { limits.push(limit); return data([], []); } });
  for (let value = 1; value <= 6; value++) await store.add(`0x${String(value).repeat(40)}`, true);
  await assert.rejects(store.add(`0x${'7'.repeat(40)}`, true), /six/);
  assert.deepEqual(limits, [20, 20, 20, 20, 20, 20]);
  store.remove(host); await store.add(`0x${'7'.repeat(40)}`, true);
  assert.equal(store.list().length, 6);
});

test('half-open boundaries and actual dates distinguish candidate overlaps from known busy', () => {
  assert.equal(overlaps({ start: '2026-11-09T12:00Z', end: '2026-11-09T13:00Z' },
    { start: '2026-11-09T13:00Z', end: '2026-11-09T14:00Z' }), false);
  const second = { ...offer(2n), windows: [{ start: seconds('2026-11-09T14:30Z'), end: seconds('2026-11-09T16:00Z'), day: 20261109 }] };
  const tomorrow = { ...offer(3n), windows: [{ start: seconds('2026-11-10T12:00Z'), end: seconds('2026-11-10T15:00Z'), day: 20261110 }] };
  const events = project([layer(host, data([offer(), second, tomorrow], []))]);
  assert.equal(events[0].candidateOverlapIds.length, 1);
  assert.equal(events[1].candidateOverlapIds.length, 1);
  assert.equal(events[2].candidateOverlapIds.length, 0);
  assert.ok(events.every(event => !event.conflictIds.length));
});

test('elapsed choices, booked days, closed windows and unrelated wallets are never availability', () => {
  const available = project([layer()], { now: Date.parse('2026-11-09T12:00Z') }).find(event => event.layerKind === 'candidate');
  assert.equal(available.start, '2026-11-09T12:30:00.000Z');
  assert.equal(project([layer(host, data([{ ...offer(), bookedDays: new Set([20261109]) }], []))]).length, 0);
  assert.equal(project([layer(host, data([{ ...offer(), closed: true }], []))]).length, 0);
  assert.equal(project([layer(host, data([offer()], []))], { now: Date.parse('2026-11-09T15:00Z') }).length, 0);
  assert.equal(project([layer(`0x${'3'.repeat(40)}`)]).length, 0);
  const privateOwn = { id: 'my-private', title: 'never sent', isPublic: false, start: '2026-11-09T12:00Z', end: '2026-11-09T13:00Z' };
  const withOwn = project([layer(host, data([offer()], []))], { ownEvents: [privateOwn] });
  assert.deepEqual(withOwn[0].conflictIds, ['my-private']);
  assert.ok(!JSON.stringify(withOwn).includes('never sent'));
});

test('calendar routes overlay clicks only to read-only inspection, preserving own appointment hook', async () => {
  const calls = [];
  const context = vm.createContext({ window: { openCalendarLayerEvent: event => calls.push(['layer', event]),
    DCalAppointments: { openAppointment: id => calls.push(['appointment', id]) },
    openSlotDetails: () => { throw new Error('Overlay cannot enter legacy checkout'); } },
    document: { getElementById: () => null } });
  vm.runInContext(await readFile(new URL('../decent-calendar-vanilla/js/calendar.js', import.meta.url), 'utf8'), context);
  context.handleEventClick({ event: { title: 'Candidate', start: new Date(now), end: new Date(now + 1800000),
    extendedProps: { calendarLayer: true, availabilityId: '1', readOnly: true }, classNames: [] } });
  context.handleEventClick({ event: { title: 'Own', extendedProps: { appointmentSnapshot: true, appointmentId: '7' }, classNames: [] } });
  assert.equal(calls[0][0], 'layer');
  assert.deepEqual(calls[1], ['appointment', '7']);
});

test('own recovered appointments remain separate and are never rendered twice through public layers', async () => {
  const context = vm.createContext({ window: {}, document: { getElementById: () => null } });
  vm.runInContext(await readFile(new URL('../decent-calendar-vanilla/js/calendar.js', import.meta.url), 'utf8'), context);
  context.window.setAppointmentSnapshots([appointmentCalendarEvent(appointment(), registry)]);
  context.window.setCalendarLayerProjector(ownEvents => project([layer()], { ownEvents }));
  const events = context.getVisibleEvents();
  assert.equal(events.length, 2);
  assert.equal(events.filter(event => event.appointmentSnapshot).length, 1);
  assert.equal(events.find(event => event.calendarLayer).layerKind, 'candidate');
  vm.runInContext('myEventsVisible = false', context);
  assert.equal(context.getVisibleEvents().length, 1);
});
