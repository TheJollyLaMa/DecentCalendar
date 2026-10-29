import { inviteAddress, timeboxLink } from './invitations.js';

export const INVITATIONS_ABI = [
  'function VERSION() view returns (string)',
  'function booking() view returns (address)',
  'function invite(uint256,address,uint8)',
  'function withdrawInvitation(bytes32)',
  'function inboxCount(address) view returns (uint256)',
  'function inbox(address,uint256,uint256) view returns (bytes32[],tuple(uint256 slotId,address host,address recipient,uint8 preference,bool active,uint64 revision)[])',
];
export const PREFERENCES = ['Open invitation', 'Place requested for you — NOT held', 'Intended invitees only — NOT enforced'];

export function createInboxClient({ config, booking, provider, Contract, hashCode, getSession }) {
  const ready = async () => {
    if (!config?.address || !config.runtimeCodeHash) throw new Error('Public invitation inbox unavailable: registry deployment is not pinned yet.');
    if ((await provider.getNetwork()).chainId !== 8453n) throw new Error('Invitation inbox requires Base.');
    if (hashCode(await provider.getCode(config.address)) !== config.runtimeCodeHash) throw new Error('Invitation registry code does not match the pinned deployment.');
    const registry = new Contract(config.address, INVITATIONS_ABI, provider);
    if (await registry.VERSION() !== 'dcal-invitations-1' || (await registry.booking()).toLowerCase() !== booking.toLowerCase()) {
      throw new Error('Invitation registry version or booking address mismatch.');
    }
    return registry;
  };
  return {
    async read(address, offset = 0) {
      inviteAddress(address);
      const registry = await ready();
      const [count, page] = await Promise.all([registry.inboxCount(address), registry.inbox(address, offset, 50)]);
      return { count: Number(count), items: page[1].map((item, index) => ({
        key: page[0][index], slotId: item.slotId.toString(), host: item.host, recipient: item.recipient,
        preference: Number(item.preference), active: item.active, revision: item.revision.toString(),
      })) };
    },
    async send(id, address, preference) {
      inviteAddress(address);
      if (!Number.isInteger(preference) || preference < 0 || preference > 2) throw new Error('Invalid invitation preference.');
      const registry = await ready(), session = getSession();
      if (!session.address || !session.signer) throw new Error('Connect the timebox host wallet on Base.');
      if ((await session.signer.provider.getNetwork()).chainId !== 8453n) throw new Error('Switch your wallet to Base.');
      const tx = await registry.connect(session.signer).invite(id, address, preference);
      const receipt = await tx.wait();
      if (!receipt || receipt.status !== 1) throw new Error('Invitation transaction did not confirm.');
      return tx.hash;
    },
  };
}

export function createInboxPreferences(storage, registry, wallet) {
  const key = `dcal:inbox:8453:${inviteAddress(registry)}:${inviteAddress(wallet)}`;
  const read = () => {
    const raw = storage.getItem(key);
    if (!raw) return { trusted: [], blocked: [], seen: {} };
    const value = JSON.parse(raw);
    if (!Array.isArray(value.trusted) || !Array.isArray(value.blocked) || !value.seen || typeof value.seen !== 'object' || Array.isArray(value.seen)) throw new Error('Invalid inbox preferences.');
    return { trusted: value.trusted.map(inviteAddress), blocked: value.blocked.map(inviteAddress), seen: value.seen };
  };
  return {
    read,
    update(change) { const state = read(); change(state); storage.setItem(key, JSON.stringify(state)); return state; },
  };
}

export function unreadInvitations(items, preferences) {
  return items.filter(item => item.active && preferences.trusted.includes(item.host.toLowerCase()) &&
    !preferences.blocked.includes(item.host.toLowerCase()) && preferences.seen[item.key] !== item.revision).length;
}

