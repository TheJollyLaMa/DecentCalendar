/**
 * events.js — Event data layer for DecentCalendar vanilla
 * Uses localStorage keyed by wallet address (normalised to lowercase)
 */

/**
 * Fetch all public events saved for a given wallet address.
 * @param {string} address - Wallet address
 * @returns {Promise<Array>}
 */
export const fetchEventsForAddress = (address) => {
  return new Promise((resolve) => {
    if (!address || typeof address !== 'string' || !address.match(/^0x[0-9a-fA-F]{40}$/)) {
      resolve([]);
      return;
    }
    const normalizedAddress = address.toLowerCase();
    const events = JSON.parse(localStorage.getItem(normalizedAddress)) || [];

    const updatedEvents = events.map((event) => ({
      ...event,
      classNames: event.classNames || ['public-event'],
    }));

    console.log(`Fetched events for ${normalizedAddress}:`, updatedEvents);
    resolve(updatedEvents);
  });
};

/**
 * Save a single event for a wallet address.
 * @param {string} address - Wallet address
 * @param {object} event - Event object
 * @returns {Promise<void>}
 */
export const saveEvent = (address, event) => {
  return new Promise((resolve) => {
    const normalizedAddress = address.toLowerCase();
    const events = JSON.parse(localStorage.getItem(normalizedAddress)) || [];

    const updatedEvent = {
      ...event,
      classNames: event.classNames || ['public-event'],
    };

    events.push(updatedEvent);
    localStorage.setItem(normalizedAddress, JSON.stringify(events));
    console.log(`Saved event for ${normalizedAddress}:`, updatedEvent);
    resolve();
  });
};

/**
 * Get all events for a wallet address (alias for fetchEventsForAddress).
 * @param {string} address - Wallet address
 * @returns {Promise<Array>}
 */
export const getAllMyEvents = (address) => {
  return fetchEventsForAddress(address);
};

/**
 * Delete a single event by ID for a wallet address.
 * @param {string} address - Wallet address
 * @param {string} eventId - Event ID
 * @returns {Promise<void>}
 */
export const deleteEvent = (address, eventId) => {
  return new Promise((resolve) => {
    const normalizedAddress = address.toLowerCase();
    const events = JSON.parse(localStorage.getItem(normalizedAddress)) || [];
    const updated = events.filter((e) => e.id !== eventId);
    localStorage.setItem(normalizedAddress, JSON.stringify(updated));
    console.log(`Deleted event ${eventId} for ${normalizedAddress}`);
    resolve();
  });
};
