import { assetImage, formatAmount } from './assets.js';
import { createBookingClient, bookingActions, bookingAsset, bookingId, offerFromDraft, seatAmounts, PRICING, SEAT_STATES } from './booking-client.js';
import { counterpartTime, localTimeZone, validTimeZone } from './timezones.js';
import { profileImage } from './ens-profile.js';
import { installInvitationUI } from './invitation-ui.js';

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
    for (const [role, address] of [['Host', slot.host], ...(slot.seats || []).map((seat, index) => [`Attendee ${index + 1}`, seat.attendee])]) {
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
  const when = (start, end) => [new Date(Number(start) * 1000), new Date(Number(end) * 1000)];
  function agreement(slot) {
    const asset = bookingAsset(slot.asset), amount = value => `${formatAmount(value, asset.decimals)} ${asset.symbol}`;
    const { deposit, charge } = seatAmounts(slot, slot.attendees || slot.minAttendees);
    const fee = charge * 300n / 10000n, [start, end] = when(slot.start, slot.end);
    content.append(assetImage(asset));
    line('Meeting subject', slot.subject);
    line('Host', slot.host);
    line('Your time', `${start.toLocaleString()} - ${end.toLocaleTimeString()} (${localTimeZone()})`);
    line('Host time', counterpartTime(start, end, slot.hostTimezone ?? slot.timezone, 'host'));
    line('UTC interval', `${start.toISOString()} - ${end.toISOString()}`);
    line('Seats', `${slot.attendees ?? 0} joined; minimum ${slot.minAttendees}, maximum ${slot.maxAttendees} attendees plus host`);
    line('Asset', `${asset.symbol} on Base (8453), ${asset.address || 'native ETH'}`);
    if (slot.pricing === 0) {
      line('Per-head price', `${amount(slot.price)} per attendee`);
    } else {
      line('Split total', `${amount(slot.price)} shared by all attendees`);
      line('Split deposit', `${amount(deposit)} each (total / minimum). At release each attendee pays total / attendees at start and the rest is credited back.`);
    }
    line('On release, per seat', `${amount(charge - fee)} host + ${amount(fee)} development (3%)${slot.pricing === 1 ? ` at ${slot.attendees || slot.minAttendees} attendees` : ''}`);
    line('Fee recipient (immutable)', config.feeRecipient || 'Not yet deployed');
    line('Hardline agreement', slot.hardline ? 'End at the fixed UTC finish; five-minute warning. Meeting access is not live.' : 'No agreed hardline. Meeting access is not live.');
    line('Policy', 'Host timeboxes never overlap. Attendees cannot leave on their own before start; the host may refund any seat or cancel the timebox (full credit). If the minimum is not met by start, attendees reclaim in full. After the end each attendee releases their own seat, or reclaims after seven unresolved days. Token admin cannot touch escrow. Resolution creates withdrawal credit, not an automatic transfer.');
  }
  function roster(slot) {
    const [start, end] = when(slot.start, slot.end);
    for (const [index, seat] of slot.seats.entries()) {
      line(`Attendee ${index + 1}`, `${seat.attendee} - ${SEAT_STATES[seat.state]} - ${counterpartTime(start, end, seat.timezone, 'them')}`);
    }
  }
  async function renderBooking(id, request = show()) {
    const service = await api(), slot = await service.read(id);
    if (request !== generation || !dialog.open) return;
    content.replaceChildren();
    line('Registry', `${config.address} on Base (8453)`);
    line('Timebox ID', slot.id);
    line('Chain state', `${['Open', 'Cancelled'][slot.state]}${slot.state === 0 && slot.now >= slot.start ? (slot.attendees >= slot.minAttendees ? ' - confirmed' : ' - minimum not met') : ''}`);
    line('State checked at Base time', new Date(Number(slot.now) * 1000).toISOString());
    line('Token admin (allowlist only)', slot.owner);
    agreement(slot);
    roster(slot);
    identities(slot, request);
    const url = new URL(location.href);
    url.search = ''; url.hash = ''; url.searchParams.set('booking', slot.id.toString());
    const link = document.createElement('a');
    link.href = url.href; link.textContent = 'Permanent timebox link'; content.append(link);
    button('Copy timebox link', async () => {
      await navigator.clipboard.writeText(url.href);
      status.textContent = 'Timebox link copied.';
    });
    button('Refresh chain state', () => renderBooking(slot.id));
    button('Show checked slot on calendar', async () => {
      const request = generation;
      const fresh = await service.read(slot.id);
      if (request !== generation || !dialog.open) return;
      window.showRegistrySlot({ ...fresh, registry: config.address });
      generation++; dialog.close();
    });
    const invitation = installInvitationUI({
      container: content, slot, registry: config.address, account: getSession().address,
      profiles: window.DCalProfiles,
      isCurrent: () => request === generation && dialog.open,
    });
    const actions = bookingActions(slot, getSession().address, slot.now);
    const asset = bookingAsset(slot.asset);
    if (actions.join) {
      const zoneLabel = document.createElement('label'), zone = document.createElement('input');
      zoneLabel.textContent = 'Your timezone (public, permanent on Base): ';
      zone.value = localTimeZone(); zone.autocomplete = 'off'; zone.id = 'booking-join-timezone';
      zoneLabel.append(zone); content.append(zoneLabel);
      const consent = document.createElement('label'), check = document.createElement('input');
      check.type = 'checkbox';
      consent.append(check, document.createTextNode(` I agree to this exact interval, deposit (${formatAmount(slot.deposit, asset.decimals)} ${asset.symbol}), hardline and policy, and to publishing my wallet and timezone. Base gas is separate.`));
      content.append(consent);
      const ready = () => {
        if (!check.checked) throw new Error('Review and check the agreement first.');
        if (!validTimeZone(zone.value.trim())) throw new Error('Enter a valid IANA timezone, such as Europe/Lisbon.');
      };
      if (asset.address && slot.deposit > 0n) {
        const allowance = await service.allowance(slot);
        if (request !== generation || !dialog.open) return;
        line(`${asset.symbol} allowance to this registry`, formatAmount(allowance, asset.decimals));
        if (allowance < slot.deposit) button(`Approve exact ${asset.symbol} deposit (not a booking)`, async () => {
          ready();
          const request = generation;
          await service.approve(slot.id);
          if (request !== generation || !dialog.open) return;
          await renderBooking(slot.id);
          status.textContent = 'Approval confirmed. Review the agreement again, then join separately. Approval alone reserves no seat.';
        }, true);
      }
      const joinButton = button('Join this timebox', async () => {
        ready();
        const request = generation;
        await service.join(slot, zone.value.trim());
        if (request !== generation || !dialog.open) return;
        await renderBooking(slot.id);
        status.textContent = 'Seat receipt confirmed. Refreshed chain state is shown above.';
      }, true);
      if (invitation.recipient === getSession().address?.toLowerCase()) joinButton.classList.add('invitation-join');
    }
    const resolve = (text, action) => button(text, async () => {
      if (!window.confirm(`${text}? This submits a Base transaction. Credits require a separate withdrawal.`)) return;
      const request = generation;
      await action();
      if (request !== generation || !dialog.open) return;
      await renderBooking(slot.id);
      status.textContent = 'Resolution confirmed. Use My withdrawal credits to move any credit to your wallet.';
    }, true);
    if (actions.release) resolve(`Release my seat: ${slot.pricing === 1 ? 'split charge' : 'price'} to host, 3% development`, () => service.release(slot.id));
    for (const attendee of actions.refund) {
      resolve(attendee.toLowerCase() === getSession().address?.toLowerCase() ? 'Reclaim my full deposit' : `Refund seat ${attendee} in full`,
        () => service.refund(slot.id, attendee));
    }
    if (actions.cancel) resolve('Cancel timebox, free the time and refund every funded seat', () => service.cancel(slot.id));
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
        agreement({ ...offer, hostTimezone: offer.timezone, attendees: 0, deposit: seatAmounts(offer).deposit });
        line('Publication', `This subject, wallet, price, seats, interval and your timezone (${offer.timezone}) become public on Base forever. No private description or room ID is uploaded. The registry rejects timeboxes that overlap your other open on-chain timeboxes.`);
        button('Publish public on-chain offer', async () => {
          if (!window.confirm('Publish these public terms permanently on Base? This is not a private calendar save.')) return;
          const request = generation;
          const id = await (await api()).create(offer);
          if (request !== generation || !dialog.open) return;
          await renderBooking(id);
          status.textContent = `Offer ${id} confirmed. Save its permanent timebox link. Your local draft remains unverified.`;
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
