import { ASSETS, slotQuote } from './assets.js';
import { validTimeZone } from './timezones.js';

export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
export const BOOKING_VERSION = 'dcal-timebox-1';
export const PRICING = Object.freeze(['per-head', 'split']);
export const SEAT_STATES = Object.freeze(['None', 'Funded', 'Released', 'Refunded']);
const SLOT = 'tuple(address host,address asset,uint8 pricing,uint256 price,uint64 start,uint64 end,uint16 minAttendees,uint16 maxAttendees,uint16 attendees,bool hardline,uint8 state,string subject,string hostTimezone)';
const OFFER = 'tuple(address asset,uint8 pricing,uint256 price,uint64 start,uint64 end,uint16 minAttendees,uint16 maxAttendees,bool hardline,string subject,string timezone)';
export const BOOKING_ABI = [
  'function VERSION() view returns (string)',
  'function FEE_BPS() view returns (uint256)',
  'function REFUND_DELAY() view returns (uint256)',
  'function MAX_ATTENDEES() view returns (uint16)',
  'function feeRecipient() view returns (address)',
  'function owner() view returns (address)',
  'function allowedToken(address) view returns (bool)',
  'function nextId() view returns (uint256)',
  `function getSlot(uint256) view returns (${SLOT})`,
  'function getSeat(uint256,address) view returns (tuple(uint8 state,uint256 deposit,string timezone))',
  'function rosterOf(uint256) view returns (address[])',
  'function depositFor(uint256) view returns (uint256)',
  'function chargeFor(uint256) view returns (uint256)',
  'function findPrev(address,uint64,uint64) view returns (uint256)',
  'function credits(address,address) view returns (uint256)',
  `function createSlot(${OFFER},uint256) returns (uint256)`,
  'function join(uint256,address,uint256,string) payable',
  'function cancel(uint256)',
  'function release(uint256)',
  'function refund(uint256,address)',
  'function withdraw(address,address)',
  'event SlotCreated(uint256 indexed id,address indexed host,uint64 start,uint64 end)',
];
const TOKEN_ABI = [
  'function allowance(address,address) view returns (uint256)',
  'function approve(address,uint256) returns (bool)',
];
const same = (a, b) => typeof a === 'string' && typeof b === 'string' && a.toLowerCase() === b.toLowerCase();
export function bookingId(value) {
  const text = String(value);
  if (!/^[1-9]\d{0,77}$/.test(text) || BigInt(text) >= 2n ** 256n) throw new Error('Enter a positive decimal timebox ID.');
  return BigInt(text);
}
export function bookingAsset(address) {
  const asset = ASSETS.find(asset => same(asset.address || ZERO_ADDRESS, address));
  if (!asset) throw new Error('The registry returned an asset this app has no reviewed icon and decimals for.');
  return asset;
}
export function confirmed(slot) { return slot.attendees >= slot.minAttendees; }
/** Actions for the connected wallet; `refund` lists attendee addresses this wallet may refund. */
export function bookingActions(slot, account, now) {
  const open = slot.state === 0, host = !!account && same(slot.host, account);
  const seat = slot.seats?.find(seat => same(seat.attendee, account));
  const funded = seat?.state === 1;
  const refund = [];
  if (open && account) for (const other of slot.seats || []) {
    if (other.state !== 1) continue;
    const self = same(other.attendee, account) && now >= slot.start &&
      (!confirmed(slot) || now >= slot.end + 604800n);
    if (host || self) refund.push(other.attendee);
  }
  return {
    join: open && !!account && !host && !seat && now < slot.start && slot.attendees < slot.maxAttendees,
    cancel: open && host,
    release: open && funded && now >= slot.end && confirmed(slot),
    refund,
  };
}
export function offerFromDraft(event) {
  if (event.readOnly || !event.isPublic) throw new Error('Only your explicitly public local draft can become an offer.');
  const quote = slotQuote(event);
  const start = Date.parse(event.start) / 1000, end = Date.parse(event.end) / 1000;
  if (![start, end].every(Number.isSafeInteger) || start < 0 || end >= 2 ** 64) throw new Error('Use whole-second UTC dates.');
  const subject = event.title?.trim();
  if (!subject || new TextEncoder().encode(subject).length > 200) throw new Error('Use a public meeting subject of 1-200 UTF-8 bytes.');
  if (event.hardline !== undefined && typeof event.hardline !== 'boolean') throw new Error('Invalid hardline option.');
  const pricing = PRICING.indexOf(event.pricing ?? 'per-head');
  if (pricing < 0) throw new Error('Choose per-head or split pricing.');
  const minAttendees = event.minAttendees ?? 1, maxAttendees = event.maxAttendees ?? 1;
  if (![minAttendees, maxAttendees].every(Number.isInteger) || minAttendees < 1 || minAttendees > maxAttendees || maxAttendees > 50) {
    throw new Error('Attendees must satisfy 1 <= minimum <= maximum <= 50.');
  }
  if (!validTimeZone(event.timezone)) throw new Error('Set a valid IANA host timezone, such as America/Denver.');
  return { host: event.creator || event.owner, asset: quote.asset.address || ZERO_ADDRESS, pricing, price: quote.gross,
    start: BigInt(start), end: BigInt(end), minAttendees, maxAttendees, hardline: event.hardline === true, subject, timezone: event.timezone };
}
/** Exact deposit and settled charge for previews; mirrors depositFor/chargeFor. */
export function seatAmounts(slot, attendees = slot.attendees) {
  const ceil = (a, b) => a / b + (a % b ? 1n : 0n);
  if (slot.pricing === 0) return { deposit: slot.price, charge: slot.price };
  const deposit = ceil(slot.price, BigInt(slot.minAttendees));
  return { deposit, charge: attendees ? ceil(slot.price, BigInt(attendees)) : deposit };
}

