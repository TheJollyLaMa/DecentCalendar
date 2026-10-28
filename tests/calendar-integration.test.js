import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
const root = new URL('../decent-calendar-vanilla/', import.meta.url);
const source = path => readFile(new URL(path, root), 'utf8');

test('saving an event stays local, including public events and token ID zero', async () => {
  const records = new Map();
  const context = vm.createContext({
    window: {}, Intl, console,
    localStorage: { getItem: key => records.get(key) ?? null, setItem: (key, value) => records.set(key, value) },
  });
  vm.runInContext(await source('js/events.js'), context);
  await context.saveEvent('0xABC', { title: 'Public draft', tokenId: 0, isPublic: true });
  const events = JSON.parse(records.get('0xabc'));
  assert.equal(events[0].tokenId, 0);
  assert.equal(events[0].currency, 'ETH');
  assert.equal(events[0].ipfsCID, null);
  records.set('0xabc', '{}');
  assert.throws(() => context.loadEventsRaw('0xabc'), /not an event array/);
  assert.equal(records.get('0xabc'), '{}');
});

test('all paid entry points fail closed, including legacy direct transfer fallback', async () => {
  let sends = 0, scripts = 0;
  const messages = [];
  const context = vm.createContext({
    window: { DECENT_CONFIG: { contractAddresses: {} }, _walletSigner: { sendTransaction: () => { sends++; } } },
    alert: message => messages.push(message),
    console: { ...console, error() {} },
    document: { createElement: () => { scripts++; } },
  });
  vm.runInContext(await source('js/contract.js'), context);
  vm.runInContext(await source('js/payments.js'), context);
  context.setPendingBookingEvent({ creator: '0xrecipient' });
  await context.payWithCrypto(0, 1);
  await context.payWithPayPal({});
  await context.payWithCard({});
  assert.throws(() => context.getNFTContract(), /not live/);
  assert.throws(() => context.getMarketContract(), /not live/);
  assert.equal(sends, 0);
  assert.equal(scripts, 0);
  assert.equal(messages.length, 3);
  assert.ok(messages.every(message => message.includes('not live')));
});

test('canonical Base config and shell load only one Head and no retired w3up bundle', async () => {
  const context = vm.createContext({ window: {} });
  vm.runInContext(await source('decent.config.js'), context);
  assert.equal(context.window.DECENT_CONFIG.chain.chainId, 8453);
  assert.equal(context.window.DECENT_CONFIG.defaultChainHex, '0x2105');
  const html = await source('index.html');
  const entry = await source('js/main.js');
  assert.equal((html.match(/<decent-header>/g) || []).length, 1);
  assert.ok(!html.includes('<app-header>'));
  assert.ok(!html.includes('browser.min.js'));
  assert.ok(!html.includes('peerjs.min.js'));
  assert.ok(!entry.includes("import './components/WalletConnect.js'"));
  assert.ok(entry.indexOf('ipfsAdapter =') < entry.indexOf("await import('../vendor/"));
});

test('public prototype cannot open unauthenticated meetings or request media', async () => {
  const messages = [];
  const context = vm.createContext({
    alert: message => messages.push(message),
    document: { getElementById() { throw new Error('Meeting DOM should not open'); } },
    navigator: { mediaDevices: { getUserMedia() { throw new Error('Media must not be requested'); } } },
  });
  vm.runInContext(await source('js/meetingRoom.js'), context);
  vm.runInContext(await source('js/calendar.js'), context);
  context.initMeetingRoom('room', true);
  context.startCall('room', {});
  context.openMeetingModal('room', true);
  assert.equal(messages.length, 3);
  assert.ok(messages.every(message => message.includes('Meetings are not live')));
});

test('calendar refresh uses concrete event sources and imported availability is inert', async () => {
  const sourceChanges = [];
  const context = vm.createContext({
    window: {}, console, alert: message => sourceChanges.push(message),
    document: { getElementById: () => null },
  });
  vm.runInContext(await source('js/calendar.js'), context);
  vm.runInContext(`calendarInstance = {
    removeAllEventSources: () => {},
    addEventSource: events => { globalThis.latest = events; }
  };`, context);
  context.addEventToCalendar({ title: 'Visible event' });
  assert.equal(context.latest[0].title, 'Visible event');
  context.handleEventClick({ event: { title: 'Public title', classNames: ['public-event'],
    extendedProps: { readOnly: true, hourlyRate: 1, meetingRoomId: 'forged' } } });
  assert.match(sourceChanges[0], /Read-only/);
});
