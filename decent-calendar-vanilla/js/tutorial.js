export const TUTORIAL_KEY = 'decentcalendar:tutorial:v1';
export const STEPS = Object.freeze([
  { title: 'Follow the white rabbit', target: '#rabbit-tour-launch', body: 'Time, knowledge, wisdom and presence have value. Follow this trail to learn DCal. The tour never connects a wallet, signs, pays, uploads or opens your camera. You can leave and resume at any time.' },
  { title: 'Your wallet, your choice', target: 'wallet', body: 'Use the right wallet orbit to connect explicitly on Base. Gas is paid on Base; ENS records are read on Ethereum without switching your wallet. Disconnect clears this app session, not your extension permissions. No wallet? Use Open MetaMask in a wallet browser.' },
  { title: 'Meet your ENS identity', target: 'profile', body: 'The right ankh opens My ENS profile: your forward-verified primary name, avatar and banner. Names and artwork can change. They never replace wallet addresses for booking rights or payouts. ENS RPC and image hosts can see requests; missing images or RPC errors retain your address.' },
  { title: 'Your local calendar', target: '#calendar-identity', body: 'The banner above the calendar belongs to the connected wallet. Times are displayed in your browser timezone; slot details add the other person\'s local time so you know what hour you are asking of them. Local events are drafts, not committed bookings. A local status, imported CID or pretty avatar is never proof that someone paid.' },
  { title: 'Offer your time', target: '#add-event-btn', body: 'Press + or drag across the calendar grid to open the offer panel. Pick the day, start and length, then an exact hourly rate in an identified asset: ETH or canonical Base USDC. USDC has 6 decimal places, ETH has 18. Unsupported legacy currencies are labeled, never guessed. Public/private is an explicit choice; saving uploads nothing.' },
  { title: 'Preview an agreement', target: '#calendar-wrapper', body: 'Click a slot to review its asset icon, exact gross amount, 3% development share and 97% host share. Base gas is extra. This preview is not a payment request. A tiny fee rounds down; the slot total rounds up to the nearest asset base unit.' },
  { title: 'Back up privately, publish deliberately', target: 'storage', body: 'The left IPFS orbit offers separate local JSON backups and public availability. A local backup can contain private details; keep it safe and offline. Public publication requires a preview, checkbox and confirmation. Public descriptions must contain no secrets: IPFS copies may persist forever.' },
  { title: 'Look up a friend', target: '#lookup-address', body: 'Enter an ENS name or wallet address. Today address lookup reads only data already in this browser; it is not global discovery. A shared DCal public-availability CID can be opened through the IPFS controls. Imported slots remain read-only and cannot grant payment or meeting access.' },
  { title: 'Payment and cancellation rules', target: '#open-booking-registry', body: 'The Bookings / recover / withdraw control reads a timebox by ID and exposes withdrawal credits. Save the permanent timebox link and receipt. USDC approval and joining are separate; approval alone reserves no seat. Attendees cannot leave before start, but the host can refund any seat or cancel. If the minimum is not met, attendees reclaim in full; after the end each attendee releases their seat, or after 7 unresolved days reclaims it. Resolution creates credit requiring withdrawal. No admin dispute power; hosts can remain unpaid. Deployment and review are still required; no funds can be taken here yet.' },
  { title: 'Meet, then wrap up', target: '#release-readiness', body: 'The meeting release needs booking-bound wallet authentication. An agreed hardline will count down during the last five minutes and end the supported app connection at the scheduled finish, even if you arrived late. App-enforced P2P cannot stop modified clients reconnecting. Ending a call never settles escrow or bills overtime.' },
  { title: 'Ready to explore', target: '#rabbit-tour-launch', body: 'You can use local drafts, ENS profiles, exact-asset previews and deliberate storage now. Paid bookings and authenticated meetings are not live until the release checks below pass. Revisit this trail from the rabbit or the right ankh. Never send funds outside a verified booking agreement.' },
]);

