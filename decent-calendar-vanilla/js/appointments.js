import { validTimeZone, localInputToUtc, dateInZone } from './timezones.js';
import { inviteAddress, foldICS, DEVICE_REMINDER, googleEventLink } from './invitations.js';
import { bookingId } from './booking-client.js';

export const APPOINTMENT_VERSION = 'dcal-appointments-1';
export function availabilityLink(base, id) {
  const url = new URL(base);
  if (!['https:', 'http:'].includes(url.protocol)) throw new Error('Unsupported availability URL.');
  url.search = ''; url.hash = '';
  url.searchParams.set('availability', bookingId(id).toString());
  return url.href;
}
export function appointmentWindows({ firstDate, lastDate, timezone, ranges, weekdays = [1, 2, 3, 4], duration = 1800 }) {
  if (!validTimeZone(timezone) || ![900, 1800, 3600].includes(duration)) throw new Error('Choose a valid timezone and 15, 30 or 60 minute duration.');
  if (!Array.isArray(weekdays) || !weekdays.length || weekdays.some(day => !Number.isInteger(day) || day < 0 || day > 6)) throw new Error('Choose at least one weekday.');
  if (!Array.isArray(ranges) || !ranges.length || ranges.length > 2) throw new Error('Choose one or two daily windows.');
  localInputToUtc(`${firstDate}T12:00`, timezone);
  localInputToUtc(`${lastDate}T12:00`, timezone);
  const from = Date.parse(`${firstDate}T12:00:00Z`), through = Date.parse(`${lastDate}T12:00:00Z`);
  if (through < from || through - from > 30 * 86400000) throw new Error('Choose a range of at most 31 days.');
  const windows = [];
  for (let day = from; day <= through; day += 86400000) {
    const date = new Date(day).toISOString().slice(0, 10);
    if (!weekdays.includes(new Date(day).getUTCDay())) continue;
    for (const [startTime, endTime] of ranges) {
      const start = BigInt(Date.parse(localInputToUtc(`${date}T${startTime}`, timezone)) / 1000);
      const end = BigInt(Date.parse(localInputToUtc(`${date}T${endTime}`, timezone)) / 1000);
      windows.push({ start, end, day: Number(date.replaceAll('-', '')) });
    }
  }
  validateAvailability({ timezone, duration, windows });
  return windows;
}
export function validateAvailability(offer) {
  if (!validTimeZone(offer.timezone) || ![900, 1800, 3600].includes(Number(offer.duration)) ||
      !Array.isArray(offer.windows) || !offer.windows.length || offer.windows.length > 62) throw new Error('Invalid availability policy.');
  let previous;
  for (const window of offer.windows) {
    const start = BigInt(window.start), end = BigInt(window.end);
    if (start < 0n || end > 253402300799n || end - start < BigInt(offer.duration) || end - start > 86400n ||
        previous && start < previous.end) throw new Error('Availability windows overlap or have invalid lengths.');
    const day = dateInZone(Number(start) * 1000, offer.timezone).replaceAll('-', '');
    if (Number(day) !== Number(window.day) || dateInZone(Number(end - 1n) * 1000, offer.timezone).replaceAll('-', '') !== day) {
      throw new Error('Availability day does not match the host timezone.');
    }
    previous = { end };
  }
  return offer;
}
export function availableChoices(offer, now, bookedDays = new Set()) {
  validateAvailability(offer);
  if (offer.closed) return [];
  const choices = [];
  offer.windows.forEach((window, windowIndex) => {
    if (bookedDays.has(Number(window.day))) return;
    for (let start = BigInt(window.start); start + BigInt(offer.duration) <= BigInt(window.end); start += BigInt(offer.duration)) {
      if (start > BigInt(now)) choices.push({ windowIndex, day: Number(window.day), start, end: start + BigInt(offer.duration) });
    }
  });
  return choices;
}
export function appointmentCalendarEvent(item, registry) {
  return {
    id: `appointment:${inviteAddress(registry)}:${item.id}`,
    appointmentId: item.id.toString(), availabilityId: item.offerId.toString(),
    title: item.subject, creator: item.host, attendees: [item.invitee],
    start: new Date(Number(item.start) * 1000).toISOString(), end: new Date(Number(item.end) * 1000).toISOString(),
    timezone: item.timezone, appointmentSnapshot: true, checkedAt: item.now.toString(),
    cancelled: item.cancelled, classNames: ['registry-event'],
  };
}
export function appointmentICS(item, { registry, base, now = new Date() }) {
  if (BigInt(item.end) <= BigInt(item.start)) throw new Error('Invalid appointment interval.');
  const stamp = value => new Date(value).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const escape = value => String(value).replace(/\\/g, '\\\\').replace(/\r\n|\r|\n/g, '\\n').replace(/[,;]/g, char => `\\${char}`);
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//DecentCalendar//Appointments//EN', 'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT', `UID:8453-${inviteAddress(registry)}-${bookingId(item.id)}@appointments.decentcalendar`,
    `DTSTAMP:${stamp(now)}`, `DTSTART:${stamp(Number(item.start) * 1000)}`, `DTEND:${stamp(Number(item.end) * 1000)}`,
    `STATUS:${item.cancelled ? 'CANCELLED' : 'CONFIRMED'}`, `SUMMARY:${escape(item.subject)}`,
    `DESCRIPTION:${escape(`Free appointment. Host timezone: ${item.timezone}. Static reminder; refresh Base for changes. No meeting access or task payment is granted.`)}`,
    `URL:${availabilityLink(base, item.offerId)}`, ...(item.cancelled ? [] : DEVICE_REMINDER),
    'END:VEVENT', 'END:VCALENDAR'].map(foldICS).join('\r\n') + '\r\n';
}
export function appointmentGoogleLink(item, { base }) {
  if (item.cancelled) throw new Error('Cancelled appointments cannot be added through a Google template.');
  return googleEventLink({
    subject: item.subject, start: item.start, end: item.end,
    description: `Confirmed free DCal appointment. Host timezone: ${item.timezone}. Static calendar copy; check Base for changes: ${availabilityLink(base, item.offerId)}. No meeting access or task payment is granted.`,
  });
}
