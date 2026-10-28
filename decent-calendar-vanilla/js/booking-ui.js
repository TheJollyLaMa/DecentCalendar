import { assetImage, formatAmount } from './assets.js';
import { createBookingClient, bookingActions, bookingAsset, bookingId, offerFromDraft } from './booking-client.js';
import { profileImage } from './ens-profile.js';

export function installBookingUI() {
  const config = window.DECENT_CONFIG.booking;
  const dialog = document.getElementById('booking-registry');
  const content = document.getElementById('booking-registry-content');
  const status = document.getElementById('booking-registry-status');
  const history = document.getElementById('booking-registry-transactions');
  const getSession = () => ({ address: window._walletAddress, signer: window._walletSigner });
  let client, generation = 0, pending = false;
  const gate = document.getElementById('booking-registry-gate');
  gate.textContent = config.writesEnabled ? 'Confirm every transaction in your wallet. Gas is separate.' :
    'Transactions are disabled until the reviewed Base deployment is pinned and accepted. No funds or approvals can be requested.';
  async function api() {
    if (!client) {
      const { loadEthers } = await import('../vendor/decent-head/2.0.0/js/wallet.js');
      const { Contract, JsonRpcProvider, FetchRequest, keccak256 } = await loadEthers();
      const request = new FetchRequest(window.DECENT_CONFIG.chain.rpcUrls[0]);
      request.timeout = 12000;
      client = createBookingClient({
        config, provider: new JsonRpcProvider(request, 8453, { staticNetwork: true }),
        getSession, Contract, hashCode: keccak256,
        onTransaction({ hash, phase }) {
          const item = document.createElement('p'), link = document.createElement('a');
          link.href = `https://basescan.org/tx/${hash}`;
          link.target = '_blank'; link.rel = 'noopener noreferrer';
          link.textContent = `${phase}: ${hash}`;
          item.append(link);
          history.append(item);
        },
      });
    }
    return client;
  }
  const line = (label, value) => {
    const p = document.createElement('p'), strong = document.createElement('strong');
    strong.textContent = `${label}: `;
    p.append(strong, document.createTextNode(String(value)));
    content.append(p);
  };
  const run = async action => {
    if (pending) return;
    pending = true;
    status.textContent = 'Checking Base state. If submitted, wait for the receipt; do not retry in another tab.';
    dialog.querySelectorAll('button:not([data-close]), input').forEach(node => { node.disabled = true; });
    try { await action(); }
    catch (error) {
      console.error('[DCal booking]', error);
      status.textContent = error.shortMessage || error.message;
    } finally {
      pending = false;
      dialog.querySelectorAll('button, input').forEach(node => { node.disabled = false; });
      dialog.querySelectorAll('[data-write]').forEach(node => { node.disabled = !config.writesEnabled; });
    }
  };
  const button = (text, action, write = false) => {
    const node = document.createElement('button');
    node.type = 'button'; node.textContent = text;
    if (write) { node.dataset.write = ''; node.disabled = !config.writesEnabled; }
    node.onclick = () => { void run(action); };
    content.append(node);
    return node;
  };
  const show = () => {
    generation++;
    content.replaceChildren(); status.textContent = '';
    if (!dialog.open) dialog.showModal();
    return generation;
  };
  function identities(slot, request) {
    for (const [role, address] of [['Host', slot.host], ['Buyer', slot.buyer]]) {
      if (!address || /^0x0{40}$/i.test(address)) continue;
      const card = document.createElement('section');
      card.setAttribute('aria-label', `${role} ENS display identity`);
      card.textContent = `${role}: ${address} (ENS lookup pending)`;
      content.append(card);
      window.DCalProfiles.lookup(address).then(profile => {
        if (request !== generation || !dialog.open) return;
        card.textContent = `${role}: ${profile.name || address} - ${address}. ENS artwork is mutable display data. ${profile.warnings.join(' ')}`;
        const failed = () => { card.append(document.createTextNode(' ENS image unavailable; the booking wallet is unchanged.')); };
        if (profile.banner) card.prepend(profileImage(profile.banner, 'ens-banner', `${role} ENS banner`, failed));
        if (profile.avatar) card.prepend(profileImage(profile.avatar, 'ens-avatar', `${role} ENS avatar`, failed));
      }, error => {
        if (request !== generation) return;
        card.textContent = `${role}: ${address}. ENS unavailable: ${error.message}`;
        console.warn('[DCal booking ENS]', error);
      });
    }
  }
  function agreement(slot) {
    const asset = bookingAsset(slot.asset), fee = slot.gross * 300n / 10000n;
    content.append(assetImage(asset));
    line('Public title', slot.metadata);
    line('Host', slot.host);
    if (slot.buyer) line('Buyer', slot.buyer);
    line('UTC interval', `${new Date(Number(slot.start) * 1000).toISOString()} - ${new Date(Number(slot.end) * 1000).toISOString()}`);
    line('Your timezone', `${Intl.DateTimeFormat().resolvedOptions().timeZone}: ${new Date(Number(slot.start) * 1000).toLocaleString()} - ${new Date(Number(slot.end) * 1000).toLocaleString()}`);
    line('Asset', `${asset.symbol} on Base (8453), ${asset.address || 'native ETH'}`);
    line('Escrow gross', `${formatAmount(slot.gross, asset.decimals)} ${asset.symbol}`);
    line('On settlement only', `${formatAmount(slot.gross - fee, asset.decimals)} host + ${formatAmount(fee, asset.decimals)} development (3%)`);
    line('Fee recipient (immutable)', config.feeRecipient || 'Not yet deployed');
    line('Hardline agreement', slot.hardline ? 'End at the fixed UTC finish; five-minute warning. Meeting access is not live.' : 'No agreed hardline. Meeting access is not live.');
    line('Policy', 'Either party: full refund strictly before start. Host: full refund while funded. Buyer: release after end or refund after seven unresolved days. No admin dispute power. Resolution creates withdrawal credit, not an automatic wallet transfer.');
  }
  async function renderBooking(id, request = show()) {
    const service = await api(), slot = await service.read(id);
    if (request !== generation || !dialog.open) return;
    content.replaceChildren();
    line('Registry', `${config.address} on Base (8453)`);
    line('Booking ID', slot.id);
    line('Chain state', ['Available', 'Funded', 'Settled', 'Refunded', 'Withdrawn'][slot.state]);
    line('State checked at Base time', new Date(Number(slot.now) * 1000).toISOString());
    agreement(slot);
    identities(slot, request);
    const url = new URL(location.href);
    url.search = ''; url.hash = ''; url.searchParams.set('booking', slot.id.toString());
    const link = document.createElement('a');
    link.href = url.href; link.textContent = 'Permanent booking link'; content.append(link);
    button('Copy booking link', async () => {
      await navigator.clipboard.writeText(url.href);
      status.textContent = 'Booking link copied.';
    });
    button('Refresh chain state', () => renderBooking(slot.id));
    button('Show checked slot on calendar', async () => {
      const request = generation;
      const fresh = await service.read(slot.id);
      if (request !== generation || !dialog.open) return;
      window.showRegistrySlot({ ...fresh, registry: config.address });
      generation++; dialog.close();
    });
    const actions = bookingActions(slot, getSession().address, slot.now);
    if (actions.book) {
      const consent = document.createElement('label'), check = document.createElement('input');
      check.type = 'checkbox';
      consent.append(check, document.createTextNode(' I agree to this exact UTC interval, asset, gross, hardline and refund policy. Base gas is separate.'));
      content.append(consent);
      if (bookingAsset(slot.asset).id === 'base:usdc' && slot.gross > 0n) {
        const allowance = await service.allowance(slot);
        if (request !== generation || !dialog.open) return;
        line('USDC allowance to this registry', formatAmount(allowance, 6));
        if (allowance < slot.gross) button('Approve exact USDC amount (not a booking)', async () => {
          if (!check.checked) throw new Error('Review and check the agreement before approval.');
          const request = generation;
          await service.approve(slot.id);
          if (request !== generation || !dialog.open) return;
          await renderBooking(slot.id);
          status.textContent = 'Approval confirmed. Review the agreement again, then book separately. Approval alone reserves no time.';
        }, true);
      }
      button('Book this exact agreement', async () => {
        if (!check.checked) throw new Error('Review and check the agreement before booking.');
        const request = generation;
        await service.book(slot);
        if (request !== generation || !dialog.open) return;
        await renderBooking(slot.id);
        status.textContent = 'Booking receipt confirmed. Refreshed chain state is shown above.';
      }, true);
    }
    for (const [action, text] of [
      ['withdrawOffer', 'Withdraw unbooked offer'],
      ['release', 'Release escrow: 97% host / 3% development'],
      ['refund', 'Resolve with full refund credit to buyer'],
    ]) if (actions[action]) button(text, async () => {
      if (!window.confirm(`${text}? This submits a Base transaction. Credits require a separate withdrawal.`)) return;
      const request = generation;
      await service[action](slot.id);
      if (request !== generation || !dialog.open) return;
      await renderBooking(slot.id);
      status.textContent = 'Resolution confirmed. Use My withdrawal credits to move any credit to your wallet.';
    }, true);
    if (!getSession().address) line('Wallet', 'Connect explicitly on Base to see actions for your address.');
    status.textContent = 'Read from the pinned registry, not local or imported booking claims. Refresh after time boundaries or external transactions.';
  }
  window.DCalBookings = {
    open(id) { if (!pending) void run(() => renderBooking(bookingId(id))); },
    publish(event) {
      if (pending) return;
      show();
      try {
        const offer = offerFromDraft(event);
        if (offer.host?.toLowerCase() !== getSession().address?.toLowerCase()) throw new Error('Connect the local draft owner to publish.');
        agreement(offer);
        line('Publication', 'This title, wallet, price and interval become public on Base forever. No private description or room ID is uploaded. Review timezone and your other calendars; v1 does not enforce cross-slot conflicts.');
        button('Publish public on-chain offer', async () => {
          if (!window.confirm('Publish these public terms permanently on Base? This is not a private calendar save.')) return;
          const request = generation;
          const id = await (await api()).create(offer);
          if (request !== generation || !dialog.open) return;
          await renderBooking(id);
          status.textContent = `Offer ${id} confirmed. Save its permanent booking link. Your local draft remains unverified.`;
        }, true);
      } catch (error) { status.textContent = error.message; }
    },
  };
  document.getElementById('open-booking-registry').onclick = () => {
    if (!pending) show();
  };
  document.getElementById('load-booking-id').onclick = () => {
    if (!pending) void run(() => renderBooking(bookingId(document.getElementById('booking-id').value)));
  };
  document.getElementById('load-booking-credits').onclick = () => {
    if (pending) return;
    const request = show();
    void run(async () => {
      const service = await api(), credits = await service.credits();
      if (request !== generation || !dialog.open) return;
      const owner = getSession().address;
      line('Credited wallet', owner);
      for (const { asset, amount } of credits) {
        content.append(assetImage(asset));
        line('Withdrawable', `${formatAmount(amount, asset.decimals)} ${asset.symbol}`);
        if (amount === 0n) continue;
        const label = document.createElement('label'), input = document.createElement('input');
        label.textContent = `Destination for ${asset.symbol} (exact address): `;
        input.value = owner; input.autocomplete = 'off'; label.append(input); content.append(label);
        button(`Withdraw ${asset.symbol} credit`, async () => {
          const destination = input.value.trim();
          if (!window.confirm(`Withdraw ${formatAmount(amount, asset.decimals)} ${asset.symbol} to ${destination}? Verify the complete address.`)) return;
          const request = generation;
          await service.withdraw(asset.address || '0x0000000000000000000000000000000000000000', destination);
          if (request !== generation || !dialog.open) return;
          content.replaceChildren();
          status.textContent = 'Withdrawal confirmed. Load My withdrawal credits again to reconcile the remaining balances.';
        }, true);
      }
    });
  };
  dialog.querySelector('[data-close]').onclick = () => { generation++; dialog.close(); };
  dialog.addEventListener('cancel', () => { generation++; });
  window.addEventListener('decenthead:wallet', () => {
    generation++; dialog.close(); content.replaceChildren();
  });
  const id = new URL(location.href).searchParams.get('booking');
  if (id !== null) {
    show();
    void run(() => renderBooking(bookingId(id)));
  }
}
