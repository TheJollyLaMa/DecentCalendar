import { bookingId, SEAT_STATES } from './booking-client.js';

const ADDRESS = /^0x[0-9a-f]{40}$/i;
export function inviteAddress(value) {
  if (typeof value !== 'string' || !ADDRESS.test(value) || /^0x0{40}$/i.test(value)) {
    throw new Error('Invitation recipient must be a non-zero wallet address.');
  }
  return value.toLowerCase();
}

export function timeboxLink(base, id, recipient) {
  const url = new URL(base);
  if (!['https:', 'http:'].includes(url.protocol)) throw new Error('Unsupported timebox URL.');
  url.search = ''; url.hash = '';
  url.searchParams.set('booking', bookingId(id).toString());
  if (recipient) url.searchParams.set('invite', inviteAddress(recipient));
  return url.href;
}

// Link metadata is an untrusted greeting, never a signature or seat reservation.
export function invitationRecipient(href, id) {
  const url = new URL(href);
  if (!url.searchParams.has('invite') || url.searchParams.get('booking') !== String(id)) return null;
  return inviteAddress(url.searchParams.get('invite'));
}

export function invitationState(address, seats) {
  const seat = seats.find(seat => seat.attendee.toLowerCase() === address.toLowerCase());
  return seat ? `${SEAT_STATES[seat.state]} (chain)` : 'Invited locally; not joined at last chain check';
}

export function createInvitationStore(storage, { registry, host, id }) {
  const key = `dcal:invitations:8453:${inviteAddress(registry)}:${inviteAddress(host)}:${bookingId(id)}`;
  const read = () => {
    const raw = storage.getItem(key);
    if (raw === null) return [];
    const records = JSON.parse(raw);
    if (!Array.isArray(records) || records.length > 200) throw new Error('Invalid local invitation list.');
    return records.map(inviteAddress);
  };
  return {
    read,
    add(value) {
      const address = inviteAddress(value), records = read();
      if (!records.includes(address)) records.push(address);
      if (records.length > 200) throw new Error('Local invitation list is full (200).');
      storage.setItem(key, JSON.stringify(records));
      return records;
    },
    remove(value) {
      const records = read().filter(address => address !== inviteAddress(value));
      storage.setItem(key, JSON.stringify(records));
      return records;
    },
  };
}

function utc(value) {
  const date = new Date(Number(value) * 1000);
  if (!Number.isFinite(date.getTime())) throw new Error('Invalid timebox date.');
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}
const escapeICS = text => String(text).replace(/\\/g, '\\\\').replace(/\r\n|\r|\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,');

// RFC 5545 limits content lines to 75 UTF-8 octets (including continuation space).
export function foldICS(line) {
  const encoder = new TextEncoder();
  let part = '', size = 0;
  const lines = [];
  for (const char of line) {
    const length = encoder.encode(char).length;
    if (size + length > 75) { lines.push(part); part = ' '; size = 1; }
    part += char; size += length;
  }
  return [...lines, part].join('\r\n');
}

function calendarTerms(slot, link) {
  if (BigInt(slot.end) <= BigInt(slot.start)) throw new Error('Invalid timebox interval.');
  return {
    start: utc(slot.start), end: utc(slot.end),
    description: `Public DCal timebox. Host: ${slot.host}. Host timezone: ${slot.hostTimezone}. ${slot.hardline ? 'Fixed-end hardline requested.' : 'No hardline.'} Adding this event does not join, pay, reserve a seat or grant meeting access. Review current terms and state on Base: ${link}`,
  };
}

export function calendarICS(slot, { registry, base, now = new Date() }) {
  const link = timeboxLink(base, slot.id);
  const terms = calendarTerms(slot, link);
  const uid = `8453-${inviteAddress(registry)}-${bookingId(slot.id)}@decentcalendar`;
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//DecentCalendar//Timebox//EN',
    'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'BEGIN:VEVENT',
    `UID:${uid}`, `DTSTAMP:${utc(now.getTime() / 1000)}`,
    `DTSTART:${terms.start}`, `DTEND:${terms.end}`,
    `STATUS:${slot.state === 1 ? 'CANCELLED' : 'TENTATIVE'}`,
    `SUMMARY:${escapeICS(slot.subject)}`, `DESCRIPTION:${escapeICS(terms.description)}`,
    `URL:${link}`, 'END:VEVENT', 'END:VCALENDAR',
  ].map(foldICS).join('\r\n') + '\r\n';
}

export function googleCalendarLink(slot, { base }) {
  const terms = calendarTerms(slot, timeboxLink(base, slot.id));
  const url = new URL('https://calendar.google.com/calendar/render');
  url.search = new URLSearchParams({
    action: 'TEMPLATE', text: slot.subject,
    dates: `${terms.start}/${terms.end}`, details: terms.description,
  }).toString();
  return url.href;
}

export async function shareInvitation({ url, title }, navigatorObject = navigator) {
  let unavailable = '';
  if (typeof navigatorObject.share === 'function') {
    try { await navigatorObject.share({ title, url }); return 'Shared using your device. Delivery is not confirmed by DCal.'; }
    catch (error) {
      if (error.name === 'AbortError') return 'Share cancelled; nothing was sent by DCal.';
      unavailable = `Device share unavailable (${error.message}). `;
    }
  }
  if (!navigatorObject.clipboard?.writeText) throw new Error('Sharing and clipboard are unavailable. Select and copy the displayed link.');
  await navigatorObject.clipboard.writeText(url);
  return `${unavailable}Link copied. Send it yourself; DCal has not delivered an invitation.`;
}
