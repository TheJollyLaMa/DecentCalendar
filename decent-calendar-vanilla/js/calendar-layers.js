import { inviteAddress } from './invitations.js';
import { availableChoices, appointmentCalendarEvent } from './appointments.js';

export const LAYER_COLORS = ['#8bd5ff', '#ffc477', '#d6acff', '#92e6b5', '#ffaac4', '#fff08a'];
export const LAYER_STALE_MS = 60000;
const same = (a, b) => String(a).toLowerCase() === String(b).toLowerCase();
export const overlaps = (a, b) => Date.parse(a.start) < Date.parse(b.end) && Date.parse(b.start) < Date.parse(a.end);

export function createLayerStore({ resolveAddress, readWallet, onChange = () => {}, now = Date.now }) {
  const layers = new Map();
  let generation = 0;
  const notify = () => onChange([...layers.values()]);
  async function refresh(address, limit) {
    const layer = layers.get(address);
    if (!layer || layer.status === 'loading') return;
    const request = generation;
    layer.limit = limit ?? layer.limit;
    layer.status = 'loading'; layer.error = ''; notify();
    try {
      const data = await readWallet(address, layer.limit);
      if (generation !== request || layers.get(address) !== layer) return;
      if (!Array.isArray(data.offers) || !Array.isArray(data.appointments)) throw new Error('Public registry response is incomplete.');
      layer.data = data; layer.checkedAt = now(); layer.status = 'ready';
    } catch (error) {
      if (generation !== request || layers.get(address) !== layer) return;
      layer.status = layer.data ? 'stale' : 'error';
      layer.error = error.shortMessage || error.message || 'Public registry unavailable.';
    }
    notify();
  }
  return {
    list: () => [...layers.values()],
    async add(input, consent) {
      if (consent !== true) throw new Error('Approve the public ENS / Base read before adding a layer.');
      const request = generation;
      const address = inviteAddress(await resolveAddress(input.trim()));
      if (request !== generation) return;
      if (layers.has(address)) throw new Error('That wallet already has a layer. Use its checkbox or Refresh.');
      if (layers.size >= LAYER_COLORS.length) throw new Error('Use at most six public layers. Remove one before adding another.');
      const color = LAYER_COLORS.find(value => ![...layers.values()].some(layer => layer.color === value));
      layers.set(address, { address, label: input.trim(), color,
        visible: true, status: 'idle', limit: 20, data: null, checkedAt: null, error: '' });
      await refresh(address);
      return address;
    },
    refresh,
    toggle(address, visible) {
      const layer = layers.get(address);
      if (layer) { layer.visible = !!visible; notify(); }
    },
    remove(address) { layers.delete(address); notify(); },
    clear() { generation++; layers.clear(); notify(); },
    tick() { notify(); },
  };
}

export function layerStale(layer, now = Date.now()) {
  return layer.status !== 'ready' || now - layer.checkedAt >= LAYER_STALE_MS;
}

export function projectLayers(layers, { registry, now = Date.now(), ownEvents = [] } = {}) {
  if (!layers.some(layer => layer.visible && layer.data)) return [];
  registry = inviteAddress(registry);
  const events = new Map();
  const seconds = BigInt(Math.floor(now / 1000));
  const visibleLayers = layers.filter(item => item.visible && item.data);
  const latestOffers = new Map(), latestAppointments = new Map();
  for (const layer of visibleLayers) {
    for (const [items, cache] of [[layer.data.offers, latestOffers], [layer.data.appointments, latestAppointments]]) {
      for (const item of items) {
        const previous = cache.get(String(item.id));
        if (!previous || item.now > previous.now) cache.set(String(item.id), item);
      }
    }
  }
  for (const layer of visibleLayers) {
    const stale = layerStale(layer, now);
    const add = event => {
      const existing = events.get(event.id);
      if (existing) {
        existing.layerWallets.push(layer.address);
        existing.layerLabels.push(layer.label);
        existing.stale ||= stale;
        return;
      }
      events.set(event.id, { ...event, readOnly: true, calendarLayer: true, stale,
        sourceRegistry: registry, layerWallets: [layer.address], layerLabels: [layer.label],
        backgroundColor: layer.color, borderColor: layer.color });
    };
    for (const sourceOffer of layer.data.offers) {
      const offer = latestOffers.get(String(sourceOffer.id));
      if (![offer.host, offer.invitee].some(wallet => same(wallet, layer.address))) continue;
      const groups = new Map();
      // Only contiguous future choices actually exposed by the public policy are candidates.
      for (const choice of availableChoices(offer, seconds > offer.now ? seconds : offer.now, offer.bookedDays)) {
        const group = groups.get(choice.windowIndex);
        if (group) group.end = choice.end;
        else groups.set(choice.windowIndex, { ...choice });
      }
      for (const [windowIndex, choice] of groups) add({
        id: `availability:${registry}:${offer.id}:${windowIndex}`,
        availabilityId: String(offer.id), windowIndex, title: offer.subject,
        creator: offer.host, attendees: [offer.invitee], timezone: offer.timezone,
        start: new Date(Number(choice.start) * 1000).toISOString(),
        end: new Date(Number(choice.end) * 1000).toISOString(),
        layerKind: 'candidate', classNames: ['layer-candidate'],
        hostWallet: offer.host, invitedWallet: offer.invitee,
      });
    }
    for (const sourceItem of layer.data.appointments) {
      const item = latestAppointments.get(String(sourceItem.id));
      if (![item.host, item.invitee].some(wallet => same(wallet, layer.address))) continue;
      add({ ...appointmentCalendarEvent(item, registry), layerKind: item.cancelled ? 'cancelled' : 'busy',
        classNames: [item.cancelled ? 'layer-cancelled' : 'layer-busy'],
        hostWallet: item.host, invitedWallet: item.invitee });
    }
  }
  const own = new Map(ownEvents.map(event => [event.id, event]));
  const conflictRecords = new Map(events);
  for (const event of ownEvents) {
    const publicRecord = conflictRecords.get(event.id);
    if (!publicRecord || BigInt(event.checkedAt || 0) > BigInt(publicRecord.checkedAt || 0)) conflictRecords.set(event.id, event);
  }
  const busy = [...conflictRecords.values()].filter(event => !event.cancelled &&
    (event.layerKind === 'busy' || event.appointmentSnapshot ||
      event.registrySnapshot && event.attendees?.length ||
      !event.readOnly && !event.calendarLayer && event.isPublic === false));
  return [...events.values()].filter(event => !own.has(event.id)).map(event => {
    if (event.layerKind !== 'candidate') return event;
    return { ...event, conflictIds: [...new Set(busy.filter(item => overlaps(event, item)).map(item => item.id))],
      candidateOverlapIds: [...events.values()].filter(item =>
        item.layerKind === 'candidate' && item.id !== event.id && overlaps(event, item)).map(item => item.id) };
  });
}
