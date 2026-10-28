import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import solc from 'solc';
import { network } from 'hardhat';
import { BrowserProvider, ContractFactory, ZeroAddress, parseEther } from 'ethers';

const source = await readFile(new URL('../contracts/DCalBooking.sol', import.meta.url), 'utf8');
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
const compiled = JSON.parse(solc.compile(JSON.stringify({
  language: 'Solidity', sources: { 'DCalBooking.sol': { content: source }, 'Mocks.sol': { content: mocks } },
  settings: { evmVersion: 'shanghai', optimizer: { enabled: true, runs: 200 }, outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } } },
})));
assert.deepEqual((compiled.errors || []).filter(error => error.severity === 'error'), []);

async function setup(t) {
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
  const usdc = await deploy('Mocks.sol', 'MockUSDC');
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
  return { rpc, market, usdc, host, buyer, fee, outsider, create, advance, start, end, deploy };
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
