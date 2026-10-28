import { createCalendarStorage } from './calendar-storage.js';
import { bindCalendarSession } from './head-session.js';
import { installProfiles } from './profile-ui.js';
import { installTutorial } from './tutorial.js';
import { installSlotUI } from './slot-ui.js';
import './components/Calendar.js';

const report = message => { document.getElementById('calendar-status').textContent = message; };
window.DECENT_CONFIG.ipfsAdapter = createCalendarStorage({
  wallet: () => window._walletAddress,
  storage: localStorage,
  getIpfs: () => window.DecentHead.getIpfs(),
  refresh: () => loadAndRenderMyEvents(),
  showPublic: ({ owner, events }) => {
    setOtherEvents(events);
    setCurrentLookupAddress(owner);
    refreshCalendarToggle();
    refreshCalendar();
  },
});
const { DecentHead } = await import('../vendor/decent-head/2.0.0/js/main.js');
const identity = installProfiles(DecentHead);
window.DCalProfiles = identity.profiles;
installSlotUI(identity);
installTutorial();
bindCalendarSession(DecentHead, {
  connected: () => {
    loadAndRenderMyEvents();
  },
  disconnected: () => {
    clearCalendarEvents();
    closeMeetingRoom();
    document.querySelectorAll('.modal').forEach(modal => modal.classList.add('hidden'));
    for (const id of ['local-backup-dialog', 'public-availability-dialog', 'slot-details', 'ens-profile-dialog']) document.getElementById(id).close();
    document.getElementById('public-preview').textContent = '';
    document.getElementById('local-backup-file').value = '';
    document.getElementById('public-availability-consent').checked = false;
  },
  report,
});
