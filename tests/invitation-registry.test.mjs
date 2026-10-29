import test from 'node:test';
import assert from 'node:assert/strict';
import { network } from 'hardhat';
import { BrowserProvider, ContractFactory, ZeroAddress } from 'ethers';
import { compileInvitations } from '../scripts/compile-invitations.mjs';

test('public invitations authenticate host, paginate, revise, withdraw and never reserve a seat', async t => {
  const build = await compileInvitations();
  const connection = await network.connect('local'); t.after(() => connection.close());
  const provider = new BrowserProvider(connection.provider); provider.pollingInterval = 10; t.after(() => provider.destroy());
  const [host, recipient, other] = await Promise.all([0, 1, 2].map(i => provider.getSigner(i)));
  const bookingArtifact = build.contracts['DCalBooking.sol'].DCalBooking;
  const booking = await new ContractFactory(bookingArtifact.abi, bookingArtifact.evm.bytecode.object, host).deploy(host.address, host.address, []);
  await booking.waitForDeployment();
  const registry = await new ContractFactory(build.artifact.abi, build.artifact.evm.bytecode.object, host).deploy(await booking.getAddress());
  await registry.waitForDeployment();
  const now = BigInt((await provider.getBlock('latest')).timestamp);
  const offer = { asset: ZeroAddress, pricing: 0, price: 0, start: now + 3600n, end: now + 7200n, minAttendees: 1, maxAttendees: 2, hardline: false, subject: 'Office hours', timezone: 'UTC' };
  await (await booking.createSlot(offer, 0)).wait();
  await assert.rejects(registry.connect(other).invite.staticCall(1, recipient.address, 0), /Not timebox host/);
  await assert.rejects(registry.invite.staticCall(1, ZeroAddress, 0), /Invalid recipient/);
  await assert.rejects(registry.invite.staticCall(1, host.address, 0), /Invalid recipient/);
  await assert.rejects(registry.invite.staticCall(1, recipient.address, 3), /Invalid preference/);
  await (await registry.invite(1, recipient.address, 2)).wait();
  assert.equal(await registry.inboxCount(recipient.address), 1n);
  let page = await registry.inbox(recipient.address, 0, 50);
  const key = page[0][0];
  assert.equal(page[1][0].host, host.address);
  assert.equal(page[1][0].preference, 2n);
  assert.equal(page[1][0].revision, 1n);
  assert.equal((await booking.getSlot(1)).attendees, 0n);
  // Even the strongest preference leaves non-invitees free to join.
  await (await booking.connect(other).join(1, ZeroAddress, 0, 'UTC')).wait();
  assert.equal((await booking.getSlot(1)).attendees, 1n);
  await (await registry.invite(1, recipient.address, 1)).wait();
  assert.equal(await registry.inboxCount(recipient.address), 1n);
  assert.equal((await registry.getInvitation(key)).revision, 2n);
  await assert.rejects(registry.connect(recipient).withdrawInvitation.staticCall(key), /Not active host/);
  await (await registry.withdrawInvitation(key)).wait();
  assert.equal((await registry.getInvitation(key)).active, false);
  await (await registry.invite(1, recipient.address, 0)).wait();
  assert.equal((await registry.getInvitation(key)).revision, 4n);
  assert.equal((await registry.inbox(recipient.address, 1, 50))[0].length, 0);
  await assert.rejects(registry.inbox(recipient.address, 0, 51), /Page size/);
  await assert.rejects(registry.inbox(recipient.address, 0, 0), /Page size/);
  for (let id = 2; id <= 3; id++) {
    const start = now + BigInt(id) * 7200n, end = start + 3600n;
    await (await booking.createSlot({ ...offer, start, end }, await booking.findPrev(host.address, start, end))).wait();
    await (await registry.invite(id, recipient.address, 0)).wait();
  }
  page = await registry.inbox(recipient.address, 0, 2);
  assert.deepEqual(page[1].map(item => item.slotId), [3n, 2n]);
  assert.equal((await registry.inbox(recipient.address, 2, 2))[1][0].slotId, 1n);
  await (await booking.cancel(1)).wait();
  await assert.rejects(registry.invite.staticCall(1, recipient.address, 0), /not accepting/);
  await connection.provider.request({ method: 'evm_setNextBlockTimestamp', params: [Number(now + 14400n)] });
  await connection.provider.request({ method: 'evm_mine', params: [] });
  await assert.rejects(registry.invite.staticCall(2, recipient.address, 0), /not accepting/);
});
