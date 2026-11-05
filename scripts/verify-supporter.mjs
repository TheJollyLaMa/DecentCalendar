import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildPages } from './build-pages.mjs';

if (!process.env.PLAYWRIGHT_MODULE) throw new Error('Set PLAYWRIGHT_MODULE to an existing Playwright installation.');
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE));
const directory = await mkdtemp(new URL('../.supporter-browser-', import.meta.url));
const site = resolve(directory, 'site');
const prefix = '/nested/dcal/';
const mime = { '.js': 'text/javascript', '.html': 'text/html', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.gif': 'image/gif' };
const server = createServer(async (request, response) => {
  try {
    const path = new URL(request.url, 'http://localhost').pathname;
    if (!path.startsWith(prefix)) { response.writeHead(404).end(); return; }
    const target = resolve(site, path.slice(prefix.length) || 'index.html');
    if (!target.startsWith(`${site}${sep}`)) { response.writeHead(403).end(); return; }
    response.writeHead(200, { 'Content-Type': mime[extname(target)] || 'text/plain' }).end(await readFile(target));
  } catch { response.writeHead(404).end(); }
});
let browser;
try {
  await buildPages(site);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  browser = await chromium.launch({ headless: true });
  for (const width of [1440, 390, 320]) {
    const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('https://**', route => route.abort());
    await page.addInitScript(() => {
      window.__walletRequests = [];
      window.ethereum = {
        on() {}, removeListener() {},
        async request({ method }) {
          window.__walletRequests.push(method);
          throw new Error('Supporter About must not request a wallet');
        },
      };
    });
    await page.goto(`http://127.0.0.1:${server.address().port}${prefix}`);
    const title = page.locator('app-title button');
    await title.click();
    const dialog = page.locator('about-modal dialog');
    await dialog.waitFor({ state: 'visible' });
    const card = page.locator('#dcal-supporter');
    assert.match(await card.innerText(), /Unavailable — preparing/);
    assert.match(await card.innerText(), /No verified mint or listing/);
    assert.equal(await card.locator('button, a, input, iframe').count(), 0);
    assert.equal(await page.locator('about-modal #buy, about-modal #paypal').count(), 0);
    assert.equal(await dialog.evaluate(element => element.scrollWidth > element.clientWidth + 1), false);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.keyboard.press('Escape');
    assert.equal(await dialog.isVisible(), false);
    await title.focus();
    await page.keyboard.press('Enter');
    await dialog.waitFor({ state: 'visible' });
    assert.equal(await card.count(), 1);
    assert.deepEqual(await page.evaluate(() => window.__walletRequests), []);
    assert.deepEqual(errors, []);
    await page.close();
    console.log(`About Supporter pending state, keyboard and layout passed at ${width}px`);
  }
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
  await rm(directory, { recursive: true });
}
