import test from 'node:test';
import assert from 'node:assert/strict';
import { network } from 'hardhat';
import { BrowserProvider, JsonRpcSigner, Contract, ContractFactory, keccak256, toBeHex, id } from 'ethers';
import { compileBooking } from '../scripts/compile-booking.mjs';
import { createBookingClient } from '../decent-calendar-vanilla/js/booking-client.js';
import { ASSETS } from '../decent-calendar-vanilla/js/assets.js';

test('Base fork: real canonical USDC approve, group timebox escrow, host refund, split settlement, fee and withdrawals', { timeout: 180000 }, async t => {
  // All signing uses synthetic/impersonated accounts on the in-process fork, never the upstream RPC.
  const connection = await network.connect('baseFork'), rpc = connection.provider;
  t.after(() => connection.close());
  const provider = new BrowserProvider(rpc);
  t.after(() => provider.destroy());
  provider.pollingInterval = 10;
  const [host, buyer, fee, second] = await Promise.all([0, 1, 2, 3].map(index => provider.getSigner(index)));
  const token = new Contract(ASSETS[1].address, [
    'function balanceOf(address) view returns(uint256)', 'function decimals() view returns(uint8)',
    'function transfer(address,uint256) returns(bool)',
  ], provider);
  assert.equal(await token.decimals(), 6n);
  const latest = await rpc.request({ method: 'eth_blockNumber', params: [] });
  t.diagnostic(`Base fork block ${BigInt(latest)}; canonical USDC ${ASSETS[1].address}; OP Isthmus simulation, not production gas or signaling acceptance.`);
  const logs = await rpc.request({ method: 'eth_getLogs', params: [{
    address: ASSETS[1].address, topics: [id('Transfer(address,address,uint256)')],
    fromBlock: toBeHex(BigInt(latest) - 2n), toBlock: latest,
  }] });
  let holder;
  for (const address of [...new Set(logs.map(log => `0x${log.topics[2].slice(-40)}`))].slice(0, 100)) {
    if (await token.balanceOf(address) >= 4545000n) { holder = address; break; }
  }
  assert.ok(holder, 'No funded public USDC recipient found in the last three fork blocks; retry at a later block.');
  await rpc.request({ method: 'hardhat_impersonateAccount', params: [holder] });
  await rpc.request({ method: 'hardhat_setBalance', params: [holder, toBeHex(10n ** 18n)] });
  const holderSigner = new JsonRpcSigner(provider, holder);
  await (await token.connect(holderSigner).transfer(buyer.address, 3030000n)).wait();
  await (await token.connect(holderSigner).transfer(second.address, 1515000n)).wait();
  await rpc.request({ method: 'hardhat_stopImpersonatingAccount', params: [holder] });
  const { artifact } = await compileBooking();
  const market = await new ContractFactory(artifact.abi, artifact.evm.bytecode.object, host).deploy(fee.address, host.address, [ASSETS[1].address]);
  await market.waitForDeployment();
  let signer = host;
  const client = createBookingClient({
    config: { address: await market.getAddress(), runtimeCodeHash: keccak256(await provider.getCode(await market.getAddress())),
      feeRecipient: fee.address, writesEnabled: true },
    provider, Contract, hashCode: keccak256, getSession: () => ({ address: signer.address, signer }),
  });
  const block = await rpc.request({ method: 'eth_getBlockByNumber', params: ['latest', false] });
  const start = BigInt(block.timestamp) + 3600n;
  const offer = { host: host.address, asset: ASSETS[1].address, pricing: 0, price: 1515000n, start, end: start + 3600n,
    minAttendees: 1, maxAttendees: 1, hardline: true, subject: 'Public fork acceptance', timezone: 'America/Denver' };
  const refund = await client.create(offer);
  const settle = await client.create({ ...offer, pricing: 1, price: 3030000n, start: offer.end, end: offer.end + 3600n, minAttendees: 2, maxAttendees: 2 });
  signer = buyer;
  for (const booking of [refund, settle]) {
    await client.approve(booking);
    await client.join(await client.read(booking), 'Asia/Tokyo');
  }
  signer = second;
  await client.approve(settle);
  await client.join(await client.read(settle), 'Europe/Lisbon');
  signer = host;
  await client.refund(refund, buyer.address);
  signer = buyer;
  await client.withdraw(ASSETS[1].address, buyer.address);
  await rpc.request({ method: 'evm_setNextBlockTimestamp', params: [Number(offer.end + 3600n)] });
  await rpc.request({ method: 'evm_mine', params: [] });
  await client.release(settle);
  signer = second;
  await client.release(settle);
  signer = host;
  assert.equal((await client.credits())[1].amount, 2939100n);
  await client.withdraw(ASSETS[1].address, host.address);
  signer = fee;
  assert.equal((await client.credits())[1].amount, 90900n);
  await client.withdraw(ASSETS[1].address, fee.address);
  assert.equal(await token.balanceOf(await market.getAddress()), 0n);
});
