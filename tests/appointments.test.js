import test from 'node:test';
import assert from 'node:assert/strict';
import { appointmentWindows, availableChoices, availabilityLink, validateAvailability, appointmentCalendarEvent, appointmentICS, appointmentGoogleLink } from '../decent-calendar-vanilla/js/appointments.js';
import { localInputToUtc } from '../decent-calendar-vanilla/js/timezones.js';
import { createAppointmentClient } from '../decent-calendar-vanilla/js/appointment-client.js';

const draft = () => ({ firstDate:'2026-11-09', lastDate:'2026-11-12', timezone:'America/New_York', duration:1800,
  ranges:[['07:00','10:00'],['15:00','19:00']] });
const offer = () => ({ ...draft(), windows:appointmentWindows(draft()), closed:false });
const before = BigInt(Date.parse('2026-11-08T12:00Z') / 1000);
test('requested four days expose exactly 14 half-hour choices each, bounded by 7-10 and 15-19 New York', () => {
  const choices = availableChoices(offer(), before);
  assert.equal(choices.length, 56);
  for (const day of [20261109,20261110,20261111,20261112]) assert.equal(choices.filter(choice => choice.day === day).length,14);
  const monday = choices.filter(choice => choice.day === 20261109);
  assert.equal(new Date(Number(monday[0].start)*1000).toISOString(),'2026-11-09T12:00:00.000Z');
  assert.equal(new Date(Number(monday[5].start)*1000).toISOString(),'2026-11-09T14:30:00.000Z');
  assert.equal(new Date(Number(monday[6].start)*1000).toISOString(),'2026-11-09T20:00:00.000Z');
  assert.equal(new Date(Number(monday[13].start)*1000).toISOString(),'2026-11-09T23:30:00.000Z');
  assert.ok(choices.every(choice => choice.end-choice.start === 1800n));
});
test('booked days, elapsed choices and closed availability are not offered again', () => {
  assert.equal(availableChoices(offer(),before,new Set([20261109])).length,42);
  const first = availableChoices(offer(),before)[0];
  assert.equal(availableChoices(offer(),first.start).length,55);
  assert.deepEqual(availableChoices({...offer(),closed:true},before),[]);
});
test('invalid intervals, timezone/day mismatches, excessive ranges and DST ambiguity fail explicitly', () => {
  for(const change of [
    {lastDate:'2026-12-10'}, {lastDate:'2026-11-08'}, {firstDate:'2026-02-30'},
    {timezone:'not/a-zone'}, {duration:60}, {weekdays:[]},
    {ranges:[['07:00','10:00'],['09:30','19:00']]}, {ranges:[['23:00','01:00']]},
  ]) assert.throws(()=>appointmentWindows({...draft(),...change}));
  const bad = offer(); bad.windows[0].day=20261110;
  assert.throws(()=>validateAvailability(bad),/timezone/);
  assert.throws(()=>localInputToUtc('2026-03-08T02:30','America/New_York'),/daylight-saving/);
  assert.throws(()=>localInputToUtc('2026-11-01T01:30','America/New_York'),/daylight-saving/);
  assert.equal(localInputToUtc('2026-03-09T07:00','America/New_York'),'2026-03-09T11:00:00.000Z');
  assert.equal(localInputToUtc('2026-11-09T07:00','America/New_York'),'2026-11-09T12:00:00.000Z');
});
test('availability links contain only a real positive ID, not private draft details', () => {
  assert.equal(availabilityLink('https://example.test/Calendar/?secret=private#room',5n),'https://example.test/Calendar/?availability=5');
  for(const id of [0,'1e2','-1','abc']) assert.throws(()=>availabilityLink('https://example.test/',id));
  assert.throws(()=>availabilityLink('javascript:alert(1)',1));
});
test('appointment snapshots and calendar exports are exact, stable and not payment claims', () => {
  const registry='0x'+'11'.repeat(20);
  const item={id:2n,offerId:1n,host:registry,invitee:'0x'+'22'.repeat(20),subject:'Check-in, music\\notes\nBEGIN:FAKE',
    timezone:'America/New_York',now:before,...availableChoices(offer(),before)[0],cancelled:false};
  const event=appointmentCalendarEvent(item,registry);
  assert.equal(event.id,`appointment:${registry}:2`);
  assert.equal(event.start,'2026-11-09T12:00:00.000Z');
  const ics=appointmentICS(item,{registry,base:'https://example.test/',now:new Date('2026-11-08T12:00Z')});
  assert.match(ics,/DTSTART:20261109T120000Z/);
  assert.match(ics,/STATUS:CONFIRMED/);
  assert.match(ics,/BEGIN:VALARM\r\nACTION:DISPLAY\r\nTRIGGER:-PT15M\r\n/);
  assert.doesNotMatch(ics,/\r\nBEGIN:FAKE/);
  assert.ok(ics.split('\r\n').every(line=>new TextEncoder().encode(line).length<=75));
  assert.match(appointmentICS({...item,cancelled:true},{registry,base:'https://example.test/'}),/STATUS:CANCELLED/);
  assert.doesNotMatch(appointmentICS({...item,cancelled:true},{registry,base:'https://example.test/'}),/VALARM|TRIGGER/);
  assert.throws(()=>appointmentICS({...item,end:item.start},{registry,base:'https://example.test/'}),/interval/);
  const google=new URL(appointmentGoogleLink(item,{base:'https://example.test/?private=secret#room'}));
  assert.equal(google.origin,'https://calendar.google.com');
  assert.equal(google.searchParams.get('dates'),'20261109T120000Z/20261109T123000Z');
  assert.equal(google.searchParams.get('text'),item.subject);
  assert.match(google.searchParams.get('details'),/15 minutes/);
  assert.doesNotMatch(google.searchParams.get('details'),/private=secret|#room/);
  assert.throws(()=>appointmentGoogleLink({...item,cancelled:true},{base:'https://example.test/'}),/Cancelled/);
});
test('unconfigured appointments never simulate empty availability or offer a transaction', async () => {
  const client=createAppointmentClient({config:{},provider:{},getSession:()=>null});
  await assert.rejects(client.readOffer(1),/not deployed and pinned/);
  await assert.rejects(client.book(1,0,1n),/writes are disabled/);
});
