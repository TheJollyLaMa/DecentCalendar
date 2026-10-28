import { ASSETS, slotQuote } from './assets.js';

export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
export const BOOKING_ABI = [
  'function VERSION() view returns (string)',
  'function FEE_BPS() view returns (uint256)',
  'function REFUND_DELAY() view returns (uint256)',
  'function feeRecipient() view returns (address)',
  'function usdc() view returns (address)',
  'function nextId() view returns (uint256)',
  'function getSlot(uint256) view returns (tuple(address host,address buyer,address asset,uint256 gross,uint64 start,uint64 end,bool hardline,uint8 state,string metadata))',
  'function credits(address,address) view returns (uint256)',
  'function createSlot(address,uint256,uint64,uint64,bool,string) returns (uint256)',
  'function book(uint256,address,uint256,uint64,uint64,bool) payable',
  'function withdrawOffer(uint256)',
  'function release(uint256)',
  'function refund(uint256)',
  'function withdraw(address,address)',
  'event SlotCreated(uint256 indexed id,address indexed host,address asset,uint256 gross,uint64 start,uint64 end,bool hardline,string metadata)',
];
const TOKEN_ABI = [
  'function allowance(address,address) view returns (uint256)',
  'function approve(address,uint256) returns (bool)',
];
const same = (a, b) => typeof a === 'string' && typeof b === 'string' && a.toLowerCase() === b.toLowerCase();
export function bookingId(value) {
  const text = String(value);
  if (!/^(0|[1-9]\d{0,77})$/.test(text) || BigInt(text) >= 2n ** 256n) throw new Error('Enter a non-negative decimal booking ID.');
  return BigInt(text);
}
export function bookingAsset(address) {
  const asset = ASSETS.find(asset => same(asset.address || ZERO_ADDRESS, address));
  if (!asset) throw new Error('The registry returned an unsupported asset.');
  return asset;
}
export function bookingActions(slot, account, now) {
  const host = same(slot.host, account), buyer = same(slot.buyer, account);
  return {
    book: slot.state === 0 && !host && !!account && now < slot.start,
    withdrawOffer: slot.state === 0 && host,
    release: slot.state === 1 && buyer && now >= slot.end,
    refund: slot.state === 1 && (host || (buyer && (now < slot.start || now >= slot.end + 604800n))),
  };
}
export function offerFromDraft(event) {
  if (event.readOnly || !event.isPublic) throw new Error('Only your explicitly public local draft can become an offer.');
  const quote = slotQuote(event);
  const start = Date.parse(event.start) / 1000, end = Date.parse(event.end) / 1000;
  if (![start, end].every(Number.isSafeInteger) || start < 0 || end >= 2 ** 64) throw new Error('Use whole-second UTC dates.');
  const metadata = event.title?.trim();
  if (!metadata || new TextEncoder().encode(metadata).length > 200) throw new Error('Use a public title of 1-200 UTF-8 bytes.');
  if (event.hardline !== undefined && typeof event.hardline !== 'boolean') throw new Error('Invalid hardline option.');
  return { host: event.creator || event.owner, asset: quote.asset.address || ZERO_ADDRESS, gross: quote.gross,
    start: BigInt(start), end: BigInt(end), hardline: event.hardline === true, metadata };
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
    const [version, fee, delay, recipient, usdc] = await Promise.all([
      contract.VERSION(), contract.FEE_BPS(), contract.REFUND_DELAY(), contract.feeRecipient(), contract.usdc(),
    ]);
    if (version !== 'dcal-booking-1' || fee !== 300n || delay !== 604800n ||
        !same(recipient, config.feeRecipient) || !same(usdc, ASSETS[1].address)) {
      throw new Error('Registry policy differs from the approved booking agreement.');
    }
    return contract;
  }
  async function read(id) {
    id = bookingId(id);
    const contract = await registry();
    const block = await latestBlock();
    const value = await contract.getSlot(id, { blockTag: block.blockTag });
    bookingAsset(value.asset);
    return { id, host: value.host, buyer: value.buyer, asset: value.asset, gross: value.gross,
      start: value.start, end: value.end, hardline: value.hardline, metadata: value.metadata,
      state: Number(value.state), now: block.timestamp };
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
  async function act(id, action) {
    return transact(async (contract, session, submit) => {
      const slot = await read(id);
      if (!bookingActions(slot, session.address, slot.now)[action]) throw new Error('This action is not available for this wallet, booking state or block time.');
      return submit(contract, action, [slot.id]);
    });
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
        const block = await latestBlock();
        if (offer.start <= block.timestamp) throw new Error('The offer must start after the latest Base block.');
        const receipt = await submit(contract, 'createSlot', [offer.asset, offer.gross, offer.start, offer.end, offer.hardline, offer.metadata]);
        const events = receipt.logs.filter(log => same(log.address, config.address)).map(log => {
          // Other logs in the same receipt are not necessarily registry events.
          try { return contract.interface.parseLog(log); } catch { return null; }
        }).filter(log => log?.name === 'SlotCreated' && same(log.args.host, session.address));
        if (events.length !== 1) throw new Error(`Offer transaction ${receipt.hash} confirmed, but its ID could not be reconciled. Do not publish again; recover from the receipt.`);
        return events[0].args.id;
      });
    },
    async allowance(slot) {
      if (same(slot.asset, ZERO_ADDRESS)) return slot.gross;
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
        if (!bookingActions(slot, session.address, slot.now).book || same(slot.asset, ZERO_ADDRESS) || slot.gross === 0n) throw new Error('No token approval is needed or available.');
        return submit(new Contract(slot.asset, TOKEN_ABI, provider), 'approve', [config.address, slot.gross]);
      });
    },
    async book(expected) {
      return transact(async (contract, session, submit) => {
        const slot = await read(expected.id);
        if (!bookingActions(slot, session.address, slot.now).book) throw new Error('This offer is no longer bookable by this wallet.');
        for (const field of ['host', 'asset', 'gross', 'start', 'end', 'hardline', 'metadata']) {
          if (slot[field] !== expected[field]) throw new Error('The displayed agreement changed. Refresh and review it again.');
        }
        if (!same(slot.asset, ZERO_ADDRESS) && await this.allowance(slot) < slot.gross) throw new Error('Approve the exact USDC amount first, then book in a separate transaction.');
        return submit(contract, 'book', [slot.id, slot.asset, slot.gross, slot.start, slot.end, slot.hardline,
          { value: same(slot.asset, ZERO_ADDRESS) ? slot.gross : 0n }]);
      });
    },
    withdrawOffer: id => act(id, 'withdrawOffer'),
    release: id => act(id, 'release'),
    refund: id => act(id, 'refund'),
    async withdraw(asset, destination) {
      bookingAsset(asset);
      if (!/^0x[0-9a-f]{40}$/i.test(destination) || same(destination, ZERO_ADDRESS) || same(destination, config.address)) {
        throw new Error('Enter a nonzero destination wallet address, not the registry. ENS is not a payout instruction.');
      }
      return transact(async (contract, _session, submit) => submit(contract, 'withdraw', [asset, destination]));
    },
  };
}
