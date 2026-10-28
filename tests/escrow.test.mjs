import test from 'node:test';
import assert from 'node:assert/strict';
import { compileBooking } from '../scripts/compile-booking.mjs';
import { matchesRuntime } from '../scripts/prepare-booking-deployment.mjs';
import { network } from 'hardhat';
import { BrowserProvider, Contract, ContractFactory, ZeroAddress, parseEther, keccak256 } from 'ethers';
import { createBookingClient } from '../decent-calendar-vanilla/js/booking-client.js';
import { ASSETS } from '../decent-calendar-vanilla/js/assets.js';

const mocks = `// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.30;
contract MockUSDC {
  mapping(address=>uint256) public balanceOf;
  mapping(address=>mapping(address=>uint256)) public allowance;
  bool public fail;
  bool public tax;
  function mint(address to,uint256 amount) external { balanceOf[to]+=amount; }
  function setFail(bool value) external { fail=value; }
  function setTax(bool value) external { tax=value; }
  function approve(address spender,uint256 amount) external returns(bool) { allowance[msg.sender][spender]=amount; return true; }
  function transferFrom(address from,address to,uint256 amount) external returns(bool) {
    if(fail)return false;
    require(allowance[from][msg.sender]>=amount && balanceOf[from]>=amount);
    allowance[from][msg.sender]-=amount;balanceOf[from]-=amount;balanceOf[to]+=tax?amount-1:amount;return true;
  }
  function transfer(address to,uint256 amount) external returns(bool) {
    if(fail)return false;
    require(balanceOf[msg.sender]>=amount); balanceOf[msg.sender]-=amount;balanceOf[to]+=amount;return true;
  }
}
contract RejectETH { receive() external payable { revert(); } }
interface IWithdraw {
  function withdraw(address,address payable) external;
}
contract ReenterETH {
  address public market;
  bool public reentered;
  function configure(address value) external { market=value; }
  receive() external payable {
    (reentered,) = market.call(abi.encodeWithSignature("withdraw(address,address)",address(0),address(this)));
  }
}
`;
const compiled = await compileBooking({ 'Mocks.sol': { content: mocks } });

async function setup(t, canonical = false) {
  const connection = await network.connect('local');
  const rpc = connection.provider;
  t.after(() => connection.close());
  const provider = new BrowserProvider(rpc);
  provider.pollingInterval = 10;
  const [host, buyer, second, fee, outsider, third, admin] = await Promise.all([0, 1, 2, 3, 4, 5, 6].map(index => provider.getSigner(index)));
  const deploy = async (file, name, args = []) => {
    const artifact = compiled.contracts[file][name];
    const contract = await new ContractFactory(artifact.abi, artifact.evm.bytecode.object, host).deploy(...args);
    await contract.waitForDeployment();
    return contract;
  };
  let usdc = await deploy('Mocks.sol', 'MockUSDC');
  if (canonical) {
    await rpc.request({ method: 'hardhat_setCode', params: [ASSETS[1].address, await provider.getCode(await usdc.getAddress())] });
    usdc = new Contract(ASSETS[1].address, compiled.contracts['Mocks.sol'].MockUSDC.abi, host);
  }
  const market = await deploy('DCalBooking.sol', 'DCalBooking', [fee.address, admin.address, [await usdc.getAddress()]]);
  const block = await rpc.request({ method: 'eth_getBlockByNumber', params: ['latest', false] });
  const base = BigInt(block.timestamp) + 3600n;
  let cursor = base;
  const start = base, end = base + 3600n;
  // Each created timebox gets its own non-overlapping hour unless an interval is supplied.
  const create = async (overrides = {}, signer = host) => {
    const offer = { asset: ZeroAddress, pricing: 0, price: parseEther('1'), start: cursor, end: cursor + 3600n,
      minAttendees: 1, maxAttendees: 1, hardline: true, subject: 'Learn together', timezone: 'America/Denver', ...overrides };
    if (!('start' in overrides)) cursor += 3600n;
    const prev = await market.findPrev(signer.address, offer.start, offer.end);
    const id = await market.nextId();
    await (await market.connect(signer).createSlot(offer, prev)).wait();
    const deposit = await market.depositFor(id);
    return { id, offer, deposit, args: [id, offer.asset, deposit, 'Europe/Lisbon'] };
  };
  const join = (slot, signer, timezone = 'Europe/Lisbon') =>
    market.connect(signer).join(slot.id, slot.offer.asset, slot.deposit, timezone, { value: slot.offer.asset === ZeroAddress ? slot.deposit : 0n });
  const at = async timestamp => {
    await rpc.request({ method: 'evm_setNextBlockTimestamp', params: [Number(timestamp)] });
    await rpc.request({ method: 'evm_mine', params: [] });
  };
  const advance = async seconds => {
    await rpc.request({ method: 'evm_increaseTime', params: [seconds] });
    await rpc.request({ method: 'evm_mine', params: [] });
  };
  const fund = async (signer, amount) => {
    await send(usdc.mint(signer.address, amount));
    await send(usdc.connect(signer).approve(await market.getAddress(), amount));
  };
  return { rpc, provider, market, usdc, host, buyer, second, third, fee, outsider, admin, create, join, at, advance, fund, start, end, deploy };
}
const send = async promise => (await promise).wait();
const rejects = async (action, pattern) => assert.rejects(async () => send(action()), pattern);