export function installInvitationInbox() {
  const header = document.querySelector('decent-header');
  const menu = header.shadowRoot.querySelector('ankh-menu[side="right"]'), root = menu.shadowRoot;
  const style = document.createElement('style');
  style.textContent = `.invitation-dot {position:absolute;right:-3px;top:-3px;min-width:16px;height:16px;padding:2px;border-radius:20px;background:#00bfff;color:#00121c;font:700 12px/16px system-ui;text-align:center;box-shadow:0 0 7px #00bfff,0 0 18px #00bfff} .invitation-dot[hidden]{display:none}`;
  root.append(style);
  const badge = document.createElement('span');
  badge.className = 'invitation-dot'; badge.hidden = true; badge.setAttribute('aria-hidden', 'true');
  root.querySelector('summary').append(badge);
  const launch = document.createElement('button');
  launch.type = 'button'; launch.textContent = 'Invitations'; launch.style.cursor = 'pointer';
  root.querySelector('.options').append(launch);
  const dialog = document.createElement('dialog');
  dialog.id = 'invitations-inbox';
  dialog.setAttribute('aria-label', 'Invitations inbox');
  dialog.innerHTML = '<button type="button" data-close>Close</button><h2>Public office-hours invitations</h2><p>Hosts sign invitations on Base. Sender, recipient and timebox are public forever. Invitations do not reserve seats or take payment. Unknown hosts appear as Requests; only trusted hosts light up the ankh. Read/trust/mute settings stay on this device.</p><button type="button" data-refresh>Refresh inbox</button><p role="status"></p><div data-items></div><button type="button" data-more hidden>Load older invitations</button>';
  document.body.append(dialog);
  const status = dialog.querySelector('[role="status"]'), content = dialog.querySelector('[data-items]');
  let generation = 0, service, preferences, items = [], offset = 0, count = 0, busy = false, available = false;
  const account = () => window._walletAddress;
  const config = window.DECENT_CONFIG.invitations;
  const updateBadge = () => {
    const unread = preferences ? unreadInvitations(items, preferences.read()) : 0;
    badge.hidden = !available || !account() || !unread;
    badge.textContent = unread > 99 ? '99+' : String(unread);
    launch.textContent = unread ? `Invitations (${unread} unread)` : 'Invitations';
    root.querySelector('summary').setAttribute('aria-label', unread ? `Profile menu, ${unread} unread invitations` : 'Profile menu');
  };
  const getService = async () => {
    if (!service) {
      const { loadEthers } = await import('../vendor/decent-head/2.0.0/js/wallet.js');
      const { Contract, JsonRpcProvider, FetchRequest, keccak256 } = await loadEthers();
      const request = new FetchRequest(window.DECENT_CONFIG.chain.rpcUrls[0]); request.timeout = 12000;
      service = createInboxClient({ config, booking: window.DECENT_CONFIG.booking.address,
        provider: new JsonRpcProvider(request, 8453, { staticNetwork: true }), Contract, hashCode: keccak256,
        getSession: () => ({ address: window._walletAddress, signer: window._walletSigner }) });
    }
    return service;
  };
  window.DCalInvitationInbox = { send: async (...args) => (await getService()).send(...args) };
  const report = error => {
    console.error('[DCal inbox]', error);
    available = false;
    status.textContent = `Inbox unavailable: ${error.message}`;
    badge.hidden = true;
    launch.textContent = 'Invitations (unavailable)';
    root.querySelector('summary').setAttribute('aria-label', 'Profile menu, invitation inbox unavailable');
  };
  const render = () => {
    content.replaceChildren();
    const state = preferences.read();
    for (const item of items) {
      const host = item.host.toLowerCase(), muted = state.blocked.includes(host), trusted = state.trusted.includes(host);
      const card = document.createElement('section');
      card.className = 'timebox-invitations';
      const text = document.createElement('p');
      text.textContent = `${muted ? 'Muted' : trusted ? 'Invitation' : 'Request'} from ${item.host} · timebox ${item.slotId} · ${item.active ? 'Active invitation (check timebox availability)' : 'Withdrawn'} · ${PREFERENCES[item.preference]}`;
      card.append(text);
      const action = (label, fn) => {
        const button = document.createElement('button'); button.textContent = label;
        button.onclick = () => { try { fn(); render(); updateBadge(); } catch (error) { report(error); } };
        card.append(button);
      };
      action('Review timebox', () => {
        preferences.update(value => { value.seen[item.key] = item.revision; });
        dialog.close(); window.DCalBookings.open(item.slotId);
      });
      action('Mark read', () => preferences.update(value => { value.seen[item.key] = item.revision; }));
      action(trusted ? 'Untrust host' : 'Trust host', () => preferences.update(value => {
        value.trusted = trusted ? value.trusted.filter(address => address !== host) : [...value.trusted, host];
        value.blocked = value.blocked.filter(address => address !== host);
      }));
      action(muted ? 'Unmute host' : 'Mute host', () => preferences.update(value => {
        value.blocked = muted ? value.blocked.filter(address => address !== host) : [...value.blocked, host];
      }));
      const link = document.createElement('a');
      link.href = timeboxLink(location.href, item.slotId); link.textContent = 'Timebox link'; card.append(link);
      content.append(card);
    }
    if (!items.length) content.textContent = 'No invitations in this checked page.';
    dialog.querySelector('[data-more]').hidden = offset >= count;
    updateBadge();
  };
  const refresh = async (more = false) => {
    if (busy) return;
    const request = generation, wallet = account();
    if (!wallet) { status.textContent = 'Connect your wallet on Base to check your public invitations.'; return; }
    busy = true;
    status.textContent = 'Checking the public invitation registry on Base…';
    try {
      const result = await (await getService()).read(wallet, more ? offset : 0);
      if (request !== generation || wallet !== account()) return;
      preferences = createInboxPreferences(localStorage, config.address, wallet);
      available = true;
      items = more ? [...items, ...result.items] : result.items;
      offset = items.length; count = result.count;
      render();
      status.textContent = `Checked ${offset} of ${count} public invitations. Badge covers loaded pages only; requests do not glow. Seat availability and payment are checked separately in the timebox.`;
    } catch (error) { if (request === generation) report(error); }
    finally { busy = false; }
  };
  launch.onclick = () => { root.querySelector('details').open = false; dialog.showModal(); void refresh(); };
  dialog.querySelector('[data-close]').onclick = () => dialog.close();
  dialog.querySelector('[data-refresh]').onclick = () => void refresh();
  dialog.querySelector('[data-more]').onclick = () => void refresh(true);
  const reset = () => {
    generation++; busy = false; available = false; items = []; preferences = null; offset = 0; count = 0;
    content.replaceChildren(); status.textContent = ''; dialog.close(); badge.hidden = true;
    launch.textContent = 'Invitations'; root.querySelector('summary').setAttribute('aria-label', 'Profile menu');
  };
  window.addEventListener('decenthead:wallet', reset);
  setInterval(() => { if (account() && document.visibilityState === 'visible' && !dialog.open) void refresh(); }, 60000);
  // Session binding invokes this only after a signer and correct Base wallet are ready.
  return { connected: () => void refresh(), disconnected: reset };
}