export async function confirmedBookingReceipt(tx, onTransaction) {
  let receipt;
  try { receipt = await tx.wait(); }
  catch (error) {
    if (error.code !== 'TRANSACTION_REPLACED') throw error;
    const replacement = error.replacement;
    if (replacement) onTransaction({ hash: replacement.hash, phase: 'replacement' });
    if (error.cancelled || !replacement || !same(replacement.to, tx.to) ||
        replacement.data !== tx.data || replacement.value !== tx.value) {
      throw new Error(`Transaction ${tx.hash} was cancelled or replaced with different instructions. Reconcile the replacement receipt before retrying.`);
    }
    receipt = error.receipt;
  }
  if (!receipt || receipt.status !== 1) throw new Error(`Transaction ${tx.hash} was not confirmed successfully. Reconcile before retrying.`);
  onTransaction({ hash: receipt.hash, phase: 'confirmed' });
  return receipt;
}

// No DOM, storage or ENS authority: this adapter can also be exercised on a local EVM.
export function createBookingClient({ config, provider, getSession, Contract, hashCode, onTransaction = () => {} }) {
  config = Object.freeze({ ...config });
  let busy = false;
  async function latestBlock() {
    // Read a fresh block explicitly; ethers can briefly cache the "latest" alias after a receipt.
    const block = await provider.send('eth_getBlockByNumber', ['latest', false]);
    if (!block) throw new Error('Latest Base block unavailable. Retry; no empty booking was assumed.');
    return { blockTag: block.number, timestamp: BigInt(block.timestamp) };
  }
  async function registry() {
    if (!/^0x[0-9a-f]{40}$/i.test(config.address || '') || same(config.address, ZERO_ADDRESS) ||
        !/^0x[0-9a-f]{64}$/i.test(config.runtimeCodeHash || '') ||
        !/^0x[0-9a-f]{40}$/i.test(config.feeRecipient || '') || same(config.feeRecipient, ZERO_ADDRESS)) {
      throw new Error('Booking registry is not deployed and pinned. No payment is available.');
    }
    if (BigInt(await provider.send('eth_chainId', [])) !== 8453n) throw new Error('Registry RPC must be on Base (8453).');
    const code = await provider.getCode(config.address);
    if (code === '0x' || !same(hashCode(code), config.runtimeCodeHash)) throw new Error('Registry bytecode does not match the reviewed deployment.');
    const contract = new Contract(config.address, BOOKING_ABI, provider);
    const [version, fee, delay, seats, recipient, usdc] = await Promise.all([
      contract.VERSION(), contract.FEE_BPS(), contract.REFUND_DELAY(), contract.MAX_ATTENDEES(), contract.feeRecipient(),
      contract.allowedToken(ASSETS[1].address),
    ]);
    if (version !== BOOKING_VERSION || fee !== 300n || delay !== 604800n || seats !== 50n ||
        !same(recipient, config.feeRecipient) || usdc !== true) {
      throw new Error('Registry policy differs from the approved timebox agreement.');
    }
    return contract;
  }
  async function read(id) {
    id = bookingId(id);
    const contract = await registry();
    const block = await latestBlock(), blockTag = block.blockTag;
    const [value, roster, owner] = await Promise.all([contract.getSlot(id, { blockTag }), contract.rosterOf(id, { blockTag }), contract.owner({ blockTag })]);
    bookingAsset(value.asset);
    const seats = await Promise.all([...roster].map(async attendee => {
      const seat = await contract.getSeat(id, attendee, { blockTag });
      return { attendee, state: Number(seat.state), deposit: seat.deposit, timezone: seat.timezone };
    }));
    const slot = { id, host: value.host, asset: value.asset, pricing: Number(value.pricing), price: value.price,
      start: value.start, end: value.end, minAttendees: Number(value.minAttendees), maxAttendees: Number(value.maxAttendees),
      attendees: Number(value.attendees), hardline: value.hardline, state: Number(value.state), subject: value.subject,
      hostTimezone: value.hostTimezone, seats, owner, now: block.timestamp };
    return { ...slot, ...seatAmounts(slot) };
  }
  async function wallet(expected) {
    const session = getSession();
    if (!session?.signer || !session.address || (expected && (expected.signer !== session.signer || !same(expected.address, session.address)))) {
      throw new Error('Wallet session changed. Reopen the booking before signing.');
    }
    if (!same(await session.signer.getAddress(), session.address) ||
        BigInt(await session.signer.provider.send('eth_chainId', [])) !== 8453n) {
      throw new Error('Connect the intended wallet on Base (8453).');
    }
    if (getSession()?.signer !== session.signer || !same(getSession()?.address, session.address)) {
      throw new Error('Wallet session changed. No new transaction was requested.');
    }
    return session;
  }
  async function transact(operation) {
    if (busy) throw new Error('Another booking transaction is pending. Wait for its receipt.');
    if (config.writesEnabled !== true) throw new Error('Live booking transactions remain gated pending review, deployment and acceptance.');
    busy = true;
    try {
      const session = await wallet();
      const contract = await registry();
      const submit = async (target, method, args) => {
        await wallet(session);
        const tx = await target.connect(session.signer)[method](...args);
        onTransaction({ hash: tx.hash, phase: 'submitted' });
        return confirmedBookingReceipt(tx, onTransaction);
      };
      const result = await operation(contract, session, submit);
      await wallet(session);
      return result;
    } finally { busy = false; }
  }
  return {
    read,
    async credits() {
      const session = await wallet(), contract = await registry();
      const { blockTag } = await latestBlock();
      const amounts = await Promise.all(ASSETS.map(asset => contract.credits(session.address, asset.address || ZERO_ADDRESS, { blockTag })));
      await wallet(session);
      return ASSETS.map((asset, index) => ({ asset, amount: amounts[index] }));
    },
    async create(offer) {
      return transact(async (contract, session, submit) => {
        if (!same(offer.host, session.address)) throw new Error('Only the draft owner can publish this offer.');
        bookingAsset(offer.asset);
        if (!validTimeZone(offer.timezone)) throw new Error('Set a valid host timezone before publishing.');
        const block = await latestBlock();
        if (offer.start <= block.timestamp) throw new Error('The offer must start after the latest Base block.');
        if (offer.asset !== ZERO_ADDRESS && !await contract.allowedToken(offer.asset, { blockTag: block.blockTag })) {
          throw new Error('This token is not currently allowlisted by the registry.');
        }
        let prev;
        try { prev = await contract.findPrev(session.address, offer.start, offer.end, { blockTag: block.blockTag }); }
        catch (error) {
          if (/Time collision/.test(error.shortMessage || error.message)) throw new Error('This timebox collides with one of your open on-chain timeboxes. Choose a free interval or cancel the other one.');
          throw error;
        }
        const receipt = await submit(contract, 'createSlot', [[offer.asset, offer.pricing, offer.price, offer.start, offer.end,
          offer.minAttendees, offer.maxAttendees, offer.hardline, offer.subject, offer.timezone], prev]);
        const events = receipt.logs.filter(log => same(log.address, config.address)).map(log => {
          // Other logs in the same receipt are not necessarily registry events.
          try { return contract.interface.parseLog(log); } catch { return null; }
        }).filter(log => log?.name === 'SlotCreated' && same(log.args.host, session.address));
        if (events.length !== 1) throw new Error(`Offer transaction ${receipt.hash} confirmed, but its ID could not be reconciled. Do not publish again; recover from the receipt.`);
        return events[0].args.id;
      });
    },
    async allowance(slot) {
      if (same(slot.asset, ZERO_ADDRESS)) return slot.deposit;
      bookingAsset(slot.asset);
      const session = await wallet();
      await registry();
      const { blockTag } = await latestBlock();
      const amount = await new Contract(slot.asset, TOKEN_ABI, provider).allowance(session.address, config.address, { blockTag });
      await wallet(session);
      return amount;
    },
    async approve(id) {
      return transact(async (_contract, session, submit) => {
        const slot = await read(id);
        if (!bookingActions(slot, session.address, slot.now).join || same(slot.asset, ZERO_ADDRESS) || slot.deposit === 0n) throw new Error('No token approval is needed or available.');
        return submit(new Contract(slot.asset, TOKEN_ABI, provider), 'approve', [config.address, slot.deposit]);
      });
    },
    async join(expected, timezone) {
      if (!validTimeZone(timezone)) throw new Error('Set your valid IANA timezone before joining; it is stored publicly.');
      return transact(async (contract, session, submit) => {
        const slot = await read(expected.id);
        if (!bookingActions(slot, session.address, slot.now).join) throw new Error('This timebox is no longer joinable by this wallet.');
        for (const field of ['host', 'asset', 'pricing', 'price', 'start', 'end', 'minAttendees', 'maxAttendees', 'hardline', 'subject', 'hostTimezone', 'deposit']) {
          if (slot[field] !== expected[field]) throw new Error('The displayed agreement changed. Refresh and review it again.');
        }
        if (!same(slot.asset, ZERO_ADDRESS) && await this.allowance(slot) < slot.deposit) throw new Error('Approve the exact deposit first, then join in a separate transaction.');
        return submit(contract, 'join', [slot.id, slot.asset, slot.deposit, timezone,
          { value: same(slot.asset, ZERO_ADDRESS) ? slot.deposit : 0n }]);
      });
    },
    async cancel(id) {
      return transact(async (contract, session, submit) => {
        const slot = await read(id);
        if (!bookingActions(slot, session.address, slot.now).cancel) throw new Error('Only the host can cancel an open timebox.');
        return submit(contract, 'cancel', [slot.id]);
      });
    },
    async release(id) {
      return transact(async (contract, session, submit) => {
        const slot = await read(id);
        if (!bookingActions(slot, session.address, slot.now).release) throw new Error('Release is not available for this wallet, timebox state or block time.');
        return submit(contract, 'release', [slot.id]);
      });
    },
    async refund(id, attendee) {
      return transact(async (contract, session, submit) => {
        const slot = await read(id);
        if (!bookingActions(slot, session.address, slot.now).refund.some(value => same(value, attendee))) {
          throw new Error('This refund is not available for this wallet, seat or block time.');
        }
        return submit(contract, 'refund', [slot.id, attendee]);
      });
    },
    async withdraw(asset, destination) {
      bookingAsset(asset);
      if (!/^0x[0-9a-f]{40}$/i.test(destination) || same(destination, ZERO_ADDRESS) || same(destination, config.address)) {
        throw new Error('Enter a nonzero destination wallet address, not the registry. ENS is not a payout instruction.');
      }
      return transact(async (contract, _session, submit) => submit(contract, 'withdraw', [asset, destination]));
    },
  };
}
