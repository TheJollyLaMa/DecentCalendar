import test from 'node:test';
import assert from 'node:assert/strict';
import { unreadInvitations, createInboxPreferences, createInboxClient } from '../decent-calendar-vanilla/js/invitation-inbox.js';
const registry = `0x${'a'.repeat(40)}`, wallet = `0x${'b'.repeat(40)}`, host = `0x${'c'.repeat(40)}`;
test('unknown invitations are requests; only unread active trusted unmuted invitations glow', () => {
  const values = new Map(), storage = { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) };
  const preferences = createInboxPreferences(storage, registry, wallet);
  const items = [{ key: 'id', host, revision: '1', active: true }];
  assert.equal(unreadInvitations(items, preferences.read()), 0);
  preferences.update(state => { state.trusted.push(host); });
  assert.equal(unreadInvitations(items, preferences.read()), 1);
  preferences.update(state => { state.seen.id = '1'; });
  assert.equal(unreadInvitations(items, preferences.read()), 0);
  items[0].revision = '2';
  assert.equal(unreadInvitations(items, preferences.read()), 1);
  preferences.update(state => { state.blocked.push(host); });
  assert.equal(unreadInvitations(items, preferences.read()), 0);
  assert.equal(unreadInvitations(items, createInboxPreferences(storage, registry, host).read()), 0);
});

test('inbox failures remain errors rather than an empty success', async () => {
  const options = { config: { address: registry, runtimeCodeHash: 'expected' }, booking: host,
    provider: { getNetwork: async () => ({ chainId: 8453n }), getCode: async () => 'code' },
    hashCode: () => 'wrong', getSession: () => ({}) };
  await assert.rejects(createInboxClient({ ...options, config: {} }).read(wallet), /not pinned/);
  await assert.rejects(createInboxClient(options).read(wallet), /does not match/);
  await assert.rejects(createInboxClient({ ...options, provider: { getNetwork: async () => ({ chainId: 1n }) } }).read(wallet), /requires Base/);
  await assert.rejects(createInboxClient({ ...options, provider: { getNetwork: async () => { throw new Error('RPC offline'); } } }).read(wallet), /offline/);
  assert.throws(() => createInboxPreferences({ getItem: () => '{broken' }, registry, wallet).read());
  assert.throws(() => createInboxPreferences({ getItem: () => null, setItem: () => { throw new Error('quota'); } }, registry, wallet).update(() => {}), /quota/);
});
