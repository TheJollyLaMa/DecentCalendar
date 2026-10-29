import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve, extname, sep } from 'node:path';

const modulePath = process.env.PLAYWRIGHT_MODULE;
if (!modulePath) throw new Error('Set PLAYWRIGHT_MODULE to an existing Playwright module; no installation is performed.');
const { chromium } = await import(pathToFileURL(modulePath).href);
const root = resolve(process.env.CALENDAR_ROOT || fileURLToPath(new URL('../decent-calendar-vanilla/', import.meta.url)));
const prefix = '/nested/calendar/';
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.md': 'text/plain' };
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    if (!pathname.startsWith(prefix)) { response.writeHead(404).end(); return; }
    const path = resolve(root, pathname.slice(prefix.length) || 'index.html');
    if (!path.startsWith(`${root}${sep}`)) { response.writeHead(403).end(); return; }
    const data = await readFile(path);
    response.writeHead(200, { 'Content-Type': mime[extname(path)] || 'application/octet-stream' }).end(data);
  } catch (error) {
    if (error.code !== 'ENOENT') console.error(error);
    response.writeHead(error.code === 'ENOENT' ? 404 : 500).end();
  }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const url = process.env.CALENDAR_URL || `http://127.0.0.1:${server.address().port}${prefix}`;