test('timebox: per-head ETH seats require exact terms, block host/duplicate/overflow joins and early release', async t => {
  const app = await setup(t), slot = await app.create({ maxAttendees: 2 });
  assert.equal(slot.deposit, parseEther('1'));
  await rejects(() => app.market.connect(app.buyer).join(slot.id, ZeroAddress, slot.deposit, 'Europe/Lisbon', { value: slot.deposit - 1n }), /Incorrect ETH/);
  await rejects(() => app.market.connect(app.buyer).join(slot.id, ZeroAddress, slot.deposit - 1n, 'Europe/Lisbon', { value: slot.deposit - 1n }), /Terms changed/);
  await rejects(() => app.join(slot, app.host), /Cannot join/);
  await send(app.join(slot, app.buyer));
  await rejects(() => app.join(slot, app.buyer), /Already joined/);
  await send(app.join(slot, app.second, 'Asia/Tokyo'));
  await rejects(() => app.join(slot, app.third), /Timebox full/);
  await rejects(() => app.market.connect(app.buyer).release(slot.id), /Session not ended/);
  assert.deepEqual([...await app.market.rosterOf(slot.id)], [app.buyer.address, app.second.address]);
  const seat = await app.market.getSeat(slot.id, app.second.address);
  assert.equal(seat.timezone, 'Asia/Tokyo');
  assert.equal((await app.market.getSlot(slot.id)).hostTimezone, 'America/Denver');
});
test('timebox: each per-head attendee releases their own seat 97/3 after the end', async t => {
  const app = await setup(t), slot = await app.create({ maxAttendees: 3, minAttendees: 2 });
  await send(app.join(slot, app.buyer));
  await send(app.join(slot, app.second));
  await app.at(slot.offer.end);
  await rejects(() => app.market.connect(app.outsider).release(slot.id), /Not funded attendee/);
  await send(app.market.connect(app.buyer).release(slot.id));
  assert.equal(await app.market.credits(app.host.address, ZeroAddress), parseEther('0.97'));
  await send(app.market.connect(app.second).release(slot.id));
  assert.equal(await app.market.credits(app.host.address, ZeroAddress), parseEther('1.94'));
  assert.equal(await app.market.credits(app.fee.address, ZeroAddress), parseEther('0.06'));
  await rejects(() => app.market.connect(app.buyer).release(slot.id), /Not funded attendee/);
  await rejects(() => app.market.connect(app.buyer).refund(slot.id, app.buyer.address), /Not funded/);
});
test('timebox: split deposits total/minimum and rebates down to total/actual attendees', async t => {
  const app = await setup(t), slot = await app.create({ pricing: 1, price: parseEther('1'), minAttendees: 2, maxAttendees: 4 });
  assert.equal(slot.deposit, parseEther('0.5'));
  for (const signer of [app.buyer, app.second, app.third]) await send(app.join(slot, signer));
  await app.at(slot.offer.end);
  const charge = await app.market.chargeFor(slot.id);
  assert.equal(charge, 333333333333333334n);
  for (const signer of [app.buyer, app.second, app.third]) await send(app.market.connect(signer).release(slot.id));
  const fee = charge * 300n / 10000n;
  assert.equal(await app.market.credits(app.host.address, ZeroAddress), (charge - fee) * 3n);
  assert.equal(await app.market.credits(app.fee.address, ZeroAddress), fee * 3n);
  assert.equal(await app.market.credits(app.buyer.address, ZeroAddress), parseEther('0.5') - charge);
  assert.ok(charge * 3n - parseEther('1') < 3n, 'host total exceeds price by less than one unit per attendee');
});
test('timebox: an unmet minimum cannot settle; attendees reclaim only from start, never leave early', async t => {
  const app = await setup(t), slot = await app.create({ pricing: 1, minAttendees: 2, maxAttendees: 3 });
  await send(app.join(slot, app.buyer));
  // staticCall: ethers caches identical estimateGas results for 250 ms, shorter than this time-travelling test.
  await assert.rejects(app.market.connect(app.buyer).refund.staticCall(slot.id, app.buyer.address), /Refund not authorized/);
  await app.at(slot.offer.start);
  await rejects(() => app.join(slot, app.second), /Cannot join/);
  await rejects(() => app.market.connect(app.outsider).refund(slot.id, app.buyer.address), /Refund not authorized/);
  await app.at(slot.offer.end);
  await rejects(() => app.market.connect(app.buyer).release(slot.id), /Minimum not reached/);
  await send(app.market.connect(app.buyer).refund(slot.id, app.buyer.address));
  assert.equal(await app.market.credits(app.buyer.address, ZeroAddress), parseEther('0.5'));
});
test('timebox: host refund before start frees a seat; after start the count is frozen and host forgoes that share', async t => {
  const app = await setup(t), slot = await app.create({ pricing: 1, price: 900n, minAttendees: 2, maxAttendees: 2 });
  await send(app.join(slot, app.buyer));
  await send(app.join(slot, app.second));
  await send(app.market.refund(slot.id, app.second.address));
  assert.equal((await app.market.getSlot(slot.id)).attendees, 1n);
  await rejects(() => app.join(slot, app.second), /Already joined/);
  await send(app.join(slot, app.third));
  await app.at(slot.offer.start);
  await send(app.market.refund(slot.id, app.third.address));
  assert.equal((await app.market.getSlot(slot.id)).attendees, 2n);
  await app.at(slot.offer.end);
  await send(app.market.connect(app.buyer).release(slot.id));
  assert.equal(await app.market.credits(app.host.address, ZeroAddress), 450n - 13n);
  assert.equal(await app.market.credits(app.third.address, ZeroAddress), 450n);
  assert.equal(await app.market.credits(app.second.address, ZeroAddress), 450n);
});
test('timebox: host cancellation credits every funded seat, frees the time and blocks joins', async t => {
  const app = await setup(t), slot = await app.create({ maxAttendees: 3 });
  await send(app.join(slot, app.buyer));
  await send(app.join(slot, app.second));
  await rejects(() => app.create({ start: slot.offer.start, end: slot.offer.end }), /Time collision/);
  await rejects(() => app.market.connect(app.buyer).cancel(slot.id), /Not open host/);
  await send(app.market.cancel(slot.id));
  await rejects(() => app.market.cancel(slot.id), /Not open host/);
  for (const signer of [app.buyer, app.second]) assert.equal(await app.market.credits(signer.address, ZeroAddress), parseEther('1'));
  await rejects(() => app.join(slot, app.third), /Not open/);
  const replacement = await app.create({ start: slot.offer.start, end: slot.offer.end });
  assert.equal((await app.market.getSlot(replacement.id)).start, slot.offer.start);
});
test('timebox: a host\'s timeboxes cannot collide; adjacent boxes, gaps and other hosts are allowed', async t => {
  const app = await setup(t), h = 3600n, s = app.start + 10n * h;
  const a = await app.create({ start: s, end: s + h });
  const c = await app.create({ start: s + 3n * h, end: s + 4n * h });
  const b = await app.create({ start: s + h, end: s + 2n * h });
  const early = await app.create({ start: s - 2n * h, end: s - h });
  for (const [start, end] of [[s, s + h], [s - 1n, s + 1n], [s + h / 2n, s + 3n * h], [s + 3n * h + 1n, s + 5n * h], [s - 3n * h, s + 5n * h]]) {
    await assert.rejects(app.market.findPrev(app.host.address, start, end), /Time collision/);
  }
  await rejects(() => app.market.createSlot({ ...a.offer, start: s + 2n * h, end: s + 3n * h }, 0n), /Time collision/);
  await rejects(() => app.market.createSlot({ ...a.offer, start: s + 2n * h, end: s + 3n * h }, c.id), /Time collision/);
  await rejects(() => app.market.createSlot({ ...a.offer, start: s + 2n * h, end: s + 3n * h + 1n }, b.id), /Time collision/);
  const gap = await app.create({ start: s + 2n * h, end: s + 3n * h });
  const order = [];
  for (let id = await app.market.firstSlot(app.host.address); id !== 0n; id = await app.market.nextSlot(id)) order.push(id);
  assert.deepEqual(order, [early.id, a.id, b.id, gap.id, c.id]);
  await app.create({ start: s, end: s + h }, app.outsider);
  await send(app.market.cancel(b.id));
  const after = [];
  for (let id = await app.market.lastSlot(app.host.address); id !== 0n; id = await app.market.prevSlot(id)) after.unshift(id);
  assert.deepEqual(after, [early.id, a.id, gap.id, c.id]);
});
test('timebox: subjects, attendee bounds and IANA-style timezones are required on create and join', async t => {
  const app = await setup(t);
  for (const bad of [{ subject: '' }, { subject: 'x'.repeat(201) }, { timezone: '' }, { timezone: 'America/New York' },
    { timezone: 'x'.repeat(65) }, { minAttendees: 0 }, { minAttendees: 3, maxAttendees: 2 }, { maxAttendees: 51 }]) {
    await rejects(() => app.create(bad), /Invalid/);
  }
  await rejects(() => app.create({ start: app.start - 7200n, end: app.start - 3600n }), /Invalid interval/);
  const slot = await app.create({ timezone: 'Etc/GMT+5' });
  for (const timezone of ['', 'Europe/Lisbon;', 'Ünicode']) await rejects(() => app.join(slot, app.buyer, timezone), /Invalid timezone/);
  await send(app.join(slot, app.buyer, 'America/Argentina/Buenos_Aires'));
});
test('admin: only the owner allowlists tokens; delisting stops new use but never traps escrow', async t => {
  const app = await setup(t), asset = await app.usdc.getAddress();
  assert.equal(await app.market.owner(), app.admin.address);
  assert.equal(await app.market.allowedToken(asset), true);
  await rejects(() => app.market.setToken(asset, false), /Not owner/);
  await rejects(() => app.market.connect(app.admin).setToken(app.outsider.address, true), /Invalid token/);
  await rejects(() => app.create({ asset: app.outsider.address }), /Unsupported asset/);
  const slot = await app.create({ asset, price: 1000n, maxAttendees: 2 });
  await app.fund(app.buyer, 2000n);
  await send(app.join(slot, app.buyer));
  await send(app.market.connect(app.admin).setToken(asset, false));
  await rejects(() => app.create({ asset, price: 1000n }), /Unsupported asset/);
  await app.fund(app.second, 1000n);
  await rejects(() => app.join(slot, app.second), /Unsupported asset/);
  await app.at(slot.offer.end);
  await send(app.market.connect(app.buyer).release(slot.id));
  await send(app.market.withdraw(asset, app.host.address));
  assert.equal(await app.usdc.balanceOf(app.host.address), 970n);
  await rejects(() => app.market.connect(app.buyer).transferOwnership(app.buyer.address), /Not owner/);
  await send(app.market.connect(app.admin).transferOwnership(app.outsider.address));
  assert.equal(await app.market.owner(), app.admin.address);
  await rejects(() => app.market.connect(app.buyer).acceptOwnership(), /Not pending owner/);
  await send(app.market.connect(app.outsider).acceptOwnership());
  assert.equal(await app.market.owner(), app.outsider.address);
  await rejects(() => app.market.connect(app.admin).setToken(asset, true), /Not owner/);
  await send(app.market.connect(app.outsider).renounceOwnership());
  assert.equal(await app.market.owner(), ZeroAddress);
  await rejects(() => app.market.connect(app.outsider).setToken(asset, true), /Not owner/);
});
test('escrow: USDC exact fee rounding and recoverable failed withdrawal', async t => {
  const app = await setup(t), asset = await app.usdc.getAddress(), slot = await app.create({ asset, price: 1000001n });
  await app.fund(app.buyer, slot.deposit);
  await send(app.join(slot, app.buyer));
  await app.at(slot.offer.end);
  await send(app.market.connect(app.buyer).release(slot.id));
  const fee = await app.market.credits(app.fee.address, asset), host = await app.market.credits(app.host.address, asset);
  assert.equal(fee, 30000n);
  assert.equal(fee + host, slot.deposit);
  await send(app.usdc.setFail(true));
  await rejects(() => app.market.withdraw(asset, app.host.address));
  assert.equal(await app.market.credits(app.host.address, asset), host);
  await send(app.usdc.setFail(false));
  await send(app.market.withdraw(asset, app.outsider.address, { gasLimit: 200000 }));
  assert.equal(await app.usdc.balanceOf(app.outsider.address), host);
});
test('escrow: taxed/false-return tokens and unexpected ETH cannot fund a seat', async t => {
  const app = await setup(t), asset = await app.usdc.getAddress(), slot = await app.create({ asset, price: 100n });
  await app.fund(app.buyer, 100n);
  await rejects(() => app.market.connect(app.buyer).join(slot.id, asset, 100n, 'UTC', { value: 1 }), /Unexpected ETH/);
  await rejects(() => app.market.connect(app.buyer).join(slot.id, ZeroAddress, 100n, 'UTC'), /Unsupported asset/);
  await send(app.usdc.setFail(true));
  await rejects(() => app.join(slot, app.buyer));
  await send(app.usdc.setFail(false));
  await send(app.usdc.setTax(true));
  await rejects(() => app.market.connect(app.buyer).join(slot.id, asset, 100n, 'UTC', { gasLimit: 400000 }));
  assert.equal((await app.market.getSlot(slot.id)).attendees, 0n);
});
test('escrow: free timeboxes join and resolve without transfers or development fees', async t => {
  const app = await setup(t), slot = await app.create({ price: 0n, pricing: 1, minAttendees: 2, maxAttendees: 2 });
  await send(app.join(slot, app.buyer));
  await send(app.join(slot, app.second));
  await app.at(slot.offer.end);
  await send(app.market.connect(app.buyer).release(slot.id));
  assert.equal(await app.market.credits(app.host.address, ZeroAddress), 0n);
  assert.equal(await app.market.credits(app.fee.address, ZeroAddress), 0n);
});
test('escrow: expired and unknown timeboxes cannot be joined', async t => {
  const app = await setup(t), slot = await app.create();
  await app.at(slot.offer.start);
  await rejects(() => app.join(slot, app.buyer), /Cannot join/);
  await rejects(() => app.market.connect(app.buyer).join(9999, ZeroAddress, 0n, 'UTC'), /Not open/);
  await rejects(() => app.market.connect(app.buyer).join(0, ZeroAddress, 0n, 'UTC'), /Not open/);
  await assert.rejects(app.market.getSlot(9999), /Unknown slot/);
  await assert.rejects(app.market.getSlot(0), /Unknown slot/);
});
test('escrow: exact start/end and seven-day refund boundaries are enforced by the EVM', async t => {
  const app = await setup(t), slot = await app.create({ maxAttendees: 3, minAttendees: 1 });
  for (const signer of [app.buyer, app.second, app.third]) await send(app.join(slot, signer));
  const call = (method, signer) => method === 'release'
    ? app.market.connect(signer).release.staticCall(slot.id)
    : app.market.connect(signer).refund.staticCall(slot.id, signer.address);
  await app.at(slot.offer.start - 1n);
  await assert.rejects(call('refund', app.buyer));
  await app.at(slot.offer.end - 1n);
  await assert.rejects(call('release', app.second));
  await app.at(slot.offer.end);
  await call('release', app.second);
  await app.at(slot.offer.end + 604799n);
  await assert.rejects(call('refund', app.third));
  await app.at(slot.offer.end + 604800n);
  await call('refund', app.third);
});
test('escrow: rejected ETH destination preserves credit; withdrawal callbacks cannot reenter', async t => {
  const app = await setup(t), slot = await app.create();
  await send(app.join(slot, app.buyer));
  await app.at(slot.offer.end);
  await send(app.market.connect(app.buyer).release(slot.id));
  const reject = await app.deploy('Mocks.sol', 'RejectETH');
  await rejects(() => app.market.withdraw(ZeroAddress, reject.getAddress()));
  assert.equal(await app.market.credits(app.host.address, ZeroAddress), parseEther('0.97'));
  const receiver = await app.deploy('Mocks.sol', 'ReenterETH');
  await send(receiver.configure(await app.market.getAddress()));
  await send(app.market.withdraw(ZeroAddress, await receiver.getAddress()));
  assert.equal(await receiver.reentered(), false);
  assert.equal(await app.market.credits(app.host.address, ZeroAddress), 0n);
  assert.equal(await app.market.credits(app.fee.address, ZeroAddress), parseEther('0.03'));
});
test('deployment: runtime verification permits immutable addresses but rejects altered executable code', async t => {
  const app = await setup(t);
  const code = await app.provider.getCode(await app.market.getAddress());
  assert.equal(matchesRuntime(code, compiled.artifact), true);
  assert.equal(matchesRuntime(`0x00${code.slice(4)}`, compiled.artifact), false);
  assert.equal(matchesRuntime('0x', compiled.artifact), false);
});
test('escrow: custody equals unresolved deposits plus all credits across mixed group resolutions', async t => {
  const app = await setup(t), asset = await app.usdc.getAddress();
  const people = [app.buyer, app.second, app.third];
  for (const signer of people) await app.fund(signer, 10n ** 9n);
  const slots = [];
  for (const [pricing, price, minAttendees] of [[0, 0n, 1], [0, 33n, 1], [1, 1000001n, 2], [1, 9999n, 3], [0, 1515000n, 2], [1, 7n, 1]]) {
    const slot = await app.create({ asset, pricing, price, minAttendees, maxAttendees: 3 });
    slots.push(slot);
    for (const signer of people) await send(app.join(slot, signer));
  }
  await send(app.market.refund(slots[1].id, app.second.address));
  await send(app.market.cancel(slots[5].id));
  const custody = async () => {
    const credits = await Promise.all([app.host, app.fee, ...people].map(actor => app.market.credits(actor.address, asset)));
    let unresolved = 0n;
    for (const { id } of slots) for (const signer of people) {
      const seat = await app.market.getSeat(id, signer.address);
      if (seat.state === 1n) unresolved += seat.deposit;
    }
    assert.equal(await app.usdc.balanceOf(await app.market.getAddress()), unresolved + credits.reduce((sum, amount) => sum + amount, 0n));
  };
  await custody();
  await app.at(slots[4].offer.end);
  for (const slot of slots.slice(0, 5)) for (const signer of people) {
    if ((await app.market.getSeat(slot.id, signer.address)).state === 1n) await send(app.market.connect(signer).release(slot.id));
  }
  await custody();
  await send(app.market.withdraw(asset, app.host.address));
  await custody();
  for (const actor of [app.fee, ...people]) {
    if (await app.market.credits(actor.address, asset) > 0n) await send(app.market.connect(actor).withdraw(asset, actor.address));
  }
  await custody();
  assert.equal(await app.usdc.balanceOf(await app.market.getAddress()), 0n);
});

