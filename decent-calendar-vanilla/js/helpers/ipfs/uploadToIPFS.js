/* uploadToIPFS.js — browser-compatible w3up upload helper.
   Uses window.w3up (loaded via CDN browser.min.js bundle).
   Export: uploadDataToIPFS(data, client) */

export async function uploadDataToIPFS(data, client) {
  try {
    if (!client) {
      console.error('w3up client not provided.');
      return null;
    }

    const historyKey = 'calendarHistory';
    // Retrieve existing snapshot history from localStorage
    const storedHistory = JSON.parse(localStorage.getItem(historyKey) || '[]');
    // Add snapshotHistory to the data (most recent first)
    data.snapshotHistory = storedHistory.map(entry => ({
      cid: entry.cid,
      timestamp: entry.timestamp,
    }));

    // Create the blob after modifying the data
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const cid = await client.uploadFile(blob);

    const now = new Date().toISOString();
    const snapshotEntry = {
      cid: cid.toString(),
      data,
      snapshotHistory: [...storedHistory.map(h => ({ cid: h.cid, timestamp: h.timestamp }))],
    };
    localStorage.setItem(`calendarSnapshot-${now}`, JSON.stringify(snapshotEntry));

    const newEntry = { timestamp: now, cid: cid.toString() };
    storedHistory.unshift(newEntry);
    localStorage.setItem(historyKey, JSON.stringify(storedHistory));

    return cid.toString();
  } catch (err) {
    console.error('IPFS Upload Error:', err);
    return null;
  }
}