export function readProgress(storage) {
  const raw = storage.getItem(TUTORIAL_KEY);
  if (!raw) return { index: 0, completed: false };
  const value = JSON.parse(raw);
  if (!Number.isInteger(value.index) || value.index < 0 || value.index >= STEPS.length || typeof value.completed !== 'boolean') {
    throw new Error('Saved tutorial progress is invalid. Restart the tour to replace it.');
  }
  return value;
}

export function installTutorial({ storage = localStorage } = {}) {
  const dialog = document.getElementById('rabbit-tour');
  const launcher = document.getElementById('rabbit-tour-launch');
  const title = document.getElementById('rabbit-title');
  const body = document.getElementById('rabbit-body');
  const status = document.getElementById('rabbit-status');
  const progress = document.getElementById('rabbit-progress');
  const next = document.getElementById('rabbit-next');
  const back = document.getElementById('rabbit-back');
  let state = { index: 0, completed: false }, highlighted, returnFocus;
  const clearHighlight = () => {
    highlighted?.classList.remove('rabbit-highlight');
    highlighted = null;
  };
  const remember = () => {
    try { storage.setItem(TUTORIAL_KEY, JSON.stringify(state)); }
    catch (error) {
      console.warn('[DCal tutorial]', error);
      status.textContent = `Progress could not be saved: ${error.message}. You can still finish this tour.`;
    }
  };
  const render = () => {
    clearHighlight();
    const step = STEPS[state.index];
    title.textContent = step.title;
    body.textContent = step.body;
    progress.textContent = `Step ${state.index + 1} of ${STEPS.length}`;
    back.disabled = state.index === 0;
    next.textContent = state.index === STEPS.length - 1 ? 'Finish' : 'Next hop';
    const header = document.querySelector('decent-header');
    const target = {
      wallet: header, profile: header, storage: header,
    }[step.target] || document.querySelector(step.target);
    if (target) {
      highlighted = target;
      target.classList.add('rabbit-highlight');
      target.scrollIntoView({ block: 'center', behavior: 'instant' });
    } else {
      status.textContent = 'This control is not available in the current view; the explanation still applies.';
    }
  };
  const open = ({ restart = false } = {}) => {
    if (dialog.open) return;
    returnFocus = document.activeElement;
    status.textContent = '';
    try {
      state = restart ? { index: 0, completed: false } : readProgress(storage);
      if (state.completed) state = { index: 0, completed: false };
    } catch (error) {
      console.warn('[DCal tutorial]', error);
      state = { index: 0, completed: false };
      status.textContent = error.message;
    }
    dialog.showModal();
    render();
    title.focus();
  };
  const close = () => {
    remember();
    dialog.close();
  };
  launcher.onclick = () => open();
  dialog.querySelector('[data-close]').onclick = close;
  document.getElementById('rabbit-restart').onclick = () => {
    state = { index: 0, completed: false };
    status.textContent = '';
    remember();
    render();
  };
  back.onclick = () => {
    if (state.index > 0) state.index--;
    remember();
    render();
  };
  next.onclick = () => {
    if (state.index === STEPS.length - 1) {
      state.completed = true;
      close();
      launcher.querySelector('small').textContent = 'Tour complete - replay anytime';
    } else {
      state.index++;
      remember();
      render();
    }
  };
  dialog.addEventListener('keydown', event => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault();
      (event.key === 'ArrowRight' ? next : back).click();
    }
  });
  dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
  dialog.addEventListener('close', () => {
    clearHighlight();
    returnFocus?.focus();
  });
  const menu = document.querySelector('decent-header').shadowRoot.querySelector('ankh-menu[side="right"]');
  const replay = document.createElement('button');
  replay.type = 'button';
  replay.textContent = 'Follow the white rabbit';
  replay.style.cursor = 'pointer';
  replay.onclick = () => { menu.shadowRoot.querySelector('details').open = false; open(); };
  menu.shadowRoot.querySelector('.options').append(replay);
  return { open };
}
