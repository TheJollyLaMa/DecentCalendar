import test from 'node:test';
import assert from 'node:assert/strict';
import { ASSETS, getAsset, parseAmount, formatAmount, slotQuote, eventAsset } from '../decent-calendar-vanilla/js/assets.js';
import { safeImageURL, resolveProfile, createProfileResolver } from '../decent-calendar-vanilla/js/ens-profile.js';
import { STEPS, readProgress, TUTORIAL_KEY } from '../decent-calendar-vanilla/js/tutorial.js';
import { createLocalBackup, createPublicAvailability, importPublicAvailability } from '../decent-calendar-vanilla/js/calendar-data.js';
const address = `0x${'a'.repeat(40)}`;
const slot = {
  title: 'Time', description: '', owner: address, creator: address, start: '2026-11-01T10:00:00Z',
  end: '2026-11-01T11:30:00Z', hourlyRate: 1.01, assetId: 'base:usdc', rateAmount: '1.01', currency: 'USDC', isPublic: true,
};

test('assets have stable chain/address identity, decimals and icons; symbols never imply a token', () => {
  assert.equal(ASSETS.length, 2);
  for (const asset of ASSETS) {
    assert.equal(asset.chainId, 8453);
    assert.ok(asset.icon && asset.still);
  }
  assert.equal(getAsset('base:usdc').decimals, 6);
  assert.equal(getAsset('base:usdc').address, '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913');
  assert.equal(eventAsset({ currency: 'USDC' }), null);
  assert.throws(() => getAsset('random:usdc'), /Unsupported asset/);
});
test('exact ETH/USDC amounts and duration/fee rounding conserve every base unit', () => {
  assert.equal(parseAmount('0.000001', 6), 1n);
  assert.equal(parseAmount('1.000000000000000001', 18), 1000000000000000001n);
  assert.equal(formatAmount(1000001n, 6), '1.000001');
  const quote = slotQuote(slot);
  assert.equal(quote.gross, 1515000n);
  assert.equal(quote.fee, 45450n);
  assert.equal(quote.host + quote.fee, quote.gross);
  assert.equal(slotQuote({ ...slot, rateAmount: '0.000001', end: '2026-11-01T10:00:01Z' }).gross, 1n);
  assert.equal(slotQuote({ ...slot, rateAmount: '0' }).fee, 0n);
  for (const value of ['1e6', '-1', '.1', '01', '1.0000001', 'Infinity']) assert.throws(() => parseAmount(value, 6));
  assert.throws(() => parseAmount((2n ** 256n).toString(), 0), /uint256/);
});
test('asset identity/rate survive private backups and public availability; images do not get trusted from imports', () => {
  const storage = { getItem: () => JSON.stringify([{ ...slot, avatar: 'https://forged.example/a.png' }]) };
  assert.equal(createLocalBackup(storage, address).events[0].rateAmount, '1.01');
  const published = createPublicAvailability(storage, address);
  const imported = importPublicAvailability(published).events[0];
  assert.equal(imported.assetId, slot.assetId);
  assert.equal(imported.rateAmount, '1.01');
  assert.equal(imported.avatar, undefined);
  assert.throws(() => createLocalBackup({ getItem: () => JSON.stringify([{ ...slot, currency: 'ETH' }]) }, address), /does not match/);
});
test('ENS requires reverse/forward agreement and sanitizes avatar/banner records', async () => {
  let resolverReads = 0;
  const provider = {
    lookupAddress: async () => 'friend.eth',
    resolveName: async () => address,
    getResolver: async () => {
      resolverReads++;
      return { getAvatar: async () => ({ url: 'https://images.example/avatar.png' }), getText: async key => key === 'banner' ? 'ipfs://bafyaaaaa/banner.png' : '' };
    },
  };
  const result = await resolveProfile(address, provider);
  assert.equal(result.name, 'friend.eth');
  assert.equal(result.avatar, 'https://images.example/avatar.png');
  assert.equal(result.banner, 'https://ipfs.io/ipfs/bafyaaaaa/banner.png');
  const mismatch = await resolveProfile(address, { ...provider, resolveName: async () => `0x${'b'.repeat(40)}` });
  assert.equal(mismatch.name, null);
  assert.equal(resolverReads, 1);
});
test('unavailable image records and unsupported URLs produce explicit warnings', async () => {
  const result = await resolveProfile(address, {
    lookupAddress: async () => 'friend.eth', resolveName: async () => address,
    getResolver: async () => ({ getAvatar: async () => { throw new Error('RPC failed'); }, getText: async () => 'javascript:alert(1)' }),
  });
  assert.equal(result.avatar, '');
  assert.equal(result.banner, '');
  assert.equal(result.warnings.length, 2);
  for (const value of ['http://example/a', 'javascript:alert(1)', 'data:image/svg+xml,bad', 'https://user:pass@example/a', '//example/a']) assert.equal(safeImageURL(value), '');
});
test('ENS memoization expires, refreshes and evicts failed lookups instead of hiding outages', async () => {
  let clock = 0, calls = 0, fail = false;
  const provider = { lookupAddress: async () => { calls++; if (fail) throw new Error('offline'); return null; } };
  const resolver = createProfileResolver(async () => provider, { now: () => clock, ttl: 100 });
  await Promise.all([resolver.lookup(address), resolver.lookup(address)]);
  assert.equal(calls, 1);
  clock = 101;
  await resolver.lookup(address);
  assert.equal(calls, 2);
  await resolver.lookup(address, { refresh: true });
  assert.equal(calls, 3);
  fail = true;
  await assert.rejects(resolver.lookup(address, { refresh: true }), /offline/);
  fail = false;
  await resolver.lookup(address);
  assert.equal(calls, 5);
});
test('tutorial progress is bounded and distinguishes complete/replay from resume', () => {
  assert.equal(STEPS.length, 12);
  const values = new Map();
  const storage = { getItem: key => values.get(key) };
  assert.deepEqual(readProgress(storage), { index: 0, completed: false });
  values.set(TUTORIAL_KEY, JSON.stringify({ index: 5, completed: false }));
  assert.equal(readProgress(storage).index, 5);
  values.set(TUTORIAL_KEY, JSON.stringify({ index: 999, completed: false }));
  assert.throws(() => readProgress(storage), /invalid/);
  assert.ok(STEPS.some(step => step.body.includes('seven') || step.body.includes('7 unresolved')));
});