const deploymentPath = new URL(url).pathname;
let browser;
const owner = `0x${'a'.repeat(40)}`, other = `0x${'b'.repeat(40)}`;
const publicEvent = {
  title: 'Public sync', description: 'Public learning time', owner, creator: owner,
  start: '2026-11-02T10:00:00Z', end: '2026-11-02T11:00:00Z', hourlyRate: 0.1,
  currency: 'ETH', isPublic: true, meetingRoomId: 'private-room', tokenId: 0, status: 'pending',
};
const privateEvent = { ...publicEvent, title: 'Private secret title', isPublic: false };
const cid = `bafy${'a'.repeat(40)}`;
const failures = [], results = [];
try {
  browser = await chromium.launch({ headless: true });
  for (const [name, viewport] of [['desktop', { width: 1440, height: 1000 }], ['mobile', { width: 390, height: 844 }]]) {
    const context = await browser.newContext({ viewport, reducedMotion: 'reduce', acceptDownloads: true });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const requests = [];
    const assetFailures = [];
    page.on('request', request => requests.push(request.url()));
    page.on('response', response => {
      if (response.url().startsWith(url) && response.status() >= 400) {
        assetFailures.push(`${response.status()} ${response.url()}`);
      }
    });
    await page.route('**/decent.config.js', async route => {
      const response = await route.fetch();
      const source = await response.text();
      await route.fulfill({ response, body: `${source}\nwindow.DECENT_CONFIG.ens.enabled = false;` });
    });
    let uploaded;
    await page.route('https://api.pinata.cloud/pinning/pinFileToIPFS', async route => {
      uploaded = route.request().postData();
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ IpfsHash: cid }) });
    });
    await page.route(`https://ipfs.io/ipfs/${cid}`, route => route.fulfill({
      contentType: 'application/json', body: JSON.stringify({
        app: 'DecentCalendar', version: 1, kind: 'public-availability', owner,
        events: [{ ...publicEvent, meetingRoomId: 'forged-meeting', status: 'booked' }],
      }),
    }));
    await context.addInitScript(({ owner, other, publicEvent, privateEvent }) => {
      localStorage.setItem(owner, JSON.stringify([publicEvent, privateEvent]));
      localStorage.setItem(other, '[]');
      localStorage.setItem('unrelated-private-data', 'not calendar data');
      const handlers = new Map();
      window.walletRequests = [];
      window.fakeWallet = {
        accounts: [owner], chain: '0x2105',
        on(event, handler) { handlers.set(event, handler); },
        removeListener(event, handler) { if (handlers.get(event) === handler) handlers.delete(event); },
        emit(event, value) { handlers.get(event)?.(value); },
        async request({ method, params }) {
          window.walletRequests.push(method);
          if (method === 'eth_requestAccounts' || method === 'eth_accounts') return this.accounts;
          if (method === 'eth_chainId') return this.chain;
          if (method === 'wallet_switchEthereumChain') { this.chain = params[0].chainId; return null; }
          throw new Error(`Unexpected wallet method: ${method}`);
        },
      };
      window.ethereum = window.fakeWallet;
    }, { owner, other, publicEvent, privateEvent });
    await page.goto(url);
    await page.waitForFunction(() => window.DecentHead && document.querySelector('.fc'));
    assert.deepEqual(await page.evaluate(() => window.walletRequests), [], 'Loading must not request wallet access');
    assert.equal(requests.filter(request => request.includes('w3s.link/browser.min.js')).length, 0);
    assert.equal(requests.filter(request => request.includes('peerjs.min.js')).length, 0);
    const wallet = page.locator('decent-header wallet-connect #connect');
    await wallet.click();
    await page.waitForFunction(owner => window._walletAddress === owner, owner);
    assert.equal(await page.evaluate(() => window._walletSigner !== null), true);
    await page.evaluate(() => calendarInstance.gotoDate('2026-11-02'));
    await page.locator('.fc-event').filter({ hasText: 'Private secret title' }).first().waitFor();
    assert.equal(await page.locator('#mint-timeslot-btn').isDisabled(), true);
    const capabilities = async capability => {
      await page.locator('decent-header ipfs-controls #open').click();
      await page.locator(`decent-header ipfs-controls [data-capability="${capability}"]`).click();
    };
    await capabilities('backup');
    const downloadPromise = page.waitForEvent('download');
    await page.locator('#download-local-backup').click();
    const download = await downloadPromise;
    const stream = await download.createReadStream();
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    const backup = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    assert.equal(backup.events.length, 2);
    assert.equal(backup.events[1].title, privateEvent.title);
    assert.equal(backup.events[0].tokenId, 0);
    assert.ok(!JSON.stringify(backup).includes('not calendar data'));
    await page.locator('#local-backup-file').setInputFiles({
      name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from('{"version":99}'),
    });
    await page.locator('#restore-local-backup').click();
    await page.getByText('Expected a DecentCalendar v1 local-backup document.', { exact: true }).waitFor();
    assert.equal(await page.evaluate(owner => JSON.parse(localStorage.getItem(owner)).length, owner), 2);
    await page.locator('#local-backup-dialog [data-close]').click();

    await capabilities('replication');
    const preview = await page.locator('#public-preview').textContent();
    for (const secret of ['private-room', 'Private secret title', 'not calendar data', 'tokenId', 'pending']) assert.ok(!preview.includes(secret));
    await page.locator('#publish-availability').click();
    await page.getByText('Confirm that the preview is intended for permanent public distribution.', { exact: true }).waitFor();
    assert.equal(uploaded, undefined);
    await page.locator('#public-availability-dialog [data-close]').click();

    await capabilities('backup');
    await page.locator('#local-backup-file').setInputFiles({
      name: 'local.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)),
    });
    page.once('dialog', dialog => dialog.accept());
    await page.locator('#restore-local-backup').click();
    await page.locator('#local-backup-message').filter({ hasText: 'Restored 2 local events.' }).waitFor();
    assert.equal(await page.evaluate(other => localStorage.getItem(other), other), '[]');
    await page.locator('#local-backup-dialog [data-close]').click();

    await page.locator('decent-header ipfs-controls #open').click();
    await page.locator('decent-header ipfs-controls #provider-settings summary').first().click();
    await page.locator('decent-header ipfs-controls #jwt').fill('synthetic-test-credential');
    await page.locator('decent-header ipfs-controls #save-provider').click();
    assert.equal(await page.locator('decent-header ipfs-controls #jwt').inputValue(), '');
    await page.locator('decent-header ipfs-controls [data-capability="replication"]').click();
    await page.locator('#public-availability-consent').check();
    page.once('dialog', dialog => dialog.accept());
    await page.locator('#publish-availability').click();
    await page.locator('#public-availability-message').filter({ hasText: `Provider returned CID: ${cid}` }).waitFor();
    assert.ok(uploaded.includes('Public sync'));
    for (const secret of ['private-room', 'Private secret title', 'not calendar data', 'tokenId', 'pending']) assert.ok(!uploaded.includes(secret));
    await page.locator('#public-availability-cid').fill('not-a-cid');
    await page.locator('#import-availability').click();
    await page.locator('#public-availability-message').filter({ hasText: 'Enter a valid CID' }).waitFor();
    await page.locator('#public-availability-cid').fill(cid);
    page.once('dialog', dialog => dialog.accept());
    await page.locator('#import-availability').click();
    await page.locator('#public-availability-message').filter({ hasText: 'Displaying 1 read-only events' }).waitFor();
    assert.equal(await page.evaluate(() => otherEvents[0].readOnly), true);
    assert.equal(await page.evaluate(() => otherEvents[0].meetingRoomId), undefined);
    assert.equal(await page.evaluate(owner => JSON.parse(localStorage.getItem(owner)).length, owner), 2);
    await page.locator('#public-availability-dialog [data-close]').click();
    const uploadsBeforeDraft = requests.filter(request => request.includes('/pinning/pinFileToIPFS')).length;
    await page.locator('#add-event-btn').click();
    await page.locator('#event-title').fill('New private local draft');
    await page.locator('#event-date-trigger').click();
    await page.getByRole('button', { name: 'Next month' }).click();
    await page.locator('.picker-day:not(.outside):not(:disabled)').first().click();
    await page.locator('#event-start-trigger').click();
    await page.getByRole('option').nth(40).click();
    await page.locator('#event-duration-chips [data-minutes="90"]').click();
    const [draftStart, draftEnd] = await Promise.all(['#event-start', '#event-end'].map(id => page.locator(id).inputValue()));
    assert.equal(Date.parse(draftEnd) - Date.parse(draftStart), 90 * 60000);
    assert.match(draftStart, /^\d{4}-\d{2}-01T10:00$/);
    await page.locator('#event-rate').fill('0.2');
    await page.locator('#event-private').check();
    await page.locator('#event-summary').filter({ hasText: '1h 30m of your time · 0.3 ETH per attendee' }).waitFor();
    await page.locator('#save-event-btn').click();
    await page.locator('#add-event-modal').waitFor({ state: 'hidden' });
    const drafts = await page.evaluate(owner => JSON.parse(localStorage.getItem(owner)), owner);
    assert.equal(drafts.length, 3);
    assert.equal(drafts[2].isPublic, false);
    assert.equal(drafts[2].currency, 'ETH');
    assert.equal(requests.filter(request => request.includes('/pinning/pinFileToIPFS')).length, uploadsBeforeDraft);
    await page.locator('#lookup-address').fill(other);
    await page.locator('#fetch-events-btn').focus();
    await page.evaluate(() => {
      window.fakeWallet.chain = '0x1';
      window.fakeWallet.emit('chainChanged', '0x1');
    });
    await page.waitForFunction(() => window._walletSigner === null);
    await page.locator('#calendar-status').filter({ hasText: 'Wrong network' }).waitFor();
    await page.evaluate(() => {
      window.fakeWallet.chain = '0x2105';
      window.fakeWallet.emit('chainChanged', '0x2105');
    });
    await page.waitForFunction(() => window._walletSigner !== null);
    await page.evaluate(other => {
      window.fakeWallet.accounts = [other];
      window.fakeWallet.emit('accountsChanged', [other]);
    }, other);
    await page.waitForFunction(other => window._walletAddress === other, other);
    assert.equal(await page.evaluate(() => myEvents.length), 0);
    await wallet.click();
    await page.waitForFunction(() => window._walletAddress === null);
    await page.locator('decent-header app-title button').click();
    await page.locator('decent-header about-modal dialog').waitFor({ state: 'visible' });
    assert.ok((await page.locator('decent-header about-modal').textContent()) !== undefined);
    await page.keyboard.press('Escape');
    const overflow = await page.evaluate(() => ({
      width: innerWidth, actual: document.documentElement.scrollWidth,
      elements: [...document.querySelectorAll('body *')].filter(element => {
        const rect = element.getBoundingClientRect();
        return rect.right > innerWidth + 1 || rect.left < -1;
      }).map(element => `${element.tagName}.${element.className}#${element.id}`).slice(0, 12),
    }));
    assert.ok(overflow.actual <= overflow.width, `${name}: horizontal document overflow: ${JSON.stringify(overflow)}`);
    const forbidden = await page.evaluate(() => window.walletRequests.filter(method => /send|sign/i.test(method)));
    assert.deepEqual(forbidden, []);
    assert.equal(await page.locator('decent-header wallet-connect .account-orbit').evaluate(element => getComputedStyle(element).animationName), 'none');
    assert.deepEqual(errors, [], `${name} page errors`);
    assert.deepEqual(assetFailures, [], `${name} deployment asset failures`);
    if (process.env.SCREENSHOT_DIR) {
      await mkdir(process.env.SCREENSHOT_DIR, { recursive: true });
      await page.screenshot({ path: resolve(process.env.SCREENSHOT_DIR, `dcal-head-${name}.png`), fullPage: true });
    }
    results.push(`${name}: nested paths, wallet lifecycle, local backup, public preview/consent/upload/import and release gates passed`);
    await context.close();
  }
  const noWallet = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const visitor = await noWallet.newPage();
  await visitor.goto(url);
  await visitor.waitForFunction(() => window.DecentHead && document.querySelector('.fc'));
  assert.equal(await visitor.locator('decent-header wallet-connect #connect').isDisabled(), true);
  const mobileLink = visitor.locator('decent-header wallet-connect #mobile');
  assert.equal(await mobileLink.isVisible(), true);
  assert.ok((await mobileLink.getAttribute('href')).includes(deploymentPath));
  assert.equal(await visitor.evaluate(() => window._walletAddress), null);
  await visitor.locator('decent-header ipfs-controls #open').click();
  await visitor.locator('decent-header ipfs-controls #backup-status').filter({ hasText: 'unavailable:' }).waitFor();
  assert.equal(await visitor.locator('decent-header ipfs-controls [data-capability="backup"]').isDisabled(), true);
  results.push('no-wallet visitor: nested mobile wallet link and unavailable app-storage controls passed');
  await noWallet.close();
} catch (error) {
  failures.push(error);
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
for (const result of results) console.log(result);
if (failures.length) throw new AggregateError(failures, 'Calendar Head browser validation failed');
