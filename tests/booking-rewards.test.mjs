import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { network } from 'hardhat';
import { BrowserProvider, ContractFactory } from 'ethers';
import { compileBookingRewards } from '../scripts/prepare-booking-rewards.mjs';
const sources = {};
for (const name of ['DCalAppointments.sol', 'test/RewardNFT.sol']) {
  sources[name] = {content:await readFile(new URL(`../contracts/${name}`, import.meta.url), 'utf8')};
}
const { contracts, artifact } = await compileBookingRewards(sources);
const send = async promise => (await promise).wait();
async function setup(t) {
  const connection = await network.connect('local'); t.after(()=>connection.close());
  const provider = new BrowserProvider(connection.provider, undefined, {cacheTimeout:-1}); provider.pollingInterval=10;
  const signers = await Promise.all(Array.from({length:16},(_,i)=>provider.getSigner(i)));
  const deploy = async (a,args=[]) => {
    const contract = await new ContractFactory(a.abi,a.evm.bytecode.object,signers[0]).deploy(...args);
    await contract.waitForDeployment(); return contract;
  };
  const registry = await deploy(contracts['DCalAppointments.sol'].DCalAppointments);
  const nft = await deploy(contracts['test/RewardNFT.sol'].RewardNFT);
  const rewards = await deploy(artifact,[await registry.getAddress(),await nft.getAddress(),77]);
  const latest = await provider.send('eth_getBlockByNumber',['latest',false]);
  const start = BigInt(latest.timestamp)+86400n;
  const book = async (guest,offset=0n) => {
    const offerId=await registry.nextOfferId(),id=await registry.nextAppointmentId(),time=start+offset*3600n;
    await send(registry.publish(guest.address,900,`Promo ${offerId}`,'UTC',[{start:time,end:time+1800n,day:20261109}]));
    const hostPrev=await registry.findPrev(signers[0].address,time,time+900n);
    const guestPrev=await registry.findPrev(guest.address,time,time+900n);
    await send(registry.connect(guest).book(offerId,0,time,hostPrev,guestPrev));
    return id;
  };
  return {provider,registry,nft,rewards,signers,book,deploy,start};
}
test('activation requires all ten copies; old bookings, wrong stock and unauthorized controls fail',async t=>{
  const f=await setup(t),[owner,guest,other]=f.signers;
  const old=await f.book(guest);
  await assert.rejects(send(f.rewards.activate()),/Fund all ten/);
  await assert.rejects(send(f.nft.mint(await f.rewards.getAddress(),78,10)),/Wrong reward stock/);
  await send(f.nft.mint(await f.rewards.getAddress(),77,10));
  await assert.rejects(send(f.rewards.connect(other).activate()),/Not promotion owner/);
  await send(f.rewards.activate());
  assert.equal(await f.rewards.eligible(old),'0x'+'0'.repeat(40));
  await assert.rejects(send(f.rewards.activate()),/already activated/);
  await assert.rejects(send(f.rewards.returnStock(owner.address,1)),/Disable promotion/);
});
test('any gas payer rewards only the booked guest, once per wallet; cancellations do not claw back',async t=>{
  const f=await setup(t),[owner,guest,payer]=f.signers;
  await send(f.nft.mint(await f.rewards.getAddress(),77,10)); await send(f.rewards.activate());
  const id=await f.book(guest);
  assert.equal(await f.rewards.eligible(id),guest.address);
  const receipt=await send(f.rewards.connect(payer).award(id));
  assert.ok(receipt.logs.some(log=>{try{return f.rewards.interface.parseLog(log)?.name==='BookingRewarded';}catch{return false;}}));
  assert.equal(await f.nft.balanceOf(guest.address,77),1n);
  assert.equal(await f.nft.balanceOf(owner.address,77),0n);
  await assert.rejects(send(f.rewards.award(id)),/not reward eligible/);
  await send(f.registry.connect(guest).cancel(id));
  assert.equal(await f.nft.balanceOf(guest.address,77),1n);
  const next=await f.book(guest,1n);
  await assert.rejects(send(f.rewards.award(next)),/not reward eligible/);
});
test('cancelled records, paused promotion and exhausted pool never transfer rewards',async t=>{
  const f=await setup(t);
  await send(f.nft.mint(await f.rewards.getAddress(),77,10)); await send(f.rewards.activate());
  const cancelled=await f.book(f.signers[1]); await send(f.registry.cancel(cancelled));
  await assert.rejects(send(f.rewards.award(cancelled)),/not reward eligible/);
  const paused=await f.book(f.signers[2],1n);
  await send(f.rewards.setEnabled(false));
  await assert.rejects(send(f.rewards.award(paused)),/not reward eligible/);
  await send(f.rewards.setEnabled(true));
  for(let i=2;i<12;i++){
    const id=i===2?paused:await f.book(f.signers[i],BigInt(i));
    await send(f.rewards.award(id));
  }
  assert.equal(await f.rewards.awarded(),10n);
  assert.equal(await f.nft.balanceOf(await f.rewards.getAddress(),77),0n);
  await assert.rejects(send(f.rewards.award(await f.book(f.signers[12],12n))),/not reward eligible/);
});
test('receiver reentrancy cannot duplicate gifts; rejection leaves booking and reward accounting intact',async t=>{
  const f=await setup(t),guest=await f.deploy(contracts['test/RewardNFT.sol'].RewardGuest);
  await send(f.nft.mint(await f.rewards.getAddress(),77,10)); await send(f.rewards.activate());
  await send(f.registry.publish(await guest.getAddress(),900,'Contract guest','UTC',[{start:f.start,end:f.start+1800n,day:20261109}]));
  await send(guest.book(await f.registry.getAddress(),1,f.start));
  await send(guest.configure(await f.rewards.getAddress(),1,true));
  await assert.rejects(send(f.rewards.award(1)),/Guest rejects/);
  assert.equal(await f.rewards.awarded(),0n);
  assert.equal((await f.registry.getAppointment(1)).cancelled,false);
  await send(guest.configure(await f.rewards.getAddress(),1,false));
  await send(f.rewards.award(1));
  assert.equal(await guest.reentered(),false);
  assert.equal(await f.rewards.awarded(),1n);
});
