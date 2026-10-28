import { getAsset, parseAmount } from './assets.js';

export const MAX_BACKUP_BYTES = 2 * 1024 * 1024;
const MAX_EVENTS = 2000;
const ADDRESS = /^0x[0-9a-f]{40}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})?$/;
const text = (value, limit, field) => {
  if (typeof value !== 'string' || value.length > limit) throw new Error(`Invalid ${field}.`);
  return value;
};
const address = value => {
  if (!ADDRESS.test(value)) throw new Error('Invalid calendar owner address.');
  return value.toLowerCase();
};

function eventsForOwner(events, owner) {
  if (!Array.isArray(events) || events.length > MAX_EVENTS) throw new Error('Expected at most 2,000 calendar events.');
  return events.map(event => {
    if (!event || typeof event !== 'object' || Array.isArray(event)) throw new Error('Invalid calendar event.');
    if (address(event.owner || event.creator) !== owner ||
        (event.creator && address(event.creator) !== owner)) throw new Error('Event belongs to another wallet.');
    if (typeof event.isPublic !== 'boolean') throw new Error('Every event must explicitly declare public or private visibility.');
    const start = text(event.start, 40, 'start');
    const end = text(event.end, 40, 'end');
    if (!DATE.test(start) || !DATE.test(end) || !Number.isFinite(Date.parse(start)) ||
        !Number.isFinite(Date.parse(end)) || Date.parse(end) <= Date.parse(start)) {
      throw new Error('Event must have valid start and end times, with end after start.');
    }
    if (!Number.isFinite(event.hourlyRate) || event.hourlyRate < 0) throw new Error('Invalid hourly rate.');
    const result = {
      version: '0.1', type: 'timeslot', owner, creator: owner,
      title: text(event.title, 300, 'title'), description: text(event.description || '', 4000, 'description'),
      start, end, hourlyRate: event.hourlyRate,
      currency: text(event.currency || 'POL', 12, 'currency'),
      isPublic: event.isPublic,
      classNames: [event.isPublic ? 'public-event' : 'private-event'],
    };
    if (event.assetId !== undefined) {
      const asset = getAsset(event.assetId);
      parseAmount(event.rateAmount, asset.decimals);
      if (event.currency !== asset.symbol) throw new Error('Currency does not match the identified asset.');
      result.assetId = asset.id;
      result.rateAmount = event.rateAmount;
    }
    if (event.hardline !== undefined) {
      if (typeof event.hardline !== 'boolean') throw new Error('Invalid hardline option.');
      result.hardline = event.hardline;
    }
    for (const field of ['id', 'date', 'startTime', 'endTime', 'timezone', 'status', 'meetingRoomId', 'createdAt', 'ipfsCID', 'buyer', 'paypalOrderId']) {
      if (event[field] !== undefined && event[field] !== null) result[field] = text(event[field], 500, field);
    }
    if (event.tokenId !== undefined && event.tokenId !== null) {
      if (!(Number.isSafeInteger(event.tokenId) && event.tokenId >= 0) &&
          !(typeof event.tokenId === 'string' && /^\d{1,78}$/.test(event.tokenId))) throw new Error('Invalid token ID.');
      result.tokenId = event.tokenId;
    }
    if (event.durationMinutes !== undefined) {
      if (!Number.isFinite(event.durationMinutes) || event.durationMinutes < 0) throw new Error('Invalid duration.');
      result.durationMinutes = event.durationMinutes;
    }
    if (event.fiatOptions !== undefined) {
      const fiat = event.fiatOptions;
      if (!fiat || typeof fiat.paypal !== 'boolean' || typeof fiat.card !== 'boolean' ||
          !Number.isFinite(fiat.fiatRateUSD) || fiat.fiatRateUSD < 0) throw new Error('Invalid legacy fiat options.');
      result.fiatOptions = { paypal: fiat.paypal, card: fiat.card, fiatRateUSD: fiat.fiatRateUSD };
    }
    return result;
  });
}

export function readLocalCalendar(storage, wallet) {
  const owner = address(wallet);
  const raw = storage.getItem(owner);
  if (raw === null) return [];
  if (new TextEncoder().encode(raw).length > MAX_BACKUP_BYTES) throw new Error('Local calendar exceeds the 2 MiB backup limit.');
  return eventsForOwner(JSON.parse(raw), owner);
}

export function createLocalBackup(storage, wallet) {
  const owner = address(wallet);
  return validateDocument({
    app: 'DecentCalendar', version: 1, kind: 'local-backup', owner, events: readLocalCalendar(storage, owner),
  }, 'local-backup');
}

export function validateDocument(document, kind) {
  if (!document || document.app !== 'DecentCalendar' || document.version !== 1 || document.kind !== kind) {
    throw new Error(`Expected a DecentCalendar v1 ${kind} document.`);
  }
  if (new TextEncoder().encode(JSON.stringify(document)).length > MAX_BACKUP_BYTES) throw new Error('Calendar document exceeds 2 MiB.');
  const owner = address(document.owner);
  const events = eventsForOwner(document.events, owner);
  if (kind === 'public-availability' && events.some(event => !event.isPublic)) {
    throw new Error('Public availability cannot contain private events.');
  }
  return { app: 'DecentCalendar', version: 1, kind, owner, events };
}

export function restoreLocalBackup(storage, wallet, document) {
  const owner = address(wallet);
  const backup = validateDocument(document, 'local-backup');
  if (backup.owner !== owner) throw new Error('Connect the wallet that owns this backup.');
  storage.setItem(owner, JSON.stringify(backup.events));
  return backup.events.length;
}

export function createPublicAvailability(storage, wallet) {
  const backup = createLocalBackup(storage, wallet);
  return {
    app: 'DecentCalendar', version: 1, kind: 'public-availability', owner: backup.owner,
    events: backup.events.filter(event => event.isPublic).map(event => ({
      version: '0.1', type: 'timeslot', owner: backup.owner, creator: backup.owner,
      title: event.title, description: event.description, start: event.start, end: event.end,
      hourlyRate: event.hourlyRate, currency: event.currency, isPublic: true,
      ...(event.assetId ? { assetId: event.assetId, rateAmount: event.rateAmount } : {}),
      ...(event.hardline !== undefined ? { hardline: event.hardline } : {}),
    })),
  };
}

export function importPublicAvailability(document) {
  const valid = validateDocument(document, 'public-availability');
  // Remote availability is display data, never proof of a booking or meeting access.
  return { owner: valid.owner, events: valid.events.map(event => ({
    title: event.title, description: event.description, start: event.start, end: event.end,
    owner: valid.owner, creator: valid.owner, hourlyRate: event.hourlyRate,
    currency: event.currency, isPublic: true, classNames: ['imported-event'], readOnly: true,
    ...(event.assetId ? { assetId: event.assetId, rateAmount: event.rateAmount } : {}),
    ...(event.hardline !== undefined ? { hardline: event.hardline } : {}),
  })) };
}
