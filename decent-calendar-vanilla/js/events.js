/* events.js — Event data layer: localStorage + IPFS */

/**
 * IPFS / localStorage JSON schema for a timeslot:
 * {
 *   version: "0.1",
 *   type: "timeslot",
 *   tokenId: null,
 *   owner: "0xABC...123",
 *   title: "IT Consultation",
 *   description: "",
 *   date: "2026-04-01",
 *   startTime: "14:00",
 *   endTime: "15:00",
 *   timezone: "America/Los_Angeles",
 *   durationMinutes: 60,
 *   hourlyRate: 0.05,
 *   currency: "POL",
 *   status: "available",
 *   meetingRoomId: null,
 *   fiatOptions: { paypal: true, card: true, fiatRateUSD: 0 },
 *   isPublic: true,
 *   classNames: ["public-event"],
 *   createdAt: "",
 *   ipfsCID: null
 * }
 */

/**
 * Save an event to localStorage and optionally upload to IPFS.
 * @param {string} address - wallet address (owner)
 * @param {object} event - event object
 * @returns {object} saved event (with ipfsCID if uploaded)
 */
async function saveEvent(address, event) {
  const key = address.toLowerCase();
  const events = loadEventsRaw(key);

  // Ensure required fields
  const eventToSave = {
    version: '0.1',
    type: 'timeslot',
    tokenId: event.tokenId ?? null,
    owner: address,
    title: event.title || 'Untitled',
    description: event.description || '',
    date: event.date || '',
    startTime: event.startTime || '',
    endTime: event.endTime || '',
    timezone: event.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
    durationMinutes: event.durationMinutes || 0,
    hourlyRate: parseFloat(event.hourlyRate) || 0,
    currency: event.currency || 'ETH',
    status: event.status || 'available',
    meetingRoomId: event.meetingRoomId || `meeting-${Date.now()}-${address}`,
    fiatOptions: event.fiatOptions || { paypal: true, card: true, fiatRateUSD: 0 },
    isPublic: event.isPublic !== undefined ? event.isPublic : true,
    classNames: event.classNames || (event.isPublic !== false ? ['public-event'] : ['private-event']),
    creator: address,
    // FullCalendar fields
    start: event.start || '',
    end: event.end || '',
    createdAt: event.createdAt || new Date().toISOString(),
    ipfsCID: event.ipfsCID || null,
  };

  // Publication is a separate preview-and-consent action in calendar-storage.js.
  events.push(eventToSave);
  localStorage.setItem(key, JSON.stringify(events));
  console.log(`Saved event for ${key}:`, eventToSave);
  return eventToSave;
}

/**
 * Load all events for an address from localStorage (raw, no transform).
 */
function loadEventsRaw(address) {
  const key = address.toLowerCase();
  const raw = localStorage.getItem(key);
  if (raw === null) return [];
  const events = JSON.parse(raw);
  if (!Array.isArray(events)) throw new Error('Stored calendar is not an event array. Export the original data before attempting recovery.');
  return events;
}

/**
 * Load events for the connected wallet (my events).
 */
function loadMyEvents(address) {
  const events = loadEventsRaw(address);
  return events.map((e) => ({
    ...e,
    classNames: e.classNames || ['public-event'],
  }));
}

/**
 * Fetch public events for a given wallet address.
 * Reads from localStorage; if an event has an ipfsCID, optionally fetch fresh data.
 */
async function fetchPublicEventsForAddress(address) {
  const key = address.toLowerCase();
  const events = loadEventsRaw(key);
  const publicEvents = events.filter((e) => e.isPublic !== false);
  return publicEvents.map((e) => ({
    ...e,
    classNames: e.classNames || ['public-event'],
  }));
}

/**
 * Delete an event from localStorage by its id or start time.
 */
function deleteEvent(address, eventId) {
  const key = address.toLowerCase();
  let events = loadEventsRaw(key);
  events = events.filter((e) => e.id !== eventId && e.start !== eventId);
  localStorage.setItem(key, JSON.stringify(events));
}

/**
 * Generate a deterministic HSL color from a wallet address.
 */
function generateColorForAddress(address) {
  const hash = address.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const hue = hash % 360;
  return `hsl(${hue}, 70%, 50%)`;
}
