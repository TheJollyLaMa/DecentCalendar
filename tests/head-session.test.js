import test from 'node:test';
import assert from 'node:assert/strict';
import { bindCalendarSession } from '../decent-calendar-vanilla/js/head-session.js';

const flush = () => new Promise(resolve => setImmediate(resolve));
function setup(initial = { connected: false }) {
  let listener;
  const target = {};
  const reports = [], connections = [];
  let resets = 0, subscriptions = 0;
  const head = {
    getWallet: () => ({ snapshot: () => initial }),
    on: (name, callback) => {
      assert.equal(name, 'wallet');
      subscriptions++;
      listener = callback;
      return () => { subscriptions--; listener = null; };
    },
  };
  const dispose = bindCalendarSession(head, {
    target, connected: value => connections.push(value),
    disconnected: () => { resets++; }, report: message => reports.push(message),
  });
  return { target, reports, connections, dispose, emit: state => listener(state), resets: () => resets, subscriptions: () => subscriptions };
}
const state = (address = 'alice', provider = { getSigner: async account => ({ account }) }) => ({
  connected: true, address, chainId: '0x2105', provider,
});

test('one shared listener; mount does not connect or request accounts', () => {
  const app = setup();
  assert.equal(app.subscriptions(), 1);
  assert.equal(app.target._walletSigner, null);
  assert.equal(app.target._walletAddress, null);
  assert.match(app.reports.at(-1), /Connect explicitly/);
  app.dispose();
  assert.equal(app.subscriptions(), 0);
});

test('Base session exposes the selected signer and ignores ENS-only updates', async () => {
  const app = setup();
  const connected = state();
  app.emit(connected);
  await flush();
  assert.equal(app.target._walletAddress, 'alice');
  assert.deepEqual(app.target._walletSigner, { account: 'alice' });
  app.emit({ ...connected, ensName: 'alice.eth', ensStatus: 'resolved' });
  await flush();
  assert.equal(app.connections.length, 1);
  assert.equal(app.resets(), 2);
});

test('wrong network clears address and signer without switching or reloading', async () => {
  const app = setup();
  app.emit(state());
  await flush();
  app.emit({ ...state(), chainId: '0x1' });
  await flush();
  assert.equal(app.target._walletAddress, null);
  assert.equal(app.target._walletSigner, null);
  assert.match(app.reports.at(-1), /Wrong network/);
  app.emit(state());
  await flush();
  assert.equal(app.target._walletAddress, 'alice');
});

test('account changes and disconnect discard stale asynchronous signer results', async () => {
  const app = setup();
  let resolveAlice;
  app.emit(state('alice', { getSigner: () => new Promise(resolve => { resolveAlice = resolve; }) }));
  app.emit(state('bob'));
  await flush();
  resolveAlice({ account: 'alice' });
  await flush();
  assert.equal(app.target._walletAddress, 'bob');
  assert.deepEqual(app.connections, ['bob']);
  app.emit({ connected: false, address: null, chainId: null, provider: null });
  assert.equal(app.target._walletSigner, null);
});

test('disposing while signer acquisition is pending cannot restore credentials', async () => {
  const app = setup();
  let resolve;
  app.emit(state('alice', { getSigner: () => new Promise(done => { resolve = done; }) }));
  app.dispose();
  resolve({});
  await flush();
  assert.equal(app.target._walletSigner, null);
  assert.equal(app.connections.length, 0);
});

test('signer errors are surfaced and never leave stale credentials', async t => {
  t.mock.method(console, 'error', () => {});
  const app = setup();
  app.emit(state('alice', { getSigner: async () => { throw new Error('Rejected signer'); } }));
  await flush();
  assert.equal(app.target._walletAddress, null);
  assert.match(app.reports.at(-1), /Rejected signer/);
});
