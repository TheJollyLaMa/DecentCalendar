// Mirrors DCalBooking.validTimezone; Intl then confirms the zone is real.
const ZONE = /^[A-Za-z0-9/_+-]{1,64}$/;

export function localTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

export function validTimeZone(zone) {
  if (typeof zone !== 'string' || !ZONE.test(zone)) return false;
  try { new Intl.DateTimeFormat('en-US', { timeZone: zone }); return true; }
  catch { return false; }
}

function parts(date, zone) {
  const values = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: zone, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric',
  }).formatToParts(date).map(part => [part.type, part.value]));
  return { ...values, wall: Date.UTC(+values.year, +values.month - 1, +values.day, +values.hour, +values.minute) };
}

// Adapted from Busking's newYorkInputToUtc; ambiguous repeated times require a different choice.
export function localInputToUtc(value, zone) {
  if (!validTimeZone(zone)) throw new Error('Choose a valid IANA timezone.');
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value || '');
  if (!match) throw new Error('Choose a valid local date and time.');
  const [year, month, day, hour, minute] = match.slice(1).map(Number);
  const target = Date.UTC(year, month - 1, day, hour, minute), date = new Date(target);
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day || hour > 23 || minute > 59) {
    throw new Error('Choose a valid local date and time.');
  }
  const matches = new Set();
  for (const offset of [-86400000, 0, 86400000]) {
    let epoch = target + offset;
    for (let attempt = 0; attempt < 5; attempt++) {
      const displayed = parts(new Date(epoch), zone).wall;
      if (displayed === target) { matches.add(epoch); break; }
      epoch += target - displayed;
    }
  }
  if (matches.size !== 1) throw new Error('This local time is missing or ambiguous because of a daylight-saving change. Choose another time.');
  return new Date([...matches][0]).toISOString();
}

export function dateInZone(value, zone) {
  const p = parts(new Date(value), zone);
  return `${p.year}-${p.month.padStart(2, '0')}-${p.day.padStart(2, '0')}`;
}

function offsetLabel(minutes) {
  if (minutes === 0) return 'same time as you';
  const sign = minutes > 0 ? '+' : '-', abs = Math.abs(minutes);
  return `${sign}${Math.floor(abs / 60)}h${abs % 60 ? String(abs % 60).padStart(2, '0') : ''} vs you`;
}

/**
 * Compact counterpart time, e.g. "🌙 2:00 AM - 3:00 AM Thu for host (Asia/Tokyo, +13h vs you, +1 day)".
 * DST is handled by Intl at the exact instant, so the offset may differ between dates.
 */
export function counterpartTime(start, end, zone, who = 'them', viewerZone = localTimeZone()) {
  if (!validTimeZone(zone)) return `${who}: timezone unavailable`;
  const from = new Date(start), to = new Date(end);
  const time = date => new Intl.DateTimeFormat(undefined, { timeZone: zone, hour: 'numeric', minute: '2-digit' }).format(date);
  const day = new Intl.DateTimeFormat(undefined, { timeZone: zone, weekday: 'short' }).format(from);
  const theirs = parts(from, zone), mine = parts(from, viewerZone);
  const dayShift = Math.round((Date.UTC(+theirs.year, +theirs.month - 1, +theirs.day) - Date.UTC(+mine.year, +mine.month - 1, +mine.day)) / 86400000);
  const hour = +theirs.hour;
  const icon = hour >= 7 && hour < 21 ? '☀' : '🌙';
  const details = [zone, offsetLabel(Math.round((theirs.wall - mine.wall) / 60000))];
  if (dayShift) details.push(`${dayShift > 0 ? '+' : ''}${dayShift} day`);
  return `${icon} ${time(from)} - ${time(to)} ${day} for ${who} (${details.join(', ')})`;
}
