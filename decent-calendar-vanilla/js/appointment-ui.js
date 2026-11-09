import { createAppointmentClient } from './appointment-client.js';
import { appointmentWindows, availableChoices, availabilityLink, appointmentCalendarEvent, appointmentICS, appointmentGoogleLink } from './appointments.js';
import { localTimeZone, counterpartTime, dateInZone } from './timezones.js';
import { inviteAddress } from './invitations.js';
import { bookingId } from './booking-client.js';
import { informationPanel } from './ui-info.js';

const element = (tag, text) => {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  return node;
};
export function installAppointmentUI() {
  const config = window.DECENT_CONFIG.appointments;
  const dialog = document.getElementById('appointments');
  const form = document.getElementById('availability-form');
  const status = document.getElementById('appointment-status');
  const summary = document.getElementById('appointment-summary');
  const records = document.getElementById('appointment-records');
  const detail = document.getElementById('appointment-detail');
  const transactions = document.getElementById('appointment-transactions');
  const publishPanel = document.getElementById('appointment-publish');
  const transactionHistory = document.getElementById('appointment-transaction-history');
  let viewingRecord = false;
  let client, generation = 0, pending = false, refreshing = false, timer, limit = 20;
  const getSession = () => ({ address:window._walletAddress, signer:window._walletSigner });
  const configured = () => !!config?.address && !!config?.runtimeCodeHash;
  const showError = error => {
    console.error('[DCal appointments]', error);
    status.textContent = error.shortMessage || error.message;
  };
  const button = (parent, text, action, disabled = false) => {
    const node = element('button', text); node.type = 'button'; node.disabled = disabled;
    node.onclick = () => { void run(action); }; parent.append(node); return node;
  };
  async function run(action) {
    if (pending) return;
    pending = true;
    try { await action(); }
    catch (error) { showError(error); }
    finally { pending = false; applicableControls(); }
  }
  async function api() {
    if (!configured()) throw new Error('Free appointment registry is not deployed and pinned. No availability has been published and no booking can be made.');
    if (!client) {
      const { loadEthers } = await import('../vendor/decent-head/2.0.0/js/wallet.js');
      const { Contract, JsonRpcProvider, FetchRequest, keccak256 } = await loadEthers();
      const request = new FetchRequest(window.DECENT_CONFIG.chain.rpcUrls[0]); request.timeout = 12000;
      client = createAppointmentClient({
        config, legacyConfig:window.DECENT_CONFIG.booking, provider:new JsonRpcProvider(request, 8453, { staticNetwork:true }),
        getSession, Contract, hashCode:keccak256, storage:localStorage,
        onTransaction({ hash, phase }) {
          const row = element('p'), link = element('a', `${phase}: ${hash}`);
          link.href = `https://basescan.org/tx/${hash}`; link.target = '_blank'; link.rel = 'noopener noreferrer';
          row.append(link); transactions.append(row);
          transactionHistory.hidden = false;
          status.textContent = `${phase}: ${hash}. Wait for reconciliation before retrying.`;
        },
      });
    }
    return client;
  }
  const writes = () => config?.writesEnabled === true && !!getSession().address;
  function applicableControls() {
    publishPanel.hidden = viewingRecord || !writes();
    form.querySelector('[type=submit]').disabled = !writes();
    document.getElementById('refresh-appointments').hidden = viewingRecord || !getSession().address || !configured();
    const recovery = document.getElementById('recover-appointment-tx');
    recovery.hidden = true;
    if (client && getSession().address) {
      try { recovery.hidden = !client.pending(getSession().address); }
      catch (error) { recovery.hidden = false; showError(error); }
    }
  }
  const when = item => `${new Date(Number(item.start) * 1000).toLocaleString()} - ${new Date(Number(item.end) * 1000).toLocaleTimeString()} (${localTimeZone()})`;
  const counterpart = item => counterpartTime(new Date(Number(item.start) * 1000), new Date(Number(item.end) * 1000), item.timezone, 'host');
  function appointmentRow(item, parent) {
    const row = element('section'); row.className = 'appointment-card';
    row.append(element('h3', item.subject), element('p', when(item)),
      element('p', item.cancelled ? 'Cancelled' : 'Confirmed · Base'),
      informationPanel('Appointment wallets, host time and terms', [
        `Host: ${item.host} · Guest: ${item.invitee}`, counterpart(item),
        'Public Base record. Not proof of attendance or task payment. Calendar exports are static reminders; refresh for changes.',
      ]));
    if (!item.cancelled && item.end > item.now) {
      button(row, 'Add to iPhone / Android', () => {
        const url = URL.createObjectURL(new Blob([appointmentICS(item, { registry:config.address, base:location.href })], { type:'text/calendar;charset=utf-8' }));
        const link = element('a'); link.href = url; link.download = `dcal-appointment-${item.id}.ics`; link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        status.textContent = 'Open the .ics file in your calendar and confirm adding it. A 15-minute alert is included; verify your device imported it.';
      });
      const google = element('a', 'Add to Google');
      google.href = appointmentGoogleLink(item, { base:location.href });
      google.target = '_blank'; google.rel = 'noopener noreferrer';
      row.append(google, informationPanel('Device alerts and calendar privacy', [
        'iPhone: open the .ics file in Calendar. Android: import it using your calendar app; some apps require Google Calendar web import.',
        'The .ics includes a 15-minute alert. Google add links use your calendar settings: set a 15-minute notification before saving. Calendar permissions and device settings control delivery.',
        'Google receives the public event title, time and link only if you open its link. These are static copies, not live subscriptions; update or remove them after rescheduling or cancellation.',
      ]));
    }
    if (!item.cancelled && item.start > item.now && [item.host, item.invitee].some(address => address.toLowerCase() === getSession().address?.toLowerCase())) {
      button(row, 'Cancel appointment', async () => {
        if (!confirm(`Cancel this free appointment on Base?\nHost: ${item.host}\nInvited wallet: ${item.invitee}\nSigning wallet: ${getSession().address}\nBase gas is separate. This frees the day for another choice. Choosing a replacement is a separate transaction, not an atomic reschedule. No task payment is affected.`)) return;
        await (await api()).cancel(item.id);
        await refresh(true);
        await openAvailability(item.offerId);
      }, !writes());
    }
    parent.append(row);
  }
  function renderRecords(state) {
    records.replaceChildren();
    if (state.offers.length) records.append(element('h3', 'My windows'));
    for (const offer of state.offers) button(records, `${offer.subject} · ${offer.closed ? 'closed' : 'open'} · ${offer.host.toLowerCase() === getSession().address?.toLowerCase() ? 'hosting' : 'invited'}`,
      () => openAvailability(offer.id));
    if (state.appointments.length) records.append(element('h3', 'My appointments'));
    for (const item of state.appointments) appointmentRow(item, records);
    if (!state.appointments.length && !state.offers.length) records.append(element('p', 'No records in this checked page.'));
    if (state.offerCount > BigInt(limit) || state.appointmentCount > BigInt(limit)) {
      records.append(informationPanel('Loaded page and older appointment recovery', [
        `Newest ${limit} of ${state.offerCount} offers / ${state.appointmentCount} appointments, not the whole history.`,
        'For older records, reopen their saved availability link or appointment ID. No older record is assumed cancelled.',
      ]));
      if (limit < 100) button(records, 'Load more wallet records', async () => { limit += 20; await refresh(true); });
    }
  }
  async function refresh(render = false) {
    if (refreshing) return;
    const address = getSession().address, request = generation;
    if (!address) { summary.textContent = 'Connect on Base to recover your free appointments.'; return; }
    if (!configured()) { summary.textContent = 'Free appointment windows: awaiting reviewed registry deployment.'; return; }
    refreshing = true;
    try {
      const state = await (await api()).readWallet(address, limit);
      if (request !== generation || address !== getSession().address) return;
      const active = state.appointments.filter(item => !item.cancelled && item.end > state.now);
      window.setAppointmentSnapshots?.(state.appointments.map(item => appointmentCalendarEvent(item, config.address)));
      window.DCalBookingRewards?.recover(state);
      summary.textContent = `${active.length} upcoming free appointment${active.length === 1 ? '' : 's'} in the checked page. Base checked ${new Date(Number(state.now) * 1000).toLocaleTimeString()}.`;
      if (render) status.textContent = `Base checked ${new Date(Number(state.now) * 1000).toLocaleTimeString()}`;
      if (!viewingRecord && (render || !dialog.open)) renderRecords(state);
    } catch (error) {
      if (request !== generation) return;
      window.markAppointmentSnapshotsStale?.();
      summary.textContent = `Appointment refresh unavailable; previous calendar snapshots may be stale: ${error.shortMessage || error.message}`;
      showError(error);
    } finally {
      refreshing = false;
      if (request !== generation && getSession().address) void refresh(true);
    }
  }
  async function openAvailability(id) {
    id = bookingId(id);
    if (!dialog.open) dialog.showModal();
    viewingRecord = true; records.replaceChildren(); detail.replaceChildren(); applicableControls();
    const request = generation;
    status.textContent = 'Reading published windows and booked days from Base...';
    const offer = await (await api()).readOffer(id);
    if (request !== generation) return;
    detail.replaceChildren();
    detail.append(element('h3', offer.subject),
      element('p', `${offer.duration / 60} min · one per offered day · Free; Base gas separate`));
    const info = informationPanel('Offered wallets, timezone, public link and conflict limits', [
      `Host: ${offer.host} · Invited wallet: ${offer.invitee}`,
      `Host timezone: ${offer.timezone}. Choices below use your local timezone (${localTimeZone()}).`,
      'The contract rechecks this registry for both people’s conflicts. Existing paid-host timeboxes are checked before signing; external/private calendars and later legacy bookings are not automatically enforced.',
      'Public host invitation, not an endorsement. Closed windows do not cancel existing appointments.',
    ]);
    detail.append(info);
    if (offer.closed) detail.append(element('p', 'Availability closed'));
    const link = element('a', 'Availability link'); link.href = availabilityLink(location.href, offer.id); info.append(link);
    button(info, 'Copy link', async () => {
      await navigator.clipboard.writeText(link.href); status.textContent = 'Link copied. Nothing was sent automatically.';
    });
    button(detail, 'Refresh', () => openAvailability(id));
    const canBook = writes() && offer.invitee.toLowerCase() === getSession().address?.toLowerCase();
    if (!canBook && !offer.closed) detail.append(element('p',
      offer.invitee.toLowerCase() === getSession().address?.toLowerCase() ? 'Booking unavailable; writes are disabled.' : 'Connect the invited wallet on Base to book.'));
    const choices = availableChoices(offer, offer.now, offer.bookedDays);
    let lastDay, group;
    for (const choice of choices) {
      if (lastDay !== choice.day) {
        group = element('details'); group.open = lastDay === undefined;
        group.append(element('summary', `Host date ${String(choice.day).replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3')}`));
        detail.append(group); lastDay = choice.day;
      }
      const choiceTime = new Date(Number(choice.start) * 1000).toLocaleString(undefined, { month:'short', day:'numeric', hour:'numeric', minute:'2-digit' });
      if (!canBook) {
        const time = element('p', choiceTime); time.className = 'appointment-choice';
        group.append(time);
        continue;
      }
      button(group, `${choiceTime} · Book`, async () => {
        if (!confirm(`Book ${when(choice)}?\n${counterpart({ ...choice, timezone:offer.timezone })}\nHost: ${offer.host}\nInvited wallet: ${offer.invitee}\nSigning wallet: ${getSession().address}\nOne appointment per offered day. No attendance fee; your wallet pays Base gas. Confirmation is public and immediate after a successful transaction.`)) return;
        const appointmentId = await (await api()).book(offer.id, choice.windowIndex, choice.start);
        await refresh(true); await openAvailability(offer.id);
        status.textContent = `Appointment ${appointmentId} confirmed · Base`;
        window.DCalBookingRewards?.confirmed(appointmentId);
      }, !canBook);
    }
    if (!choices.length) detail.append(element('p', 'No remaining choices: days may already be booked, expired, or closed.'));
    if (writes() && offer.host.toLowerCase() === getSession().address?.toLowerCase() && !offer.closed) {
      button(detail, 'Close unbooked availability', async () => {
        if (!confirm(`Stop new bookings?\nHost/signing wallet: ${offer.host}\nInvited wallet: ${offer.invitee}\nBase gas is separate. Existing appointments remain confirmed and must be cancelled individually.`)) return;
        await (await api()).close(id); await refresh(true); await openAvailability(id);
      });
    }
    status.textContent = `Base checked ${new Date(Number(offer.now) * 1000).toLocaleTimeString()}`;
  }
  async function openAppointment(id) {
    if (!dialog.open) dialog.showModal();
    viewingRecord = true; records.replaceChildren(); detail.replaceChildren(); applicableControls();
    status.textContent = 'Reading appointment from Base...';
    const request = generation, item = await (await api()).readAppointment(bookingId(id));
    if (request !== generation) return;
    detail.replaceChildren(); appointmentRow(item, detail);
    status.textContent = `Base checked ${new Date(Number(item.now) * 1000).toLocaleTimeString()}`;
  }
  function draft() {
    const f = Object.fromEntries(new FormData(form));
    const duration = Number(f.duration);
    const windows = appointmentWindows({ firstDate:f.firstDate, lastDate:f.lastDate, timezone:f.timezone, duration,
      ranges:[[f.morningStart, f.morningEnd], [f.afternoonStart, f.afternoonEnd]],
      weekdays:[...form.querySelectorAll('[name=weekday]:checked')].map(input => Number(input.value)) });
    return { invitee:f.invitee.trim(), subject:f.subject.trim(), duration, timezone:f.timezone, windows };
  }
  form.onsubmit = event => {
    event.preventDefault();
    void run(async () => {
      const offer = draft();
      const offeredDates = [...new Set(offer.windows.map(window => String(window.day).replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3')))].join(', ');
      const reviewedPolicy = `Offered dates: ${offeredDates}, ${offer.timezone}; ${offer.duration / 60} minutes, one per offered day.\nDaily windows: ${form.elements.morningStart.value}–${form.elements.morningEnd.value} and ${form.elements.afternoonStart.value}–${form.elements.afternoonEnd.value}.`;
      if (!form.elements.publicConsent.checked) throw new Error('Explicit consent to public windows and wallets is required.');
      const originalWallet = getSession().address;
      const originalSigner = getSession().signer;
      offer.host = originalWallet;
      const resolved = /^0x/i.test(offer.invitee) ? offer.invitee : await window.DCalProfiles.address(offer.invitee);
      offer.invitee = inviteAddress(resolved);
      if (!originalWallet || originalWallet !== getSession().address || originalSigner !== getSession().signer) throw new Error('Connect the host wallet; session changed.');
      const count = availableChoices(offer, BigInt(Math.floor(Date.now() / 1000))).length;
      if (!confirm(`Publish ${offer.windows.length} public windows (${count} candidate starts)?\nSubject: ${offer.subject}\nHost/signing wallet: ${offer.host}\nInvited wallet: ${offer.invitee}\n${reviewedPolicy}\nOnly that wallet can book. No meeting fee or $10 task payment is included. Your wallet pays Base gas. This transaction exposes both wallets, dates and subject permanently.`)) return;
      const id = await (await api()).publish(offer);
      form.elements.publicConsent.checked = false;
      await refresh(true); await openAvailability(id);
      status.textContent = 'Published on Base. Copy the actual availability link and send it to the invited person.';
    });
  };
  const today = dateInZone(Date.now(), 'America/New_York'), monday = new Date(`${today}T12:00:00Z`);
  monday.setUTCDate(monday.getUTCDate() + (1 - monday.getUTCDay() + 7) % 7);
  form.elements.firstDate.value = monday.toISOString().slice(0, 10);
  monday.setUTCDate(monday.getUTCDate() + 3);
  form.elements.lastDate.value = monday.toISOString().slice(0, 10);
  form.querySelector('[type=submit]').disabled = config?.writesEnabled !== true;
  document.getElementById('open-appointments').onclick = () => {
    viewingRecord = false; detail.replaceChildren(); applicableControls();
    status.textContent = 'Reading my Base records...';
    if (!dialog.open) dialog.showModal();
    void run(async () => { if (!configured()) await api(); await refresh(true); });
  };
  document.getElementById('refresh-appointments').onclick = () => { void run(() => refresh(true)); };
  document.getElementById('recover-appointment-tx').onclick = () => {
    void run(async () => { status.textContent = await (await api()).recover(); await refresh(true); });
  };
  document.getElementById('read-appointment-id').onclick = () => {
    void run(() => openAppointment(document.getElementById('appointment-id').value));
  };
  dialog.querySelector('[data-close]').onclick = () => dialog.close();
  document.addEventListener('visibilitychange', () => { if (!document.hidden && !pending) void refresh(); });
  window.DCalAppointments = {
    openAvailability: id => { void run(() => openAvailability(id)); },
    openAppointment: id => { void run(() => openAppointment(id)); },
  };
  const requested = new URL(location.href).searchParams.get('availability');
  if (requested) void run(() => openAvailability(requested));
  return {
    connected() {
      generation++; limit = 20; clearInterval(timer);
      applicableControls();
      void refresh(true);
      timer = setInterval(() => { if (!document.hidden && !pending) void refresh(); }, 30000);
      if (requested) void run(() => openAvailability(requested));
    },
    disconnected() {
      generation++; clearInterval(timer); dialog.close(); records.replaceChildren(); detail.replaceChildren(); transactions.replaceChildren();
      viewingRecord = false; publishPanel.open = false; transactionHistory.hidden = true; applicableControls();
      status.textContent = '';
      document.getElementById('appointment-id').value = '';
      dialog.querySelectorAll('.ui-info').forEach(panel => { panel.open = false; });
      form.elements.invitee.value = ''; form.elements.publicConsent.checked = false;
      summary.textContent = 'Connect on Base to recover your free appointments.';
      window.setAppointmentSnapshots?.([]);
    },
  };
}
