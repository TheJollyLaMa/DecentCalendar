/* ipfs.js — IPFS integration via Pinata REST API */

const IPFS_GATEWAY = 'https://gateway.pinata.cloud/ipfs/';

/**
 * Upload a JSON object to IPFS via Pinata.
 * Requires pinata_api_key and pinata_api_secret in localStorage.
 * Returns the CID string, or null if no keys are set.
 */
async function uploadToIPFS(jsonData) {
  const apiKey = localStorage.getItem('pinata_api_key') || '';
  const apiSecret = localStorage.getItem('pinata_api_secret') || '';

  if (!apiKey || !apiSecret) {
    console.warn('No Pinata keys found — falling back to localStorage only');
    return null;
  }

  try {
    const response = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'pinata_api_key': apiKey,
        'pinata_secret_api_key': apiSecret,
      },
      body: JSON.stringify({
        pinataContent: jsonData,
        pinataMetadata: {
          name: `decent-calendar-${jsonData.tokenId !== undefined ? jsonData.tokenId : (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now() + '-' + Math.random().toString(36).slice(2))}`,
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`IPFS upload failed: ${errText}`);
    }

    const result = await response.json();
    console.log('Pinned to IPFS:', result.IpfsHash);
    updateIPFSStatus(true);
    return result.IpfsHash;
  } catch (err) {
    console.error('uploadToIPFS error:', err);
    updateIPFSStatus(false);
    return null;
  }
}

/**
 * Fetch a JSON document from IPFS via the Pinata gateway.
 */
async function fetchFromIPFS(cid) {
  const response = await fetch(`${IPFS_GATEWAY}${cid}`);
  if (!response.ok) throw new Error(`Failed to fetch from IPFS: ${cid}`);
  return response.json();
}

/**
 * Update the IPFS connection indicator in the header.
 */
function updateIPFSStatus(connected) {
  const indicator = document.getElementById('ipfs-status');
  if (indicator) {
    indicator.textContent = connected ? 'IPFS: ✅ connected' : 'IPFS: disconnected';
    indicator.className = connected ? 'ipfs-indicator connected' : 'ipfs-indicator';
  }
}
