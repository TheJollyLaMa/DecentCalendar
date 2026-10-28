import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

if (!process.env.PLAYWRIGHT_MODULE) throw new Error('Set PLAYWRIGHT_MODULE to an existing installation.');
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE));
const root = resolve(fileURLToPath(new URL('../decent-calendar-vanilla/', import.meta.url)));
const prefix = '/nested/dcal/';
const mime = { '.js': 'text/javascript', '.html': 'text/html', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.gif': 'image/gif' };
const server = createServer(async (request, response) => {
  try {
    const path = new URL(request.url, 'http://localhost').pathname;
    if (!path.startsWith(prefix)) { response.writeHead(404).end(); return; }
    const target = resolve(root, path.slice(prefix.length) || 'index.html');
    if (!target.startsWith(`${root}${sep}`)) { response.writeHead(403).end(); return; }
    response.writeHead(200, { 'Content-Type': mime[extname(target)] || 'text/plain' }).end(await readFile(target));
  } catch (error) {
    if (error.code !== 'ENOENT') console.error(error);
    response.writeHead(404).end();
  }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const url = process.env.CALENDAR_URL || `http://127.0.0.1:${server.address().port}${prefix}`;
let browser;
try {
  browser = await chromium.launch({ headless: true });
  for (const width of [1440, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const requests = [];
    page.on('request', request => requests.push(request.url()));
    await page.route('**/decent.config.js', async route => {
      const response = await route.fetch();
      await route.fulfill({ response, body: `${await response.text()}\nwindow.DECENT_CONFIG.ens.enabled = false;` });
    });
    await page.goto(url);
    await page.waitForFunction(() => window.DCalProfiles && window.openSlotDetails && document.querySelector('.fc'));
    assert.equal(await page.locator('img[src*="Ommm"], img[src*="DecentSmartHome"]').count(), 0);
    await page.locator('#rabbit-tour-launch').click();
    await page.locator('#rabbit-next').click();
    await page.keyboard.press('ArrowRight');
    assert.equal(await page.locator('#rabbit-progress').textContent(), 'Step 3 of 11');
    await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'rabbit-tour-launch');
    await page.reload();
    await page.waitForFunction(() => window.DCalProfiles && window.openSlotDetails);
    await page.locator('#rabbit-tour-launch').click();
    assert.equal(await page.locator('#rabbit-progress').textContent(), 'Step 3 of 11');
    await page.locator('#rabbit-restart').click();
    assert.equal(await page.locator('#rabbit-progress').textContent(), 'Step 1 of 11');
    for (let step = 0; step < 10; step++) await page.locator('#rabbit-next').click();
    assert.equal(await page.locator('#rabbit-next').textContent(), 'Finish');
    await page.locator('#rabbit-next').click();
    assert.equal(await page.locator('#rabbit-tour').isVisible(), false);
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('decentcalendar:tutorial:v1')).completed), true);
    await page.locator('decent-header ankh-menu[side="right"] summary').click();
    await page.locator('decent-header ankh-menu[side="right"] button').filter({ hasText: 'My ENS profile' }).click();
    await page.locator('#ens-profile-status').filter({ hasText: 'Connect using the wallet orbit' }).waitFor();
    await page.locator('#ens-profile-dialog [data-close]').click();

    await page.evaluate(async () => {
      const owner = `0x${'a'.repeat(40)}`;
      await window.openSlotDetails({
        title: '<script>not executable</script>', description: 'Learn together',
        creator: owner, owner, start: '2026-11-02T10:00:00Z', end: '2026-11-02T11:30:00Z',
        currency: 'USDC', assetId: 'base:usdc', hourlyRate: 1.01, rateAmount: '1.01', readOnly: true,
      });
    });
    await page.locator('#slot-details-content').filter({ hasText: '1.515 USDC' }).waitFor();
    assert.equal(await page.locator('#slot-details img[alt="USDC"]').count(), 1);
    assert.equal(await page.locator('#slot-details-title script').count(), 0);
    assert.ok((await page.locator('#slot-details-content').textContent()).includes('not a verified booking'));
    assert.ok((await page.locator('#slot-details-content').textContent()).includes('ENS unavailable'));
    await page.locator('#slot-details [data-close]').click();
    await page.locator('#open-booking-registry').click();
    await page.locator('#booking-registry-gate').filter({ hasText: 'Transactions are disabled' }).waitFor();
    await page.locator('#booking-id').fill('0');
    await page.locator('#load-booking-id').click();
    await page.locator('#booking-registry-status').filter({ hasText: 'not deployed and pinned' }).waitFor();
    assert.equal(await page.locator('#booking-registry [data-write]:enabled').count(), 0);
    await page.locator('#booking-registry [data-close]').click();
    assert.ok(requests.every(request => !request.includes('pinFileToIPFS')));
    assert.equal(await page.locator('.rabbit-highlight').count(), 0);
    assert.equal(await page.locator('.rabbit-glyph').evaluate(node => getComputedStyle(node).animationName), 'none');
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    assert.deepEqual(errors, []);

    // Fixture the ENS resolver, not the DOM: exercise profile rendering and stale account results.
    await page.route('**/js/ens-profile.js', async route => {
      const response = await route.fetch();
      const source = await response.text();
      await route.fulfill({ response, body: `${source}
        const fixture = createProfileResolver;
        createProfileResolver = () => ({
          address: async () => '0x${'a'.repeat(40)}',
          lookup: async address => ({
            address, name: address.toLowerCase().startsWith('0xaaaa') ? 'friend.eth' : null,
            avatar: 'https://dcal-fixtures.invalid/avatar.png',
            banner: 'https://dcal-fixtures.invalid/banner.png', status: 'verified', warnings: []
          })
        });` });
    });
    await page.route('https://dcal-fixtures.invalid/*.png', route => route.fulfill({
      contentType: 'image/png',
      body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6z1sAAAAASUVORK5CYII=', 'base64'),
    }));
    await page.reload();
    await page.waitForFunction(() => window.DCalProfiles);
    await page.evaluate(() => {
      const state = { connected: true, address: `0x${'a'.repeat(40)}`, chainId: '0x2105', provider: { getSigner: async () => ({}) } };
      window.dispatchEvent(new CustomEvent('decenthead:wallet', { detail: state }));
    });
    await page.locator('#calendar-identity').filter({ hasText: 'friend.eth' }).waitFor();
    assert.equal(await page.locator('#calendar-identity .ens-avatar').count(), 1);
    assert.equal(await page.locator('#calendar-identity .ens-banner').count(), 1);
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('decenthead:wallet', { detail: { connected: false } })));
    await page.waitForFunction(() => !document.getElementById('calendar-identity').textContent);
    console.log(`${width}px: complete/resume/replay tutorial, right ankh, ENS fallback/identity cleanup, exact USDC preview, safe text, no uploads and reduced motion passed`);
    await context.close();
  }
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
