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
  const [host, buyer, fee, outsider] = await Promise.all([0, 1, 2, 3].map(index => provider.getSigner(index)));
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
  const market = await deploy('DCalBooking.sol', 'DCalBooking', [fee.address, await usdc.getAddress()]);
  const block = await rpc.request({ method: 'eth_getBlockByNumber', params: ['latest', false] });
  const start = BigInt(block.timestamp) + 3600n, end = start + 3600n;
  const create = async (asset = ZeroAddress, gross = parseEther('1'), hardline = true) => {
    const id = await market.nextId();
    await (await market.createSlot(asset, gross, start, end, hardline, 'ipfs://public-terms')).wait();
    return { id, args: [id, asset, gross, start, end, hardline], gross, asset };
  };
  const advance = async seconds => {
    await rpc.request({ method: 'evm_increaseTime', params: [seconds] });
    await rpc.request({ method: 'evm_mine', params: [] });
  };
  return { rpc, provider, market, usdc, host, buyer, fee, outsider, create, advance, start, end, deploy };
}
const send = async promise => (await promise).wait();
const rejects = async action => assert.rejects(async () => send(action()));

test('escrow: exact ETH, stale terms, host/competing booking and early release are rejected', async t => {
  const app = await setup(t), slot = await app.create();
  await rejects(() => app.market.connect(app.buyer).book(...slot.args, { value: slot.gross - 1n }));
  await rejects(() => app.market.book(...slot.args, { value: slot.gross }));
  const changed = [...slot.args]; changed[5] = false;
  await rejects(() => app.market.connect(app.buyer).book(...changed, { value: slot.gross }));
  await send(app.market.connect(app.buyer).book(...slot.args, { value: slot.gross }));
  await rejects(() => app.market.connect(app.outsider).book(...slot.args, { value: slot.gross }));
  await rejects(() => app.market.connect(app.buyer).release(slot.id));
});
test('escrow: buyer-only post-session release allocates 97/3 and withdraws separately', async t => {
  const app = await setup(t), slot = await app.create();
  await send(app.market.connect(app.buyer).book(...slot.args, { value: slot.gross }));
  await app.advance(7201);
  await rejects(() => app.market.release(slot.id));
  await send(app.market.connect(app.buyer).release(slot.id));
  assert.equal(await app.market.credits(app.host.address, ZeroAddress), parseEther('0.97'));
  assert.equal(await app.market.credits(app.fee.address, ZeroAddress), parseEther('0.03'));
  await send(app.market.withdraw(ZeroAddress, app.host.address));
  assert.equal(await app.market.credits(app.host.address, ZeroAddress), 0n);
  await rejects(() => app.market.connect(app.buyer).release(slot.id));
  await rejects(() => app.market.connect(app.buyer).refund(slot.id));
});
test('escrow: either party cancels before start for full refund, no fee and no rebooking', async t => {
  const app = await setup(t);
  for (const actor of [app.host, app.buyer]) {
    const slot = await app.create();
    await send(app.market.connect(app.buyer).book(...slot.args, { value: slot.gross }));
    await rejects(() => app.market.connect(app.outsider).refund(slot.id));
    await send(app.market.connect(actor).refund(slot.id));
    assert.equal((await app.market.getSlot(slot.id)).state, 3n);
    await rejects(() => app.market.connect(app.outsider).book(...slot.args, { value: slot.gross }));
  }
  assert.equal(await app.market.credits(app.buyer.address, ZeroAddress), parseEther('2'));
  assert.equal(await app.market.credits(app.fee.address, ZeroAddress), 0n);
});
test('escrow: host can refund after start; buyer cannot until seven days after end', async t => {
  const app = await setup(t), first = await app.create(), second = await app.create();
  for (const slot of [first, second]) await send(app.market.connect(app.buyer).book(...slot.args, { value: slot.gross }));
  await app.advance(7201);
  await rejects(() => app.market.connect(app.buyer).refund(first.id));
  await send(app.market.refund(first.id));
  await app.advance(7 * 86400);
  await send(app.market.connect(app.buyer).refund(second.id));
  assert.equal(await app.market.credits(app.buyer.address, ZeroAddress), parseEther('2'));
});
test('escrow: standard USDC transfer, exact fee rounding and recoverable failed withdrawal', async t => {
  const app = await setup(t), asset = await app.usdc.getAddress(), slot = await app.create(asset, 1000001n);
  await send(app.usdc.mint(app.buyer.address, slot.gross));
  await send(app.usdc.connect(app.buyer).approve(await app.market.getAddress(), slot.gross));
  await send(app.market.connect(app.buyer).book(...slot.args));
  await app.advance(7201);
  await send(app.market.connect(app.buyer).release(slot.id));
  const fee = await app.market.credits(app.fee.address, asset), host = await app.market.credits(app.host.address, asset);
  assert.equal(fee, 30000n);
  assert.equal(fee + host, slot.gross);
  await send(app.usdc.setFail(true));
  await rejects(() => app.market.withdraw(asset, app.host.address));
  assert.equal(await app.market.credits(app.host.address, asset), host);
  await send(app.usdc.setFail(false));
  await send(app.market.withdraw(asset, app.outsider.address, { gasLimit: 200000 }));
  assert.equal(await app.usdc.balanceOf(app.outsider.address), host);
});
test('escrow: unsupported/taxed/false-return tokens and unexpected ETH cannot fund a booking', async t => {
  const app = await setup(t), asset = await app.usdc.getAddress();
  await rejects(() => app.market.createSlot(app.outsider.address, 1, app.start, app.end, false, 'terms'));
  const slot = await app.create(asset, 100n);
  await send(app.usdc.mint(app.buyer.address, 100n));
  await send(app.usdc.connect(app.buyer).approve(await app.market.getAddress(), 100n));
  await rejects(() => app.market.connect(app.buyer).book(...slot.args, { value: 1 }));
  await send(app.usdc.setFail(true));
  await rejects(() => app.market.connect(app.buyer).book(...slot.args));
  await send(app.usdc.setFail(false));
  await send(app.usdc.setTax(true));
  await rejects(() => app.market.connect(app.buyer).book(...slot.args, { gasLimit: 300000 }));
  assert.equal((await app.market.getSlot(slot.id)).state, 0n);
});
test('escrow: free sessions book and resolve without transfers or development fees', async t => {
  const app = await setup(t), slot = await app.create(ZeroAddress, 0n);
  await send(app.market.connect(app.buyer).book(...slot.args));
  await app.advance(7201);
  await send(app.market.connect(app.buyer).release(slot.id));
  assert.equal(await app.market.credits(app.host.address, ZeroAddress), 0n);
  assert.equal(await app.market.credits(app.fee.address, ZeroAddress), 0n);
});
test('escrow: withdrawn offers, expired slots and unknown IDs cannot be booked', async t => {
  const app = await setup(t), slot = await app.create();
  await rejects(() => app.market.connect(app.outsider).withdrawOffer(slot.id));
  await send(app.market.withdrawOffer(slot.id));
  await rejects(() => app.market.connect(app.buyer).book(...slot.args, { value: slot.gross }));
  const expired = await app.create();
  await app.advance(3601);
  await rejects(() => app.market.connect(app.buyer).book(...expired.args, { value: expired.gross }));
  await assert.rejects(app.market.getSlot(9999));
});
test('escrow: rejected ETH destination preserves credit and may be retried elsewhere', async t => {
  const app = await setup(t), slot = await app.create();
  await send(app.market.connect(app.buyer).book(...slot.args, { value: slot.gross }));
  await app.advance(7201);
  await send(app.market.connect(app.buyer).release(slot.id));
  const reject = await app.deploy('Mocks.sol', 'RejectETH');
  await rejects(() => app.market.withdraw(ZeroAddress, reject.getAddress()));
  assert.equal(await app.market.credits(app.host.address, ZeroAddress), parseEther('0.97'));
  await send(app.market.withdraw(ZeroAddress, app.outsider.address));
  assert.equal(await app.market.credits(app.host.address, ZeroAddress), 0n);
});
test('escrow: withdrawal callbacks cannot reenter the withdrawal path', async t => {
  const app = await setup(t), slot = await app.create();
  await send(app.market.connect(app.buyer).book(...slot.args, { value: slot.gross }));
  await app.advance(7201);
  await send(app.market.connect(app.buyer).release(slot.id));
  const receiver = await app.deploy('Mocks.sol', 'ReenterETH');
  await send(receiver.configure(await app.market.getAddress()));
  await send(app.market.withdraw(ZeroAddress, await receiver.getAddress()));
  assert.equal(await receiver.reentered(), false);
  assert.equal(await app.market.credits(app.host.address, ZeroAddress), 0n);
  assert.equal(await app.market.credits(app.fee.address, ZeroAddress), parseEther('0.03'));
});

