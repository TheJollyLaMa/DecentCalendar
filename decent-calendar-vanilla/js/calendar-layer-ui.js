import { createAppointmentClient } from './appointment-client.js';
import { createLayerStore, projectLayers, layerStale } from './calendar-layers.js';
import { availabilityLink } from './appointments.js';
import { informationPanel } from './ui-info.js';

const node = (tag, text) => {
  const element = document.createElement(tag);
  if (text !== undefined) element.textContent = text;
  return element;
};

export function installCalendarLayers({ profiles }) {
  const config = window.DECENT_CONFIG.appointments;
  const form = document.getElementById('calendar-layer-form');
  const list = document.getElementById('calendar-layer-list');
  const status = document.getElementById('calendar-layer-status');
  const evidence = document.getElementById('calendar-layer-evidence');
  let client, generation = 0, selectedId = null;
  const store = createLayerStore({
    resolveAddress: input => profiles.address(input),
    async readWallet(address, limit) {
      if (!config?.address || !config?.runtimeCodeHash) throw new Error('Public appointment registry is not deployed and pinned. Availability is unknown, not empty.');
      if (!client) {
        const { loadEthers } = await import('../vendor/decent-head/2.0.0/js/wallet.js');
        const { Contract, JsonRpcProvider, FetchRequest, keccak256 } = await loadEthers();
        const request = new FetchRequest(window.DECENT_CONFIG.chain.rpcUrls[0]);
        request.timeout = 12000;
        client = createAppointmentClient({ config,
          provider: new JsonRpcProvider(request, 8453, { staticNetwork: true }),
          Contract, hashCode: keccak256, getSession: () => null });
      }
      return client.readWallet(address, limit);
    },
    onChange: render,
  });
  const action = (parent, label, handler, disabled = false) => {
    const button = node('button', label);
    button.type = 'button'; button.disabled = disabled;
    button.onclick = handler; parent.append(button);
    button.dataset.layerAction = label;
  };
  const projected = ownEvents => projectLayers(store.list(), { registry: config?.address, ownEvents });
  window.setCalendarLayerProjector(projected);
  window.refreshLayerEvidence = () => {
    const events = projected(window.getOwnCalendarEvidence());
    const candidates = events.filter(event => event.layerKind === 'candidate');
    evidence.hidden = !store.list().length;
    evidence.textContent = `${candidates.length} public window(s) · ${candidates.filter(event => event.conflictIds.length).length} known busy overlap(s) · ${candidates.filter(event => event.candidateOverlapIds.length).length} candidate overlap(s)`;
  };
  function render(layers) {
    const focused = document.activeElement;
    const focusedWallet = focused?.closest('.calendar-layer-card')?.dataset.layerWallet;
    const focusedAction = focused?.dataset.layerAction;
    const expanded = new Set([...list.querySelectorAll('.calendar-layer-card .ui-info[open]')].map(info => info.closest('.calendar-layer-card').dataset.layerWallet));
    list.replaceChildren();
    document.getElementById('refresh-calendar-layers').hidden = !layers.length;
    for (const layer of layers) {
      const card = node('section'); card.className = 'calendar-layer-card';
      card.dataset.layerWallet = layer.address;
      card.style.setProperty('--layer-color', layer.color);
      const label = node('label');
      const checkbox = node('input'); checkbox.type = 'checkbox'; checkbox.checked = layer.visible;
      checkbox.setAttribute('aria-label', `Show public layer: ${layer.label} (${layer.address})`);
      checkbox.dataset.layerAction = 'visibility';
      checkbox.onchange = () => store.toggle(layer.address, checkbox.checked);
      const shortAddress = `${layer.address.slice(0, 6)}…${layer.address.slice(-4)}`;
      label.append(checkbox, node('strong', layer.label === layer.address ? shortAddress : layer.label));
      const info = informationPanel(`Public layer wallet and read details: ${layer.label}`, [layer.address,
        'Public registry snapshot only. Private/external calendars, paid booking history and older unscanned records are not free time.']);
      info.open = expanded.has(layer.address);
      const state = node('p'); state.setAttribute('role', 'status');
      const prefix = layer.status === 'loading' ? 'Loading public Base records...' :
        layer.status === 'error' ? 'Unavailable — no availability known.' :
        layerStale(layer) ? 'Stale — Refresh before choosing.' : 'Base checked';
      state.textContent = `${layer.visible ? 'Shown' : 'Hidden'} · ${prefix} ${layer.error}`;
      if (layer.data) info.append(node('p', `Newest ${layer.data.offers.length} of ${layer.data.offerCount} offers / ${layer.data.appointments.length} of ${layer.data.appointmentCount} appointments. Checked ${new Date(layer.checkedAt).toLocaleString()}.`));
      card.append(label, info, state);
      action(card, 'Refresh', () => { void store.refresh(layer.address); }, layer.status === 'loading');
      if (layer.data && (layer.data.offerCount > BigInt(layer.limit) || layer.data.appointmentCount > BigInt(layer.limit))) {
        if (layer.limit < 100) action(info, 'Read newest 100', () => { void store.refresh(layer.address, 100); }, layer.status === 'loading');
        else info.append(node('p', 'Older records remain unscanned. Use their saved availability link or appointment ID.'));
      }
      action(card, 'Remove', () => store.remove(layer.address));
      list.append(card);
    }
    if (focusedWallet && focusedAction) {
      const replacement = list.querySelector(`[data-layer-wallet="${focusedWallet}"] [data-layer-action="${focusedAction}"]`);
      (replacement || form.querySelector('button[type="submit"]')).focus({ preventScroll: true });
    }
    window.refreshCalendar();
    if (selectedId) {
      const selected = projected(window.getOwnCalendarEvidence()).find(event => event.id === selectedId);
      if (selected) window.openCalendarLayerEvent(selected, { focus: false });
      else {
        selectedId = null;
        const detail = document.getElementById('calendar-layer-detail');
        detail.replaceChildren(); detail.hidden = true;
      }
    }
  }
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const request = generation;
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    status.textContent = 'Resolving wallet / ENS; reading Base...';
    try {
      const address = await store.add(form.elements.wallet.value, form.elements.consent.checked);
      if (request !== generation) return;
      status.textContent = '';
      form.reset();
    } catch (error) {
      if (request === generation) status.textContent = error.message;
    } finally { if (request === generation) button.disabled = false; }
  });
  document.getElementById('refresh-calendar-layers').onclick = () => {
    void Promise.all(store.list().map(layer => store.refresh(layer.address)));
  };
  window.openCalendarLayerEvent = (event, { focus = true } = {}) => {
    const changedSelection = selectedId !== event.id;
    selectedId = event.id;
    const detail = document.getElementById('calendar-layer-detail');
    if (changedSelection) delete detail.dataset.infoOpen;
    detail.replaceChildren(node('h3', event.title),
      node('p', `${event.layerKind === 'candidate' ? 'Candidate · not a booking' : event.layerKind === 'cancelled' ? 'Cancelled · not busy' : 'Confirmed · busy'}${event.stale ? ' · STALE: Refresh' : ''}`),
      node('p', `${new Date(event.start).toLocaleString()} – ${new Date(event.end).toLocaleString()}`));
    const info = informationPanel('Selected record wallets, source and overlap limits', [
      `Host timezone: ${event.timezone}. Host: ${event.hostWallet}. Invited wallet: ${event.invitedWallet}.`,
      `Source: Base appointment registry ${event.sourceRegistry}. Layers: ${event.layerLabels.join(', ')} (${event.layerWallets.join(', ')}).`,
      'Unknown private/external calendars and older records are not free time. Cancelled records are not busy.',
    ]);
    info.open = detail.dataset.infoOpen === 'true';
    info.ontoggle = () => { detail.dataset.infoOpen = String(info.open); };
    detail.append(info);
    if (event.layerKind === 'candidate') {
      detail.append(node('p', `${event.conflictIds.length} known busy overlap(s) · ${event.candidateOverlapIds.length} candidate overlap(s)`));
      info.append(node('p', 'Window-level overlap does not guarantee that a particular appointment fits. Only the invited wallet can book; the appointment screen rechecks Base before a transaction.'));
      const link = node('a', 'Choose a time');
      link.href = availabilityLink(location.href, event.availabilityId);
      link.onclick = click => {
        if (window.DCalAppointments?.openAvailability) {
          click.preventDefault(); window.DCalAppointments.openAvailability(event.availabilityId);
        }
      };
      detail.append(link);
    } else action(detail, 'Open actual appointment', () => window.DCalAppointments?.openAppointment(event.appointmentId));
    detail.hidden = false;
    const title = detail.querySelector('h3'); title.tabIndex = -1;
    if (focus) {
      title.focus({ preventScroll: true });
      detail.scrollIntoView({ block: 'nearest' });
    }
  };
  const timer = setInterval(() => { if (!document.hidden) store.tick(); }, 30000);
  const clear = () => {
    generation++; selectedId = null; store.clear(); form.reset();
    form.querySelector('button[type="submit"]').disabled = false;
    status.textContent = '';
    const detail = document.getElementById('calendar-layer-detail');
    detail.replaceChildren(); detail.hidden = true;
    delete detail.dataset.infoOpen;
  };
  return { clear, dispose() { clearInterval(timer); clear(); } };
}
