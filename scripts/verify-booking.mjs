import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { network } from 'hardhat';
import { BrowserProvider, Contract, ContractFactory, keccak256, ZeroAddress } from 'ethers';
import { compileBooking } from './compile-booking.mjs';
import { compileInvitations } from './compile-invitations.mjs';
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
const invitationBuild = await compileInvitations();
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
    const market = await new ContractFactory(build.artifact.abi, build.artifact.evm.bytecode.object, host).deploy(fee.address, host.address, [ASSETS[1].address]);
    await market.waitForDeployment();
    const invitationContract = await new ContractFactory(invitationBuild.artifact.abi, invitationBuild.artifact.evm.bytecode.object, host).deploy(await market.getAddress());
    await invitationContract.waitForDeployment();
    const invitationConfig = {
      address: await invitationContract.getAddress(),
      runtimeCodeHash: keccak256(await provider.getCode(await invitationContract.getAddress())),
    };
    const config = { address: await market.getAddress(), feeRecipient: fee.address,
      runtimeCodeHash: keccak256(await provider.getCode(await market.getAddress())), writesEnabled: true };
    const timezoneId = width === 1440 ? 'America/New_York' : 'Asia/Tokyo';
    const context = await browser.newContext({ viewport: { width, height: 900 }, timezoneId, reducedMotion: 'reduce' });
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
        await route.fulfill({ response, body: `${await response.text()}\nwindow.DECENT_CONFIG.ens.enabled=false;window.DECENT_CONFIG.booking=${JSON.stringify(config)};window.DECENT_CONFIG.invitations=${JSON.stringify(invitationConfig)};` });
      });
      const connect = async address => {
        await page.evaluate(async address => {
          const provider = new ethers.BrowserProvider({ request: args => window.__bookingRpc(args) });
          window.dispatchEvent(new CustomEvent('decenthead:wallet', { detail: { connected: true, address, chainId: '0x2105', provider } }));
        }, address);
        await page.waitForFunction(address => window._walletAddress === address && !!window._walletSigner, address);
      };
      const load = async id => {
        if (!await page.locator('#booking-registry').evaluate(dialog => dialog.open)) await page.locator('#open-booking-registry').click();
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
      assert.equal(await page.locator('#event-timezone').inputValue(), timezoneId);
      // Same path as drag-selecting a range on the grid; keeps the chain-aligned seconds.
      await page.evaluate(([from, to]) => window.openAddEventPanel({ start: from, end: to }), [iso(start), iso(end)]);
      assert.equal(await page.locator('#event-start').evaluate(input => Date.parse(input.value)), Number(start) * 1000);
      await page.locator('#event-title').fill('Learn together');
      await page.locator('#event-asset input[value="base:usdc"]').check();
      await page.locator('#event-rate').fill('1.01');
      await page.locator('#event-max-attendees').fill('2');
      await page.locator('#event-timezone').fill('America/Denver');
      await page.locator('#event-hardline').check();
      await page.locator('#save-event-btn').click();
      await page.locator('.fc-event').filter({ hasText: 'Learn together' }).first().click();
      await page.getByRole('button', { name: 'Review public on-chain offer' }).click();
      await registry.filter({ hasText: '1.515 USDC per attendee' }).waitFor();
      await registry.filter({ hasText: 'for host (America/Denver' }).waitFor();
      await registry.getByRole('button', { name: 'Publish public on-chain offer' }).click();
      await status.filter({ hasText: 'Offer 1 confirmed' }).waitFor();
      const permanent = await registry.getByRole('link', { name: 'Permanent timebox link' }).getAttribute('href');
      assert.equal(new URL(permanent).searchParams.get('booking'), '1');
      const created = await market.getSlot(1);
      assert.deepEqual([created.hardline, created.hostTimezone, created.maxAttendees, created.subject], [true, 'America/Denver', 2n, 'Learn together']);
      const invitations = registry.getByRole('region', { name: 'Timebox invitations and calendar' });
      await page.evaluate(address => {
        window.DCalProfiles.address = async input => {
          if (input === 'friend.eth') return address;
          throw new Error('ENS name does not resolve to a wallet address.');
        };
        window.DCalProfiles.lookup = async address => ({ address, name: 'friend.eth', warnings: [], avatar: '', banner: '' });
      }, buyer.address);
      await invitations.getByRole('textbox', { name: 'Invite by ENS name or wallet address' }).fill('friend.eth');
      await invitations.getByRole('button', { name: 'Create invitation link' }).click();
      const inviteLink = await invitations.getByRole('list', { name: 'Local invitation roster' }).getByRole('link').getAttribute('href');
      assert.equal(new URL(inviteLink).searchParams.get('invite'), buyer.address.toLowerCase());
      await invitations.filter({ hasText: 'friend.eth' }).waitFor();
      await invitations.locator('#invitation-preference').selectOption('2');
      await invitations.getByRole('button', { name: 'Send public Base invitation' }).click();
      await invitations.getByRole('status').filter({ hasText: 'Public invitation confirmed' }).waitFor();
      assert.equal(await invitationContract.inboxCount(buyer.address), 1n);
      assert.equal((await market.getSlot(1)).attendees, 0n);
      const downloadPromise = page.waitForEvent('download');
      await invitations.getByRole('button', { name: 'Download calendar (.ics)' }).click();
      const download = await downloadPromise;
      assert.equal(download.suggestedFilename(), 'dcal-timebox-1.ics');
      const calendar = (await readFile(await download.path(), 'utf8')).replace(/\r\n /g, '');
      assert.ok(calendar.includes('SUMMARY:Learn together'));
      assert.ok(calendar.includes('DTSTART:'));
      assert.ok(!calendar.includes('?booking=1&invite='));
      const google = new URL(await invitations.getByRole('link', { name: 'Add to Google Calendar' }).getAttribute('href'));
      assert.equal(google.searchParams.get('text'), 'Learn together');
      if (process.env.INVITATION_SCREENSHOTS) {
        await invitations.scrollIntoViewIfNeeded();
        await page.screenshot({ path: `${process.env.INVITATION_SCREENSHOTS}/invitations-${width}.png` });
      }
      // Reload preserves only the host's local invitation list; it is not chain state.
      await page.goto(inviteLink);
      await status.filter({ hasText: 'Read from the pinned registry' }).waitFor();
      await connect(buyer.address);
      const ankh = page.locator('ankh-menu[side="right"]');
      await ankh.locator('summary').click();
      await ankh.getByRole('button', { name: 'Invitations', exact: true }).click();
      const inbox = page.getByRole('dialog', { name: 'Invitations inbox' });
      await inbox.getByRole('status').filter({ hasText: 'Checked 1 of 1' }).waitFor();
      await inbox.locator('section').filter({ hasText: 'Request from' }).waitFor();
      assert.equal(await ankh.locator('.invitation-dot').isVisible(), false);
      await inbox.getByRole('button', { name: 'Trust host', exact: true }).click();
      assert.equal(await ankh.locator('.invitation-dot').isVisible(), true);
      assert.equal(await ankh.locator('.invitation-dot').textContent(), '1');
      if (process.env.INVITATION_SCREENSHOTS) await page.screenshot({ path: `${process.env.INVITATION_SCREENSHOTS}/inbox-${width}.png` });
      await inbox.getByRole('button', { name: 'Mute host', exact: true }).click();
      assert.equal(await ankh.locator('.invitation-dot').isVisible(), false);
      await inbox.getByRole('button', { name: 'Unmute host', exact: true }).click();
      assert.equal(await ankh.locator('.invitation-dot').isVisible(), true);
      await inbox.getByRole('button', { name: 'Review timebox', exact: true }).click();
      assert.equal(await ankh.locator('.invitation-dot').isVisible(), false);
      await load(1);
      await registry.locator('.invitation-greeting').filter({ hasText: buyer.address.toLowerCase() }).waitFor();
      assert.equal(await registry.getByRole('list', { name: 'Local invitation roster' }).count(), 0);
      await registry.locator('.invitation-greeting').filter({ hasText: 'not joined' }).waitFor();
      await registry.filter({ hasText: 'for host (America/Denver' }).waitFor();
      await page.locator('#booking-join-timezone').fill('Asia/Tokyo');
      await registry.locator('input[type="checkbox"]').check();
      await registry.getByRole('button', { name: 'Approve exact USDC deposit (not a booking)', exact: true }).click();
      await status.filter({ hasText: 'Approval confirmed' }).waitFor();
      assert.equal((await market.getSlot(1)).attendees, 0n);
      assert.equal(await token.allowance(buyer.address, config.address), 1515000n);
      await page.locator('#booking-join-timezone').fill('Asia/Tokyo');
      await registry.locator('input[type="checkbox"]').check();
      await registry.getByRole('button', { name: 'Join this timebox' }).click();
      await status.filter({ hasText: 'Seat receipt confirmed' }).waitFor();
      assert.equal((await market.getSeat(1, buyer.address)).timezone, 'Asia/Tokyo');
      await registry.locator('.invitation-greeting').filter({ hasText: 'Funded (chain)' }).waitFor();
      await registry.filter({ hasText: 'for them (Asia/Tokyo' }).waitFor();
      assert.equal(await registry.getByRole('button', { name: 'Reclaim my full deposit' }).count(), 0);
      await registry.getByRole('button', { name: 'Show checked slot on calendar' }).click();
      await page.locator('.fc-event').filter({ hasText: 'chain snapshot' }).first().click();
      await status.filter({ hasText: 'Read from the pinned registry' }).waitFor();
      assert.equal(await registry.locator('[aria-label="Attendee 1 ENS display identity"]').count(), 1);
      await connect(host.address);
      assert.equal(await ankh.locator('.invitation-dot').isVisible(), false);
      await load(1);
      await registry.getByRole('list', { name: 'Local invitation roster' }).filter({ hasText: 'Funded (chain)' }).waitFor();
      await registry.getByRole('button', { name: `Refund seat ${buyer.address} in full` }).click();
      await status.filter({ hasText: 'Resolution confirmed' }).waitFor();
      await connect(buyer.address);
      await page.locator('#open-booking-registry').click();
      await page.locator('#load-booking-credits').click();
      await registry.filter({ hasText: '1.515 USDC' }).waitFor();
      await registry.getByRole('button', { name: 'Withdraw USDC credit' }).click();
      await status.filter({ hasText: 'Withdrawal confirmed' }).waitFor();
      assert.equal(await token.balanceOf(buyer.address), 1515000n);
      assert.equal(await market.credits(buyer.address, ASSETS[1].address), 0n);

      const ethOffer = { asset: ZeroAddress, pricing: 0, price: 1000000000000000n, start: end, end: end + 3600n,
        minAttendees: 1, maxAttendees: 1, hardline: false, subject: 'ETH session', timezone: 'America/Denver' };
      await (await market.createSlot(ethOffer, await market.findPrev(host.address, ethOffer.start, ethOffer.end))).wait();
      await load(2);
      await registry.locator('input[type="checkbox"]').check();
      await registry.getByRole('button', { name: 'Join this timebox' }).click();
      await status.filter({ hasText: 'Seat receipt confirmed' }).waitFor();
      const releaseName = 'Release my seat: price to host, 3% development';
      assert.equal(await registry.getByRole('button', { name: releaseName }).count(), 0);
      await rpc.request({ method: 'evm_setNextBlockTimestamp', params: [Number(ethOffer.end)] });
      await rpc.request({ method: 'evm_mine', params: [] });
      await registry.getByRole('button', { name: 'Refresh chain state' }).click();
      await registry.getByRole('button', { name: releaseName }).click();
      await status.filter({ hasText: 'Resolution confirmed' }).waitFor();
      assert.equal(await market.credits(host.address, ZeroAddress), 970000000000000n);
      assert.equal(await market.credits(fee.address, ZeroAddress), 30000000000000n);
      assert.deepEqual(errors, []);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      console.log(`${width}px: EVM-signed public invitation, wallet discovery, requests/trust/mute/read badge, calendar exports, USDC join/refund/withdrawal and ETH release passed`);
    } finally { await context.close(); await connection.close(); provider.destroy(); }
  }
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
