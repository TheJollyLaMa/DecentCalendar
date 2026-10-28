import {
  MAX_BACKUP_BYTES, createLocalBackup, restoreLocalBackup,
  createPublicAvailability, importPublicAvailability, validateDocument,
} from './calendar-data.js';

export function createCalendarStorage({ wallet, storage, getIpfs, refresh, showPublic }) {
  const local = document.getElementById('local-backup-dialog');
  const publicDialog = document.getElementById('public-availability-dialog');
  let published = null;
  const owner = () => {
    const current = wallet();
    if (!current) throw new Error('Connect your wallet on Base first.');
    return current;
  };
  const action = (buttonId, messageId, run) => {
    const button = document.getElementById(buttonId);
    button.onclick = async () => {
      button.disabled = true;
      const message = document.getElementById(messageId);
      message.textContent = 'Working...';
      try { message.textContent = await run(); }
      catch (error) {
        console.error('[DCal storage]', error);
        message.textContent = error.message;
      } finally { button.disabled = false; }
    };
  };
  const preview = () => {
    const data = createPublicAvailability(storage, owner());
    document.getElementById('public-preview').textContent = JSON.stringify(data, null, 2);
    return data;
  };
  for (const dialog of [local, publicDialog]) {
    dialog.querySelector('[data-close]').onclick = () => dialog.close();
    dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
  }
  action('download-local-backup', 'local-backup-message', async () => {
    const data = createLocalBackup(storage, owner());
    const url = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `dcal-${data.owner}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return `Local download requested for ${data.events.length} events. This file may include private data; store it safely. Nothing uploaded.`;
  });
  action('restore-local-backup', 'local-backup-message', async () => {
    const current = owner();
    const file = document.getElementById('local-backup-file').files[0];
    if (!file) throw new Error('Select a DecentCalendar backup JSON file.');
    if (file.size > MAX_BACKUP_BYTES) throw new Error('Backup exceeds 2 MiB.');
    const data = validateDocument(JSON.parse(await file.text()), 'local-backup');
    if (owner() !== current) throw new Error('Wallet changed; reopen the backup controls.');
    if (data.owner !== current.toLowerCase()) throw new Error('Connect the wallet that owns this backup.');
    if (!confirm(`Replace this wallet's local calendar with ${data.events.length} events? Download your existing backup first. No on-chain state will change.`)) return 'Restore cancelled.';
    const count = restoreLocalBackup(storage, current, data);
    refresh();
    return `Restored ${count} local events. Other wallets and on-chain state were not changed.`;
  });
  action('publish-availability', 'public-availability-message', async () => {
    if (!document.getElementById('public-availability-consent').checked) {
      throw new Error('Confirm that the preview is intended for permanent public distribution.');
    }
    const data = preview();
    if (!data.events.length) throw new Error('No explicitly public events to publish.');
    if (!confirm(`Publish ${data.events.length} public availability events for ${data.owner} to IPFS? Titles, descriptions, times, rates and your address may be retained forever.`)) return 'Publication cancelled.';
    document.getElementById('public-availability-consent').checked = false;
    const cid = await getIpfs().upload(data);
    published = { owner: data.owner, cid };
    return `Provider returned CID: ${cid} for ${data.owner}. Share this CID explicitly; wallet discovery and durable retention are not verified.`;
  });
  action('import-availability', 'public-availability-message', async () => {
    const current = owner();
    const cid = document.getElementById('public-availability-cid').value.trim();
    const data = importPublicAvailability(await getIpfs().restore(cid));
    if (owner() !== current) throw new Error('Wallet changed; reopen public availability controls.');
    if (!confirm(`Display ${data.events.length} read-only availability events for ${data.owner}? This does not restore your local calendar, prove bookings or grant meeting access.`)) return 'Import cancelled.';
    showPublic(data);
    return `Displaying ${data.events.length} read-only events. Your local calendar was not changed.`;
  });
  return {
    version: 1,
    label: 'DCal: private local backups and explicit public availability',
    capabilities: {
      backup: { open: () => {
        owner();
        document.getElementById('local-backup-message').textContent = '';
        local.showModal();
      } },
      replication: { open: () => {
        preview();
        document.getElementById('public-availability-message').textContent = '';
        document.getElementById('public-availability-consent').checked = false;
        publicDialog.showModal();
      } },
    },
    getStatus: async () => ({
      backup: { state: wallet() ? 'idle' : 'unavailable', detail: 'Download/restore this wallet only. Local JSON may contain private data; never uploaded by backup controls.' },
      replication: { state: wallet() ? 'idle' : 'unavailable', detail: published && published.owner === wallet()?.toLowerCase()
        ? `Last publication request returned ${published.cid}; not proof of retention or automatic discovery.`
        : 'No public availability publication verified. Preview and explicit consent required; meeting IDs and private events excluded.' },
    }),
  };
}
