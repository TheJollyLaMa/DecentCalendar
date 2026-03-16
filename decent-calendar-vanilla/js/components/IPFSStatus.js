/* IPFSStatus.js — <ipfs-status> Web Component (Shadow DOM)
   Pinata IPFS connection via localStorage API keys.
   Exposes window.uploadToIPFS() and window.fetchFromIPFS() as globals.
   Fires window.onIPFSUploadClick() on click. */

const _IPFS_GATEWAY = 'https://gateway.pinata.cloud/ipfs/';

class IPFSStatus extends HTMLElement {
  constructor() {
    super();
    this._connected = false;
  }

  connectedCallback() {
    this._shadow = this.attachShadow({ mode: 'open' });
    this._exposeGlobals();
    this._checkLocalKeys();
    this._render();
  }

  // ---- Rendering ----

  _render() {
    const statusText = this._connected ? 'IPFS: ✅ connected' : 'IPFS: disconnected';
    this._shadow.innerHTML = `
      <style>
        :host { display: block; }
        .ipfs-indicator {
          font-family: chalkduster, fantasy, sans-serif;
          font-size: 0.75rem;
          color: #666;
          cursor: pointer;
          padding: 4px 8px;
          border-radius: 4px;
          transition: color 0.3s ease, text-shadow 0.3s ease;
          white-space: nowrap;
          user-select: none;
        }
        .ipfs-indicator:hover {
          color: #0ff;
          text-shadow: 0 0 6px #0ff;
        }
        .ipfs-indicator.connected {
          color: #0f0;
          text-shadow: 0 0 5px #0f0;
        }
        .ipfs-indicator.connected:hover {
          color: #0f0;
          text-shadow: 0 0 10px #0f0;
        }
      </style>
      <div class="ipfs-indicator ${this._connected ? 'connected' : ''}"
           title="Click to manage IPFS / Pinata connection">
        ${statusText}
      </div>
    `;
    this._shadow.querySelector('.ipfs-indicator').addEventListener('click', () => {
      if (window.onIPFSUploadClick) window.onIPFSUploadClick();
    });
  }

  // ---- Expose globals for events.js / calendar.js ----

  _exposeGlobals() {
    const self = this;

    window.uploadToIPFS = async function (jsonData) {
      const apiKey = localStorage.getItem('pinata_api_key') || '';
      const apiSecret = localStorage.getItem('pinata_api_secret') || '';

      if (!apiKey || !apiSecret) {
        console.warn('No Pinata keys found — falling back to localStorage only');
        return null;
      }

      try {
        const uniqueId =
          jsonData.tokenId !== undefined
            ? jsonData.tokenId
            : typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : Date.now() + '-' + Math.random().toString(36).slice(2);

        const response = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            pinata_api_key: apiKey,
            pinata_secret_api_key: apiSecret,
          },
          body: JSON.stringify({
            pinataContent: jsonData,
            pinataMetadata: { name: `decent-calendar-${uniqueId}` },
          }),
        });

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`IPFS upload failed: ${errText}`);
        }

        const result = await response.json();
        console.log('Pinned to IPFS:', result.IpfsHash);
        self._setConnected(true);
        return result.IpfsHash;
      } catch (err) {
        console.error('uploadToIPFS error:', err);
        self._setConnected(false);
        return null;
      }
    };

    window.fetchFromIPFS = async function (cid) {
      const response = await fetch(`${_IPFS_GATEWAY}${cid}`);
      if (!response.ok) throw new Error(`Failed to fetch from IPFS: ${cid}`);
      return response.json();
    };
  }

  // ---- Connection State ----

  _setConnected(connected) {
    this._connected = connected;
    this._render();
  }

  _checkLocalKeys() {
    const apiKey = localStorage.getItem('pinata_api_key');
    const apiSecret = localStorage.getItem('pinata_api_secret');
    this._connected = !!(apiKey && apiSecret);
  }
}

customElements.define('ipfs-status', IPFSStatus);
