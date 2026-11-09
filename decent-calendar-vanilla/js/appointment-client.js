import { bookingId, confirmedBookingReceipt } from './booking-client.js';
import { inviteAddress } from './invitations.js';
import { APPOINTMENT_VERSION, validateAvailability, availableChoices } from './appointments.js';

const OFFER = 'tuple(address host,address invitee,uint32 duration,bool closed,string subject,string timezone)';
const WINDOWS = 'tuple(uint64 start,uint64 end,uint32 day)[]';
const ITEM = 'tuple(uint256 offerId,uint256 windowIndex,uint64 start,uint64 end,bool cancelled)';
export const APPOINTMENT_ABI = [
  'function VERSION() view returns (string)', 'function MAX_WINDOWS() view returns (uint256)',
  `function getOffer(uint256) view returns (${OFFER},${WINDOWS})`,
  `function getAppointment(uint256) view returns (${ITEM})`,
  'function offerCount(address) view returns (uint256)', 'function offerAt(address,uint256) view returns (uint256)',
  'function appointmentCount(address) view returns (uint256)', 'function appointmentAt(address,uint256) view returns (uint256)',
  'function dayBooking(uint256,uint32) view returns (uint256)',
  'function findPrev(address,uint64,uint64) view returns (uint256)',
  `function publish(address,uint32,string,string,${WINDOWS}) returns (uint256)`,
  'function book(uint256,uint256,uint64,uint256,uint256) returns (uint256)',
  'function close(uint256)', 'function cancel(uint256)',
  'event AvailabilityPublished(uint256 indexed id,address indexed host,address indexed invitee)',
  'event AppointmentBooked(uint256 indexed id,uint256 indexed offerId,uint64 start,uint64 end)',
];
const same = (a, b) => String(a).toLowerCase() === String(b).toLowerCase();
export function createAppointmentClient({ config, legacyConfig, provider, getSession, Contract, hashCode, storage, onTransaction = () => {} }) {
  config = Object.freeze({ ...config });
  let busy = false;
  let unrecordedPending = null;
  const pendingKey = wallet => `dcal:appointment-pending:8453:${config.address}:${inviteAddress(wallet)}`;
  const pending = wallet => storage?.getItem(pendingKey(wallet)) || null;
  async function registry() {
    if (!config.address || !config.runtimeCodeHash) throw new Error('Free appointment registry is not deployed and pinned.');
    inviteAddress(config.address);
    if (!/^0x[0-9a-f]{64}$/i.test(config.runtimeCodeHash || '')) throw new Error('Free appointment registry is not deployed and pinned.');
    if (BigInt(await provider.send('eth_chainId', [])) !== 8453n) throw new Error('Appointments require Base (8453).');
    const code = await provider.getCode(config.address);
    if (code === '0x' || !same(hashCode(code), config.runtimeCodeHash)) throw new Error('Appointment bytecode differs from the reviewed deployment.');
    const contract = new Contract(config.address, APPOINTMENT_ABI, provider);
    if (await contract.VERSION() !== APPOINTMENT_VERSION || await contract.MAX_WINDOWS() !== 62n) throw new Error('Unexpected appointment registry policy.');
    return contract;
  }
  async function block() {
    const value = await provider.send('eth_getBlockByNumber', ['latest', false]);
    if (!value) throw new Error('Latest Base block unavailable. Availability is not known.');
    return { blockTag: value.number, now: BigInt(value.timestamp) };
  }
  async function offerAt(contract, id, context) {
    id = bookingId(id);
    const [value, windows] = await contract.getOffer(id, { blockTag: context.blockTag });
    const offer = validateAvailability({ id, host: value.host, invitee: value.invitee, duration: Number(value.duration),
      closed: value.closed, subject: value.subject, timezone: value.timezone, now: context.now,
      windows: windows.map(w => ({ start:w.start, end:w.end, day:Number(w.day) })) });
    const days = [...new Set(offer.windows.map(w => w.day))];
    const booked = await Promise.all(days.map(day => contract.dayBooking(id, day, { blockTag: context.blockTag })));
    return { ...offer, bookedDays: new Set(days.filter((_day, index) => booked[index] !== 0n)) };
  }
  async function appointmentAt(contract, id, context, offers = new Map()) {
    id = bookingId(id);
    const item = await contract.getAppointment(id, { blockTag: context.blockTag });
    let offer = offers.get(item.offerId.toString());
    if (!offer) { offer = await offerAt(contract, item.offerId, context); offers.set(offer.id.toString(), offer); }
    return { id, offerId:item.offerId, windowIndex:Number(item.windowIndex), start:item.start, end:item.end,
      cancelled:item.cancelled, host:offer.host, invitee:offer.invitee, subject:offer.subject, timezone:offer.timezone, now:context.now };
  }
  async function wallet(expected) {
    const session = getSession();
    if (!session?.signer || !session.address || expected && (session.signer !== expected.signer || !same(session.address, expected.address))) {
      throw new Error('Wallet session changed. Reopen availability before signing.');
    }
    if (!same(await session.signer.getAddress(), session.address) ||
        BigInt(await session.signer.provider.send('eth_chainId', [])) !== 8453n ||
        getSession()?.signer !== session.signer || !same(getSession()?.address, session.address)) {
      throw new Error('Connect the intended wallet on Base; no new transaction was requested.');
    }
    return session;
  }
  async function transact(operation) {
    if (busy) throw new Error('An appointment transaction is pending.');
    if (config.writesEnabled !== true || !storage) throw new Error('Appointment writes are disabled until deployment and review; durable local transaction recovery is required.');
    busy = true;
    try {
      const session = await wallet();
      if (unrecordedPending) throw new Error(`Transaction ${unrecordedPending} was submitted without local recovery storage. Reconcile it on Base before reopening this page; do not resend.`);
      if (pending(session.address)) throw new Error(`Reconcile pending transaction ${pending(session.address)} before signing again.`);
      const contract = await registry();
      const submit = async (method, args) => {
        await wallet(session);
        if (pending(session.address)) throw new Error(`Another tab submitted ${pending(session.address)}. Reconcile it before signing.`);
        const probeKey = `${pendingKey(session.address)}:storage-check`;
        storage.setItem(probeKey, 'ready');
        storage.removeItem(probeKey);
        const tx = await contract.connect(session.signer)[method](...args);
        const record = event => {
          if (event.phase !== 'confirmed') {
            try { storage.setItem(pendingKey(session.address), event.hash); }
            catch (error) {
              unrecordedPending = event.hash;
              onTransaction(event);
              throw new Error(`Transaction ${event.hash} was submitted, but local recovery storage failed: ${error.message}. Save the hash; do not resend.`);
            }
          }
          onTransaction(event);
        };
        record({ hash:tx.hash, phase:'submitted' });
        const receipt = await confirmedBookingReceipt(tx, record);
        storage.removeItem(pendingKey(session.address));
        await wallet(session);
        return receipt;
      };
      return await operation(contract, session, submit);
    } finally { busy = false; }
  }
  function eventId(contract, receipt, name) {
    const events = receipt.logs.filter(log => same(log.address, config.address)).map(log => {
      try { return contract.interface.parseLog(log); } catch { return null; }
    }).filter(event => event?.name === name);
    if (events.length !== 1) throw new Error(`Confirmed ${receipt.hash}, but its record ID could not be reconciled. Refresh wallet records, do not resend.`);
    return events[0].args.id;
  }
  async function legacyConflicts(addresses, start, end, context) {
    if (!legacyConfig?.address) return;
    if (!same(hashCode(await provider.getCode(legacyConfig.address)), legacyConfig.runtimeCodeHash)) throw new Error('Existing paid-booking registry could not be verified for conflict checks.');
    const legacy = new Contract(legacyConfig.address, ['function findPrev(address,uint64,uint64) view returns(uint256)'], provider);
    await Promise.all(addresses.map(address => legacy.findPrev(address, start, end, { blockTag:context.blockTag })));
  }
  return {
    pending,
    async recover() {
      const session = await wallet(), hash = pending(session.address);
      if (!hash) return 'No locally recorded pending appointment transaction.';
      const receipt = await provider.getTransactionReceipt(hash);
      await wallet(session);
      if (!receipt) return `Transaction ${hash} is still pending or unavailable. No resubmission was made.`;
      if (receipt.status !== 1 && receipt.status !== 0) throw new Error('Unexpected transaction receipt; keep the pending hash.');
      storage.removeItem(pendingKey(session.address));
      onTransaction({ hash, phase:receipt.status === 1 ? 'confirmed' : 'reverted' });
      return `Transaction ${receipt.status === 1 ? 'confirmed' : 'reverted'}; refresh chain records before any new action.`;
    },
    async readOffer(id) { return offerAt(await registry(), id, await block()); },
    async readAppointment(id) { return appointmentAt(await registry(), id, await block()); },
    async readWallet(address, limit = 20) {
      address = inviteAddress(address);
      if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error('Use a bounded wallet page of 1-100 records.');
      const contract = await registry(), context = await block();
      const [offerCount, appointmentCount] = await Promise.all([
        contract.offerCount(address, { blockTag:context.blockTag }), contract.appointmentCount(address, { blockTag:context.blockTag }),
      ]);
      const ids = async (count, method) => Promise.all(Array.from({ length:Number(count < BigInt(limit) ? count : BigInt(limit)) },
        (_value, index) => contract[method](address, count - 1n - BigInt(index), { blockTag:context.blockTag })));
      const [offerIds, appointmentIds] = await Promise.all([ids(offerCount, 'offerAt'), ids(appointmentCount, 'appointmentAt')]);
      const offers = await Promise.all(offerIds.map(id => offerAt(contract, id, context)));
      const cache = new Map(offers.map(offer => [offer.id.toString(), offer]));
      const appointments = await Promise.all(appointmentIds.map(id => appointmentAt(contract, id, context, cache)));
      return { offers, appointments, offerCount, appointmentCount, now:context.now };
    },
    async publish(offer) {
      validateAvailability(offer); inviteAddress(offer.invitee); inviteAddress(offer.host);
      if (!offer.subject?.trim() || new TextEncoder().encode(offer.subject).length > 200) throw new Error('Use a public subject of 1-200 UTF-8 bytes.');
      return transact(async (contract, session, submit) => {
        if (!same(offer.host, session.address)) throw new Error('Only the host who reviewed these windows can publish them.');
        if (same(offer.invitee, session.address)) throw new Error('Invite a different wallet.');
        return eventId(contract, await submit('publish', [offer.invitee, offer.duration, offer.subject, offer.timezone, offer.windows]), 'AvailabilityPublished');
      });
    },
    async book(id, windowIndex, start) {
      return transact(async (contract, session, submit) => {
        const context = await block(), offer = await offerAt(contract, id, context);
        if (!same(offer.invitee, session.address)) throw new Error('Only the invited wallet can book.');
        if (!availableChoices(offer, context.now, offer.bookedDays).some(choice => choice.windowIndex === windowIndex && choice.start === BigInt(start))) {
          throw new Error('That day or time is no longer available. Refresh before choosing again.');
        }
        const end = BigInt(start) + BigInt(offer.duration);
        await legacyConflicts([offer.host, offer.invitee], start, end, context);
        const hints = await Promise.all([offer.host, offer.invitee].map(address => contract.findPrev(address, start, end, { blockTag:context.blockTag })));
        return eventId(contract, await submit('book', [id, windowIndex, start, ...hints]), 'AppointmentBooked');
      });
    },
    async close(id) {
      return transact(async (contract, session, submit) => {
        const offer = await offerAt(contract, id, await block());
        if (!same(offer.host, session.address) || offer.closed) throw new Error('Only the host can close open availability.');
        return submit('close', [id]);
      });
    },
    async cancel(id) {
      return transact(async (contract, session, submit) => {
        const item = await appointmentAt(contract, id, await block());
        if (![item.host, item.invitee].some(address => same(address, session.address)) || item.cancelled || item.now >= item.start) throw new Error('Only a participant can cancel before the appointment starts.');
        return submit('cancel', [id]);
      });
    },
  };
}
