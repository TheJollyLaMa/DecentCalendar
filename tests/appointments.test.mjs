import test from 'node:test';
import assert from 'node:assert/strict';
import { network } from 'hardhat';
import { BrowserProvider, Contract, ContractFactory, keccak256 } from 'ethers';
import { compileAppointments } from '../scripts/prepare-appointments-deployment.mjs';
import { createAppointmentClient } from '../decent-calendar-vanilla/js/appointment-client.js';
const { artifact } = await compileAppointments();
const send = async promise => (await promise).wait();
async function setup(t) {
  const connection = await network.connect('local'); t.after(()=>connection.close());
  const provider = new BrowserProvider(connection.provider); provider.pollingInterval=10;
  const [host,guest,other,secondHost]=await Promise.all([0,1,2,3].map(id=>provider.getSigner(id)));
  const contract=await new ContractFactory(artifact.abi,artifact.evm.bytecode.object,host).deploy();
  await contract.waitForDeployment();
  const block=await provider.send('eth_getBlockByNumber',['latest',false]);
  const day=(BigInt(block.timestamp)/86400n+2n)*86400n;
  const key = value => Number(new Date(Number(value)*1000).toISOString().slice(0,10).replaceAll('-',''));
  const windows=[{start:day+7n*3600n,end:day+10n*3600n,day:key(day)},
    {start:day+15n*3600n,end:day+19n*3600n,day:key(day)},
    {start:day+86400n+7n*3600n,end:day+86400n+10n*3600n,day:key(day+86400n)}];
  const publish=async (signer=host,invitee=guest.address,subject='Check-in')=>{
    const id=await contract.nextOfferId(); await send(contract.connect(signer).publish(invitee,1800,subject,'UTC',windows)); return id;
  };
  const book=async (id,index=0,start=windows[index].start,signer=guest)=>{
    const [offer]=await contract.getOffer(id);
    const hints=await Promise.all([offer.host,offer.invitee].map(address=>contract.findPrev(address,start,start+1800n)));
    return send(contract.connect(signer).book(id,index,start,...hints));
  };
  const storage=new Map();
  const store={getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)};
  const config={address:await contract.getAddress(),runtimeCodeHash:keccak256(await provider.getCode(await contract.getAddress())),writesEnabled:true};
  const client=signer=>createAppointmentClient({config,provider,Contract,hashCode:keccak256,storage:store,getSession:()=>({address:signer.address,signer})});
  return {contract,provider,host,guest,other,secondHost,windows,publish,book,client,config,store,connection};
}
test('only invited wallet books a free grid slot; same day and stale concurrent attempts revert',async t=>{
  const f=await setup(t),id=await f.publish(),start=f.windows[0].start;
  await assert.rejects(f.book(id,0,start,f.other),/Not invited/);
  await assert.rejects(f.book(id,0,start,f.host),/Not invited/);
  await assert.rejects(f.book(id,0,start+1n),/Outside slot grid/);
  await assert.rejects(f.book(id,0,f.windows[0].end),/Outside slot grid/);
  await f.book(id);
  await assert.rejects(f.book(id,1),/Already booked this day/);
  await assert.rejects(send(f.contract.connect(f.guest).book(id,0,start,0,0)),/Already booked this day/);
  await f.book(id,2);
  assert.equal(await f.contract.appointmentCount(f.host.address),2n);
  assert.equal(await f.contract.appointmentCount(f.guest.address),2n);
  assert.equal(await f.provider.getBalance(f.config.address),0n);
});
test('both participant calendars reject overlaps across offers; adjacent slots and cancellation recover correctly',async t=>{
  const f=await setup(t),first=await f.publish();
  await f.book(first);
  const sameHost=await f.publish(f.host,f.other.address,'Other guest');
  await assert.rejects(f.book(sameHost,0,f.windows[0].start,f.other),/Appointment collision/);
  const sameGuest=await f.publish(f.secondHost,f.guest.address,'Other host');
  await assert.rejects(f.book(sameGuest),/Appointment collision/);
  await assert.rejects(send(f.contract.connect(f.other).book(sameHost,0,f.windows[0].start,0,0)),/Appointment collision/);
  await f.book(sameHost,0,f.windows[0].start+1800n,f.other);
  await assert.rejects(send(f.contract.connect(f.other).cancel(1)),/Not participant/);
  await send(f.contract.connect(f.guest).cancel(1));
  assert.equal(await f.contract.dayBooking(first,f.windows[0].day),0n);
  await f.book(first,1);
  assert.equal((await f.contract.getAppointment(1)).cancelled,true);
});
test('publication recovery, close semantics, bounds and unexpected funds are enforced on chain',async t=>{
  const f=await setup(t),id=await f.publish();
  await assert.rejects(f.publish(),/already published/);
  await assert.rejects(send(f.contract.publish(f.guest.address,1800,'Wrong windows','UTC',[f.windows[1],f.windows[0]])),/Unsorted windows/);
  await assert.rejects(send(f.contract.publish(f.guest.address,1800,'Cash','UTC',f.windows,{value:1n})));
  await f.book(id);
  await assert.rejects(send(f.contract.connect(f.guest).close(id)),/Not open host/);
  await send(f.contract.close(id));
  await assert.rejects(f.book(id,2),/closed/);
  assert.equal((await f.contract.getAppointment(1)).cancelled,false,'closing offer must not cancel an appointment');
  const now=Number(f.windows[0].start);
  await f.connection.provider.request({method:'evm_setNextBlockTimestamp',params:[now]});
  await f.connection.provider.request({method:'evm_mine',params:[]});
  await assert.rejects(send(f.contract.cancel(1)),/Not cancellable/);
});
test('real client recovers host/guest records in fresh instances and distinguishes confirmed, cancelled and disabled',async t=>{
  const f=await setup(t),host=f.client(f.host),guest=f.client(f.guest);
  const id=await host.publish({host:f.host.address,invitee:f.guest.address,duration:1800,subject:'Client test',timezone:'UTC',windows:f.windows});
  const publicOffer=await f.client(f.other).readOffer(id);
  assert.equal(publicOffer.host,f.host.address);
  await assert.rejects(f.client(f.other).book(id,0,f.windows[0].start),/Only the invited wallet/);
  const appointmentId=await guest.book(id,0,f.windows[0].start);
  const [hostState,guestState]=await Promise.all([f.client(f.host).readWallet(f.host.address),f.client(f.guest).readWallet(f.guest.address)]);
  assert.equal(hostState.appointments[0].id,appointmentId);
  assert.equal(guestState.appointments[0].id,appointmentId);
  assert.equal(hostState.appointments[0].cancelled,false);
  assert.ok(guestState.offers[0].bookedDays.has(f.windows[0].day));
  assert.equal(guest.pending(f.guest.address),null);
  await assert.rejects(guest.book(id,1,f.windows[1].start),/no longer available/);
  await host.cancel(appointmentId);
  assert.equal((await guest.readAppointment(appointmentId)).cancelled,true);
  assert.equal((await guest.readOffer(id)).bookedDays.size,0);
  const disabled=createAppointmentClient({config:{...f.config,writesEnabled:false}});
  await assert.rejects(disabled.book(id,0,f.windows[0].start),/writes are disabled/);
  const wrongCode=createAppointmentClient({config:{...f.config,runtimeCodeHash:'0x'+'00'.repeat(32)},provider:f.provider,Contract,hashCode:keccak256});
  await assert.rejects(wrongCode.readOffer(id),/bytecode differs/);
});
test('pending transaction recovery prevents resubmission and checks receipt without mutating records',async t=>{
  const f=await setup(t),client=f.client(f.guest),id=await f.publish();
  const key=`dcal:appointment-pending:8453:${f.config.address}:${f.guest.address.toLowerCase()}`;
  const unknown='0x'+'12'.repeat(32);
  f.store.setItem(key,unknown);
  await assert.rejects(client.book(id,0,f.windows[0].start),/Reconcile pending/);
  assert.match(await client.recover(),/still pending or unavailable/);
  assert.equal(f.store.getItem(key),unknown);
  const tx=await f.contract.connect(f.guest).book(id,0,f.windows[0].start,0,0);
  await tx.wait(); f.store.setItem(key,tx.hash);
  assert.match(await client.recover(),/confirmed/);
  assert.equal(f.store.getItem(key),null);
  assert.equal((await client.readWallet(f.guest.address)).appointments.length,1);
});
test('changed wallet session and failed storage cannot submit appointment transactions',async t=>{
  const f=await setup(t),id=await f.publish();
  let calls=0;
  const signer={getAddress:async()=>f.guest.address,provider:{send:async()=>{calls++;return '0x2105'}}};
  const changed=createAppointmentClient({config:f.config,provider:f.provider,Contract,hashCode:keccak256,storage:f.store,
    getSession:()=>({address:calls ? f.other.address : f.guest.address,signer})});
  await assert.rejects(changed.book(id,0,f.windows[0].start),/wallet.*Base|session changed/i);
  const badStorage={getItem:()=>null,setItem:()=>{throw Error('storage denied')},removeItem:()=>{}};
  const blocked=createAppointmentClient({config:f.config,provider:f.provider,Contract,hashCode:keccak256,storage:badStorage,
    getSession:()=>({address:f.guest.address,signer:f.guest})});
  await assert.rejects(blocked.book(id,0,f.windows[0].start),/storage denied/);
  assert.equal(await f.contract.appointmentCount(f.guest.address),0n);
});
