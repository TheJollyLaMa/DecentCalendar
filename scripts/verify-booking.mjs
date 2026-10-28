import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { network } from 'hardhat';
import { BrowserProvider, Contract, ContractFactory, keccak256, ZeroAddress } from 'ethers';
import { compileBooking } from './compile-booking.mjs';
import { ASSETS } from '../decent-calendar-vanilla/js/assets.js';

if (!process.env.PLAYWRIGHT_MODULE) throw new Error('Set PLAYWRIGHT_MODULE to an existing Playwright installation.');
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
const mock = `// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.30;
contract Token {
  mapping(address=>uint256) public balanceOf;
  mapping(address=>mapping(address=>uint256)) public allowance;
  function mint(address to,uint256 amount) external {balanceOf[to]+=amount;}
  function approve(address spender,uint256 amount) external returns(bool){allowance[msg.sender][spender]=amount;return true;}
  function transferFrom(address from,address to,uint256 amount) external returns(bool){
    require(allowance[from][msg.sender]>=amount && balanceOf[from]>=amount);
    allowance[from][msg.sender]-=amount;balanceOf[from]-=amount;balanceOf[to]+=amount;return true;
  }
  function transfer(address to,uint256 amount) external returns(bool){
    require(balanceOf[msg.sender]>=amount);balanceOf[msg.sender]-=amount;balanceOf[to]+=amount;return true;
  }
}`;
const build = await compileBooking({ 'Token.sol': { content: mock } });
let browser;
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const url = `http://127.0.0.1:${server.address().port}${prefix}`;
try {
  browser = await chromium.launch({ headless: true });
  for (const width of [1440, 390]) {
    const connection = await network.connect('local'), rpc = connection.provider;
    const provider = new BrowserProvider(rpc);
    provider.pollingInterval = 10;
    const [host, buyer, fee] = await Promise.all([0, 1, 2].map(index => provider.getSigner(index)));
    const tokenArtifact = build.contracts['Token.sol'].Token;
    await rpc.request({ method: 'hardhat_setCode', params: [ASSETS[1].address, `0x${tokenArtifact.evm.deployedBytecode.object}`] });
    const token = new Contract(ASSETS[1].address, tokenArtifact.abi, host);
    await (await token.mint(buyer.address, 1515000n)).wait();
    const market = await new ContractFactory(build.artifact.abi, build.artifact.evm.bytecode.object, host).deploy(fee.address, ASSETS[1].address);
    await market.waitForDeployment();
    const config = { address: await market.getAddress(), feeRecipient: fee.address,
      runtimeCodeHash: keccak256(await provider.getCode(await market.getAddress())), writesEnabled: true };
    const context = await browser.newContext({ viewport: { width, height: 900 }, timezoneId: 'UTC', reducedMotion: 'reduce' });
    try {
      const page = await context.newPage(), errors = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('dialog', dialog => dialog.accept());
      await page.exposeFunction('__bookingRpc', args => rpc.request(args));
      await page.route(/^https:\/\/mainnet\.base\.org\/?$/, async route => {
        const request = route.request().postDataJSON();
        const execute = async call => {
          try { return { jsonrpc: '2.0', id: call.id, result: await rpc.request({ method: call.method, params: call.params || [] }) }; }
          catch (error) { return { jsonrpc: '2.0', id: call.id, error: { code: error.code || -32000, message: error.message, data: error.data } }; }
        };
        const response = Array.isArray(request) ? await Promise.all(request.map(execute)) : await execute(request);
        await route.fulfill({ contentType: 'application/json', body: JSON.stringify(response) });
      });
      await page.route('**/decent.config.js', async route => {
        const response = await route.fetch();
        await route.fulfill({ response, body: `${await response.text()}\nwindow.DECENT_CONFIG.ens.enabled=false;window.DECENT_CONFIG.booking=${JSON.stringify(config)};` });
      });
      const connect = async address => {
        await page.evaluate(async address => {
          const provider = new ethers.BrowserProvider({ request: args => window.__bookingRpc(args) });
          window.dispatchEvent(new CustomEvent('decenthead:wallet', { detail: { connected: true, address, chainId: '0x2105', provider } }));
        }, address);
        await page.waitForFunction(address => window._walletAddress === address && !!window._walletSigner, address);
      };
      const load = async id => {
        await page.locator('#open-booking-registry').click();
        await page.locator('#booking-id').fill(String(id));
        await page.locator('#load-booking-id').click();
        await page.locator('#booking-registry-status').filter({ hasText: 'Read from the pinned registry' }).waitFor();
      };
      const registry = page.locator('#booking-registry-content');
      const status = page.locator('#booking-registry-status');
      await page.goto(url);
      await page.waitForFunction(() => window.DCalBookings && window.openSlotDetails && document.querySelector('.fc'));
      await connect(host.address);
      const block = await rpc.request({ method: 'eth_getBlockByNumber', params: ['latest', false] });
      const start = BigInt(block.timestamp) + 3600n, end = start + 5400n;
      const iso = value => new Date(Number(value) * 1000).toISOString();
      await page.locator('#add-event-btn').click();
      await page.locator('#event-title').fill('Learn together');
      await page.locator('#event-start').fill(iso(start).slice(0, 19));
      await page.locator('#event-end').fill(iso(end).slice(0, 19));
      await page.locator('#event-asset').selectOption('base:usdc');
      await page.locator('#event-rate').fill('1.01');
      await page.locator('#event-hardline').check();
      await page.locator('#save-event-btn').click();
      await page.locator('.fc-event').filter({ hasText: 'Learn together' }).first().click();
      await page.getByRole('button', { name: 'Review public on-chain offer' }).click();
      await registry.filter({ hasText: '1.515 USDC' }).waitFor();
      await registry.getByRole('button', { name: 'Publish public on-chain offer' }).click();
      await status.filter({ hasText: 'Offer 0 confirmed' }).waitFor();
      const permanent = await registry.getByRole('link', { name: 'Permanent booking link' }).getAttribute('href');
      assert.equal(new URL(permanent).searchParams.get('booking'), '0');
      assert.equal((await market.getSlot(0)).hardline, true);
      await page.goto(permanent);
      await status.filter({ hasText: 'Read from the pinned registry' }).waitFor();
      await connect(buyer.address);
      await load(0);
      await registry.locator('input[type="checkbox"]').check();
      await registry.getByRole('button', { name: 'Approve exact USDC amount (not a booking)', exact: true }).click();
      await status.filter({ hasText: 'Approval confirmed' }).waitFor();
      assert.equal((await market.getSlot(0)).state, 0n);
      assert.equal(await token.allowance(buyer.address, config.address), 1515000n);
      await registry.locator('input[type="checkbox"]').check();
      await registry.getByRole('button', { name: 'Book this exact agreement' }).click();
      await status.filter({ hasText: 'Booking receipt confirmed' }).waitFor();
      assert.equal((await market.getSlot(0)).state, 1n);
      await registry.getByRole('button', { name: 'Show checked slot on calendar' }).click();
      await page.locator('.fc-event').filter({ hasText: 'chain snapshot' }).first().click();
      await status.filter({ hasText: 'Read from the pinned registry' }).waitFor();
      assert.equal(await registry.locator('[aria-label="Buyer ENS display identity"]').count(), 1);
      await registry.getByRole('button', { name: 'Resolve with full refund credit to buyer' }).click();
      await status.filter({ hasText: 'Resolution confirmed' }).waitFor();
      await page.locator('#load-booking-credits').click();
      await registry.filter({ hasText: '1.515 USDC' }).waitFor();
      await registry.getByRole('button', { name: 'Withdraw USDC credit' }).click();
      await status.filter({ hasText: 'Withdrawal confirmed' }).waitFor();
      assert.equal(await token.balanceOf(buyer.address), 1515000n);
      assert.equal(await market.credits(buyer.address, ASSETS[1].address), 0n);

      await (await market.createSlot(ZeroAddress, 1000000000000000n, start, end, false, 'ETH session')).wait();
      await page.locator('#booking-registry [data-close]').click();
      await load(1);
      await registry.locator('input[type="checkbox"]').check();
      await registry.getByRole('button', { name: 'Book this exact agreement' }).click();
      await status.filter({ hasText: 'Booking receipt confirmed' }).waitFor();
      assert.equal(await registry.getByRole('button', { name: 'Release escrow: 97% host / 3% development' }).count(), 0);
      await rpc.request({ method: 'evm_setNextBlockTimestamp', params: [Number(end)] });
      await rpc.request({ method: 'evm_mine', params: [] });
      await registry.getByRole('button', { name: 'Refresh chain state' }).click();
      await registry.getByRole('button', { name: 'Release escrow: 97% host / 3% development' }).click();
      await status.filter({ hasText: 'Resolution confirmed' }).waitFor();
      assert.equal(await market.credits(host.address, ZeroAddress), 970000000000000n);
      assert.equal(await market.credits(fee.address, ZeroAddress), 30000000000000n);
      assert.deepEqual(errors, []);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      console.log(`${width}px: actual EVM public offer, hardline, ID-zero recovery, exact USDC approval/booking/refund/withdrawal and post-end ETH release passed`);
    } finally { await context.close(); await connection.close(); provider.destroy(); }
  }
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
