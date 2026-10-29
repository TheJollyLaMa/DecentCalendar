import { profileImage } from './ens-profile.js';
import { calendarICS, googleCalendarLink, timeboxLink, invitationRecipient, invitationState, createInvitationStore, shareInvitation } from './invitations.js';
import { PREFERENCES } from './invitation-inbox.js';

export function installInvitationUI({ container, slot, registry, account, profiles, isCurrent }) {
  const section = document.createElement('section');
  section.className = 'timebox-invitations';
  section.setAttribute('aria-label', 'Timebox invitations and calendar');
  const heading = document.createElement('h3');
  heading.textContent = 'Invite & remember';
  const message = document.createElement('p');
  message.setAttribute('role', 'status');
  const note = document.createElement('p');
  note.textContent = 'An invitation is not a reservation. Anyone may join this public timebox before it starts while seats remain. Calendar exports do not join or pay. Google Calendar receives these public event details only if you open its link.';
  section.append(heading, note);
  container.append(section);
  const say = error => {
    if (!isCurrent()) return;
    console.error('[DCal invitations]', error);
    message.textContent = error.message;
  };
  const action = (label, handler, parent = section) => {
    const button = document.createElement('button');
    button.type = 'button'; button.textContent = label;
    button.onclick = async () => {
      button.disabled = true;
      try { await handler(); }
      catch (error) { say(error); }
      finally { button.disabled = false; }
    };
    parent.append(button);
    return button;
  };
  const base = location.href, publicLink = timeboxLink(base, slot.id);
  let recipient = null;
  try {
    recipient = invitationRecipient(base, slot.id);
    if (recipient) {
      const greeting = document.createElement('p');
      greeting.className = 'invitation-greeting';
      greeting.textContent = `You are viewing an invitation to host ${slot.host}'s timebox, addressed to ${recipient}. ${account?.toLowerCase() === recipient ? invitationState(recipient, slot.seats) : 'Connect that wallet on Base to review your seat actions.'} Anyone can create or forward this link; it is not proof the host sent it.`;
      section.prepend(greeting);
    }
  } catch (error) { say(error); }
  action('Share timebox', async () => {
    const result = await shareInvitation({ url: publicLink, title: 'DCal public timebox' });
    if (isCurrent()) message.textContent = result;
  });
  action('Download calendar (.ics)', () => {
    const blob = new Blob([calendarICS(slot, { registry, base })], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob), anchor = document.createElement('a');
    anchor.href = url; anchor.download = `dcal-timebox-${slot.id}.ics`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    message.textContent = 'Calendar snapshot downloaded. Refresh Base state before attending; calendar entries do not update automatically.';
  });
  const google = document.createElement('a');
  google.href = googleCalendarLink(slot, { base });
  google.target = '_blank'; google.rel = 'noopener noreferrer';
  google.textContent = 'Add to Google Calendar';
  section.append(google);

  if (account?.toLowerCase() === slot.host.toLowerCase()) {
    const label = document.createElement('label'), input = document.createElement('input');
    label.textContent = 'Invite by ENS name or wallet address';
    input.autocomplete = 'off'; input.placeholder = 'friend.eth or 0x...'; input.maxLength = 255;
    label.append(input);
    const consent = document.createElement('p');
    consent.className = 'quiet';
    consent.textContent = 'The recipient address will appear in the link you share. Your list stays in this browser (not in backups or on IPFS); adding a name sends nothing. ENS lookup queries the configured Ethereum RPC.';
    const roster = document.createElement('ul');
    roster.setAttribute('aria-label', 'Local invitation roster');
    const preview = document.createElement('div');
    const preferenceLabel = document.createElement('label'), preference = document.createElement('select');
    preferenceLabel.textContent = 'Seat preference (request only; not enforced)';
    preference.id = 'invitation-preference';
    preference.replaceChildren(...PREFERENCES.map((text, index) => new Option(text, String(index))));
    preferenceLabel.append(preference);
    section.append(label, consent, preferenceLabel);
    action('Send public Base invitation', async () => {
      const address = await profiles.address(input.value);
      if (!isCurrent() || account.toLowerCase() !== window._walletAddress?.toLowerCase()) return;
      if (!window.confirm(`Publish host ${slot.host}, recipient ${address} and timebox ${slot.id} on Base forever? Gas is required. ${PREFERENCES[Number(preference.value)]}. No seat is reserved or restricted.`)) return;
      message.textContent = 'Confirm the invitation in your wallet, then wait for its Base receipt.';
      const hash = await window.DCalInvitationInbox.send(slot.id, address, Number(preference.value));
      if (isCurrent()) message.textContent = `Public invitation confirmed: ${hash}. Recipient can discover it in the right-ankh inbox. It remains a request, not a held seat.`;
    });
    let store;
    const renderRoster = () => {
      roster.replaceChildren();
      const addresses = store.read();
      if (!addresses.length) roster.textContent = 'No local invitations yet.';
      for (const address of addresses) {
        const row = document.createElement('li'), link = document.createElement('a');
        link.href = timeboxLink(base, slot.id, address);
        link.textContent = `${address} — ${invitationState(address, slot.seats)}`;
        row.append(link);
        action('Copy invite link', async () => {
          if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable. Select and copy the displayed link.');
          await navigator.clipboard.writeText(link.href);
          if (isCurrent()) message.textContent = 'Invitation link copied. Send it yourself; DCal has not delivered it.';
        }, row);
        action('Share invite', async () => {
          const result = await shareInvitation({ url: link.href, title: 'DCal invitation' });
          if (isCurrent()) message.textContent = result;
        }, row);
        action('Forget locally', () => { store.remove(address); renderRoster(); }, row);
        roster.append(row);
      }
    };
    action('Create invitation link', async () => {
      if (!store) throw new Error('Local invitation storage is unavailable.');
      const address = await profiles.address(input.value);
      if (!isCurrent() || account.toLowerCase() !== window._walletAddress?.toLowerCase()) return;
      if (address.toLowerCase() === slot.host.toLowerCase()) throw new Error('Invite an attendee, not the host.');
      store.add(address);
      renderRoster();
      preview.replaceChildren();
      message.textContent = 'Invitation link saved locally. Share it yourself; nothing has been sent.';
      try {
        const profile = await profiles.lookup(address);
        if (!isCurrent()) return;
        const name = document.createElement('p');
        name.textContent = `${profile.name || address} — ${address}. ${profile.warnings.join(' ')}`;
        preview.append(name);
        if (profile.avatar) preview.prepend(profileImage(profile.avatar, 'ens-avatar', 'Invitee ENS avatar', () => {
          if (isCurrent()) message.textContent = 'Invitee avatar unavailable; invitation wallet is unchanged.';
        }));
      } catch (error) { say(new Error(`Link saved. ENS display unavailable: ${error.message}`)); }
    });
    section.append(preview, roster);
    try {
      store = createInvitationStore(localStorage, { registry, host: slot.host, id: slot.id });
      renderRoster();
    } catch (error) { store = null; say(new Error(`Local invitation storage unavailable: ${error.message}`)); }
  }
  section.append(message);
  return { recipient };
}
