import test from 'node:test';
import assert from 'node:assert/strict';
import { keccak256 } from 'ethers';
import { createBookingRewardReader } from '../decent-calendar-vanilla/js/booking-rewards.js';
const vault='0x'+'11'.repeat(20),registry='0x'+'33'.repeat(20),wallet='0x'+'22'.repeat(20),other='0x'+'44'.repeat(20);
function setup() {
  const config={enabled:true,address:vault,runtimeCodeHash:keccak256('0x6000'),registry,nft:'0xe63EC9f8228720bAAC2fD528C0A6d06B3Dc5439B',tokenId:'77'};
  const reward={
    VERSION:async()=> 'dcal-first-booking-rewards-1',LIMIT:async()=>10n,appointments:async()=>registry,
    nft:async()=>config.nft,tokenId:async()=>77n,enabled:async()=>true,startAppointmentId:async()=>1n,
    awarded:async()=>0n,rewardedAppointment:async()=>0n,eligible:async()=>wallet,
  };
  const appointments={getAppointment:async()=>({offerId:1n,cancelled:false}),getOffer:async()=>[{invitee:wallet,host:other}]};
  const options={config,appointmentsConfig:{address:registry,runtimeCodeHash:keccak256('0x6001')},
    provider:{send:async method=>method==='eth_chainId'?'0x2105':{number:'0x123'},getCode:async address=>address===vault?'0x6000':'0x6001'},
    Contract:class {constructor(address){return address===vault?reward:appointments;}},hashCode:keccak256};
  return {reward,appointments,options,reader:createBookingRewardReader(options)};
}
test('hidden promotion is inert; verified eligibility is pending, never a claimed transfer',async()=>{
  const f=setup();
  assert.deepEqual(await createBookingRewardReader({...f.options,config:{enabled:false}}).read(1,wallet),{state:'disabled'});
  assert.equal((await f.reader.read(1,wallet)).state,'pending');
  f.reward.rewardedAppointment=async()=>1n;
  const received=await f.reader.read(1,wallet);
  assert.equal(received.state,'received');assert.equal(received.appointmentId,'1');assert.equal(received.block,291);
});
test('other wallets, cancellation, preactivation and exhaustion cannot unlock a new celebration',async()=>{
  const unrelated=setup();unrelated.appointments.getOffer=async()=>[{invitee:other}];
  assert.equal((await unrelated.reader.read(1,wallet)).state,'unrelated');
  for(const change of [
    f=>{f.appointments.getAppointment=async()=>({offerId:1n,cancelled:true});},
    f=>{f.reward.startAppointmentId=async()=>2n;},
    f=>{f.reward.awarded=async()=>10n;},
    f=>{f.reward.enabled=async()=>false;},
  ]){
    const f=setup();change(f);
    assert.equal((await f.reader.read(1,wallet)).state,'ineligible');
  }
});
test('network, constructor bindings, registry/reward runtime and RPC failures remain explicit',async()=>{
  for(const [change,expected] of [
    [f=>{f.options.provider.send=async()=> '0x1';},/require Base/],
    [f=>{f.reward.LIMIT=async()=>100n;},/policy differs/],
    [f=>{f.options.provider.getCode=async()=> '0x6002';},/bytecode differs/],
    [f=>{f.options.provider.getCode=async address=>address===vault?'0x6000':'0x6002';},/registry differs/],
    [f=>{f.options.provider.send=async()=>{throw new Error('RPC unavailable');};},/RPC unavailable/],
    [f=>{f.reward.eligible=async()=>other;},/recipient does not match/],
  ]){
    const f=setup();change(f);
    await assert.rejects(f.reader.read(1,wallet),expected);
  }
});