async function clientFixture(t) {
  const app = await setup(t, true);
  let session = { address: app.host.address, signer: app.host };
  const transactions = [];
  const config = { address: await app.market.getAddress(), runtimeCodeHash: keccak256(await app.provider.getCode(await app.market.getAddress())),
    feeRecipient: app.fee.address, writesEnabled: true };
  const options = { config, provider: app.provider, getSession: () => session, Contract, hashCode: keccak256,
    onTransaction: value => transactions.push(value) };
  const offer = (overrides = {}) => ({ host: app.host.address, asset: ZeroAddress, pricing: 0, price: parseEther('1'), start: app.start, end: app.end,
    minAttendees: 1, maxAttendees: 1, hardline: true, subject: 'Learn together', timezone: 'America/Denver', ...overrides });
  return { ...app, config, options, transactions, offer, client: createBookingClient(options),
    as(actor) { session = actor ? { address: actor.address, signer: actor } : null; } };
}
test('adapter: split ETH timebox joins with timezones, rebates at release and withdraws confirmed credits', async t => {
  const app = await clientFixture(t);
  const id = await app.client.create(app.offer({ pricing: 1, minAttendees: 2, maxAttendees: 3, price: parseEther('0.9') }));
  assert.equal(id, 1n);
  await assert.rejects(app.client.create(app.offer({ start: app.start + 1800n, end: app.end + 1800n })), /collides with one of your open/);
  for (const [actor, zone] of [[app.buyer, 'Asia/Tokyo'], [app.second, 'Europe/Lisbon'], [app.third, 'Asia/Kolkata']]) {
    app.as(actor);
    const expected = await app.client.read(id);
    assert.equal(expected.deposit, parseEther('0.45'));
    await app.client.join(expected, zone);
  }
  const slot = await app.client.read(id);
  assert.deepEqual(slot.seats.map(seat => seat.timezone), ['Asia/Tokyo', 'Europe/Lisbon', 'Asia/Kolkata']);
  assert.equal(slot.charge, parseEther('0.3'));
  assert.equal(slot.hostTimezone, 'America/Denver');
  await assert.rejects(app.client.release(id), /not available/);
  await app.advance(7201);
  await app.client.release(id);
  assert.equal((await app.client.credits())[0].amount, parseEther('0.15'));
  app.as(app.host);
  assert.equal((await app.client.credits())[0].amount, parseEther('0.291'));
  await app.client.withdraw(ZeroAddress, app.outsider.address);
  assert.equal((await app.client.credits())[0].amount, 0n);
  assert.equal(app.transactions.filter(value => value.phase === 'confirmed').length, 6);
});
test('adapter: USDC approval is exact and separate, stale terms reject, host refund and withdrawal reconcile', async t => {
  const app = await clientFixture(t);
  const id = await app.client.create(app.offer({ asset: ASSETS[1].address, price: 1515000n, maxAttendees: 2 }));
  await send(app.usdc.mint(app.buyer.address, 1515000n));
  app.as(app.buyer);
  const expected = await app.client.read(id);
  await assert.rejects(app.client.join(expected, 'UTC'), /Approve the exact/);
  await app.client.approve(id);
  assert.equal(await app.client.allowance(expected), 1515000n);
  assert.equal((await app.client.read(id)).attendees, 0);
  await assert.rejects(app.client.join({ ...expected, price: 1n }, 'UTC'), /displayed agreement changed/);
  await app.client.join(expected, 'UTC');
  await assert.rejects(app.client.refund(id, app.buyer.address), /not available/);
  app.as(app.host);
  await app.client.refund(id, app.buyer.address);
  app.as(app.buyer);
  assert.equal((await app.client.credits())[1].amount, 1515000n);
  await app.client.withdraw(ASSETS[1].address, app.buyer.address);
  assert.equal(await app.usdc.balanceOf(app.buyer.address), 1515000n);
  app.as(app.host);
  await app.client.cancel(id);
  assert.equal((await app.client.read(id)).state, 1);
});
test('adapter: wrong bytecode, fee recipient, RPC network, missing ID and changed wallet fail explicitly', async t => {
  const app = await clientFixture(t), slot = await app.create();
  for (const config of [{ runtimeCodeHash: `0x${'0'.repeat(64)}` }, { feeRecipient: app.outsider.address }]) {
    const client = createBookingClient({ ...app.options, config: { ...app.config, ...config } });
    await assert.rejects(client.read(slot.id), /bytecode|policy/);
  }
  const wrongChain = createBookingClient({ ...app.options, provider: { send: async () => '0xa' } });
  await assert.rejects(wrongChain.read(slot.id), /must be on Base/);
  await assert.rejects(app.client.read(999999));
  await assert.rejects(app.client.read(0), /positive/);
  app.as(null);
  await assert.rejects(app.client.cancel(slot.id), /Wallet session changed/);
  assert.equal(app.transactions.length, 0);
});
test('adapter: wallet switch during validation prevents submission; RPC outage is not an empty timebox', async t => {
  const app = await clientFixture(t), slot = await app.create();
  const provider = new Proxy(app.provider, { get(target, key) {
    if (key === 'getCode') return async address => { app.as(app.outsider); return target.getCode(address); };
    const value = Reflect.get(target, key);
    return typeof value === 'function' ? value.bind(target) : value;
  } });
  const client = createBookingClient({ ...app.options, provider });
  await assert.rejects(client.cancel(slot.id), /Wallet session changed|Only the host/);
  assert.equal(app.transactions.length, 0);
  const offline = createBookingClient({ ...app.options, provider: { send() { throw new Error('RPC offline'); } } });
  await assert.rejects(offline.read(slot.id), /RPC offline/);
});
test('adapter: a pending transaction blocks duplicate submission, then unlocks for recovery', async t => {
  const app = await clientFixture(t), slot = await app.create();
  let release, entered;
  const gate = new Promise(resolve => { release = resolve; });
  const started = new Promise(resolve => { entered = resolve; });
  const provider = new Proxy(app.provider, { get(target, key) {
    if (key === 'getCode') return async address => { entered(); await gate; return target.getCode(address); };
    const value = Reflect.get(target, key);
    return typeof value === 'function' ? value.bind(target) : value;
  } });
  const client = createBookingClient({ ...app.options, provider });
  const first = client.cancel(slot.id);
  await started;
  await assert.rejects(client.cancel(slot.id), /Another booking transaction is pending/);
  release();
  await first;
  assert.equal((await client.read(slot.id)).state, 1);
  assert.equal(app.transactions.filter(value => value.phase === 'submitted').length, 1);
});