async function clientFixture(t) {
  const app = await setup(t, true);
  let session = { address: app.host.address, signer: app.host };
  const transactions = [];
  const config = { address: await app.market.getAddress(), runtimeCodeHash: keccak256(await app.provider.getCode(await app.market.getAddress())),
    feeRecipient: app.fee.address, writesEnabled: true };
  const options = { config, provider: app.provider, getSession: () => session, Contract, hashCode: keccak256,
    onTransaction: value => transactions.push(value) };
  return { ...app, config, options, transactions, client: createBookingClient(options),
    as(actor) { session = actor ? { address: actor.address, signer: actor } : null; } };
}
test('adapter: ETH offer ID zero, booking, post-end settlement and credit withdrawal use confirmed receipts', async t => {
  const app = await clientFixture(t);
  const id = await app.client.create({ host: app.host.address, asset: ZeroAddress, gross: parseEther('1'),
    start: app.start, end: app.end, hardline: true, metadata: 'Learn together' });
  assert.equal(id, 0n);
  app.as(app.buyer);
  await app.client.book(await app.client.read(id));
  assert.equal((await app.client.read(id)).state, 1);
  await assert.rejects(app.client.release(id), /not available/);
  await app.advance(7201);
  await app.client.release(id);
  app.as(app.host);
  assert.equal((await app.client.credits())[0].amount, parseEther('0.97'));
  await app.client.withdraw(ZeroAddress, app.outsider.address);
  assert.equal((await app.client.credits())[0].amount, 0n);
  assert.equal(app.transactions.filter(value => value.phase === 'confirmed').length, 4);
});
test('adapter: USDC approval is exact and separate, stale terms reject, refund and withdrawal reconcile', async t => {
  const app = await clientFixture(t), slot = await app.create(ASSETS[1].address, 1515000n);
  await send(app.usdc.mint(app.buyer.address, slot.gross));
  app.as(app.buyer);
  const expected = await app.client.read(slot.id);
  await assert.rejects(app.client.book(expected), /Approve the exact/);
  await app.client.approve(slot.id);
  assert.equal(await app.client.allowance(expected), slot.gross);
  assert.equal((await app.client.read(slot.id)).state, 0);
  await assert.rejects(app.client.book({ ...expected, gross: 1n }), /displayed agreement changed/);
  await app.client.book(expected);
  await app.client.refund(slot.id);
  assert.equal((await app.client.credits())[1].amount, slot.gross);
  await app.client.withdraw(ASSETS[1].address, app.buyer.address);
  assert.equal(await app.usdc.balanceOf(app.buyer.address), slot.gross);
});
test('adapter: wrong bytecode, fee recipient, RPC network, missing ID and changed wallet fail explicitly', async t => {
  const app = await clientFixture(t), slot = await app.create();
  for (const config of [{ runtimeCodeHash: `0x${'0'.repeat(64)}` }, { feeRecipient: app.outsider.address }]) {
    const client = createBookingClient({ ...app.options, config: { ...app.config, ...config } });
    await assert.rejects(client.read(slot.id), /bytecode|policy/);
  }
  const wrongChain = createBookingClient({ ...app.options, provider: { send: async () => '0xa' } });
  await assert.rejects(wrongChain.read(slot.id), /must be on Base/);
  await assert.rejects(app.client.read(999999), /Unknown slot/);
  app.as(null);
  await assert.rejects(app.client.refund(slot.id), /Wallet session changed/);
  assert.equal(app.transactions.length, 0);
});
test('escrow: exact start/end and seven-day refund boundaries are enforced by the EVM', async t => {
  const app = await setup(t), a = await app.create(), b = await app.create(), c = await app.create();
  for (const slot of [a, b, c]) await send(app.market.connect(app.buyer).book(...slot.args, { value: slot.gross }));
  const at = async timestamp => {
    await app.rpc.request({ method: 'evm_setNextBlockTimestamp', params: [Number(timestamp)] });
    await app.rpc.request({ method: 'evm_mine', params: [] });
  };
  const call = (method, slot) => app.market.connect(app.buyer)[method].staticCall(slot.id);
  await at(app.start - 1n);
  await call('refund', a);
  await at(app.start);
  await assert.rejects(call('refund', a));
  await at(app.end - 1n);
  await assert.rejects(call('release', b));
  await at(app.end);
  await call('release', b);
  await at(app.end + 604799n);
  await assert.rejects(call('refund', c));
  await at(app.end + 604800n);
  await call('refund', c);
});
test('deployment: runtime verification permits immutable addresses but rejects altered executable code', async t => {
  const app = await setup(t);
  const code = await app.provider.getCode(await app.market.getAddress());
  assert.equal(matchesRuntime(code, compiled.artifact), true);
  assert.equal(matchesRuntime(`0x00${code.slice(4)}`, compiled.artifact), false);
  assert.equal(matchesRuntime('0x', compiled.artifact), false);
});
test('adapter: wallet switch during validation prevents submission; RPC outage is not an empty booking', async t => {
  const app = await clientFixture(t), slot = await app.create();
  const provider = new Proxy(app.provider, { get(target, key) {
    if (key === 'getCode') return async address => { app.as(app.outsider); return target.getCode(address); };
    const value = Reflect.get(target, key);
    return typeof value === 'function' ? value.bind(target) : value;
  } });
  const client = createBookingClient({ ...app.options, provider });
  await assert.rejects(client.withdrawOffer(slot.id), /Wallet session changed|not available/);
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
  const first = client.withdrawOffer(slot.id);
  await started;
  await assert.rejects(client.withdrawOffer(slot.id), /Another booking transaction is pending/);
  release();
  await first;
  assert.equal((await client.read(slot.id)).state, 4);
  assert.equal(app.transactions.filter(value => value.phase === 'submitted').length, 1);
});
test('escrow: custody equals unresolved escrow plus all withdrawal credits across mixed resolutions', async t => {
  const app = await setup(t), asset = await app.usdc.getAddress();
  const amounts = [0n, 1n, 33n, 9999n, 1000001n, 1515000n];
  const slots = [];
  for (const gross of amounts) {
    const slot = await app.create(asset, gross);
    slots.push(slot);
    await send(app.usdc.mint(app.buyer.address, gross));
    await send(app.usdc.connect(app.buyer).approve(await app.market.getAddress(), gross));
    await send(app.market.connect(app.buyer).book(...slot.args));
  }
  await send(app.market.refund(slots[1].id));
  await app.advance(7201);
  for (const slot of [slots[0], slots[2], slots[4]]) await send(app.market.connect(app.buyer).release(slot.id));
  const custody = async () => {
    const credits = await Promise.all([app.host, app.buyer, app.fee].map(actor => app.market.credits(actor.address, asset)));
    let unresolved = 0n;
    for (const { id } of slots) {
      const slot = await app.market.getSlot(id);
      if (slot.state === 1n) unresolved += slot.gross;
    }
    assert.equal(await app.usdc.balanceOf(await app.market.getAddress()), unresolved + credits.reduce((sum, amount) => sum + amount, 0n));
  };
  await custody();
  await send(app.market.withdraw(asset, app.host.address));
  await custody();
  await app.advance(604800);
  for (const slot of [slots[3], slots[5]]) await send(app.market.connect(app.buyer).refund(slot.id));
  await custody();
  await send(app.market.connect(app.buyer).withdraw(asset, app.buyer.address));
  await send(app.market.connect(app.fee).withdraw(asset, app.fee.address));
  await custody();
  assert.equal(await app.usdc.balanceOf(await app.market.getAddress()), 0n);
});
