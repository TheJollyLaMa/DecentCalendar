/* IPFSStatus.js — <ipfs-status> Web Component (Shadow DOM)
   w3up / web3.storage email-auth flow (no Pinata API keys needed).
   Exposes window.w3upClient, window.connectToW3up, window.promptForEmail.
   Fires window.onIPFSUploadClick() on status-circle click.
   Shows CID import UI in the hover popup. */

export class IPFSStatus extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.ipfsConnected = false;
  }

  connectedCallback() {
    this.render();
    this.renderWaitingModal();

    // Global hook: email prompt for waiting-modal "Enter Email" button
    window.promptForEmail = async () => {
      const email = prompt('Enter your email to login:');
      if (!email) {
        window.hideIPFSWaitingModal();
        alert('Please enter a valid email to login.');
        return;
      }
      await this.finishW3upLogin(email);
    };

    // Global hook: trigger w3up connect flow from anywhere
    window.connectToW3up = async () => {
      if (!this.ipfsConnected) {
        await this.connectToW3up();
      } else {
        console.log('Already connected to IPFS.');
      }
    };

    this.checkForStoredCredentials();

    this.statusWrapper = this.shadowRoot.getElementById('ipfs-status');
    this.ipfsTickerCircle = this.shadowRoot.getElementById('ipfs-ticker-circle');
    this.ipfsHoverPopup = this.shadowRoot.getElementById('ipfsHoverPopup');

    // Status circle click: trigger calendar upload (if connected) or connect flow
    if (this.statusWrapper) {
      this.statusWrapper.addEventListener('click', async () => {
        if (window.w3upClient) {
          if (window.onIPFSUploadClick) {
            await window.onIPFSUploadClick();
          }
        } else {
          window.connectToW3up();
        }
      });

      this.statusWrapper.addEventListener('mouseenter', () => {
        if (this.ipfsHoverPopup) this.ipfsHoverPopup.style.display = 'block';
      });

      this.statusWrapper.addEventListener('mouseleave', () => {
        if (this.ipfsHoverPopup) this.ipfsHoverPopup.style.display = 'none';
      });
    }

    // Default hover message before connection
    if (this.ipfsHoverPopup) {
      this.ipfsHoverPopup.innerHTML = 'Not connected to IPFS';
    }

    // Wire CID import button
    const importBtn = this.shadowRoot.getElementById('cid-import-btn');
    if (importBtn) {
      importBtn.addEventListener('click', async () => {
        const cid = this.shadowRoot.getElementById('cid-import-input').value.trim();
        if (cid && window.onIPFSImportCID) {
          await window.onIPFSImportCID(cid);
        }
      });
    }
  }

  // ---- w3up Connection ----

  async checkForStoredCredentials() {
    try {
      const { connectW3upClient } = await import('../helpers/ipfs/w3upClient.js');
      const result = await connectW3upClient(true);
      if (result) {
        this.ipfsConnected = true;
        window.w3upClient = result.client;
        this.updateUIConnected();
        if (window.onIPFSReady) window.onIPFSReady(result.client);
      } else {
        console.warn('No stored credentials found.');
        window.showIPFSWaitingModal();
      }
    } catch (err) {
      console.warn('Auto-connect failed:', err);
      window.showIPFSWaitingModal();
    }
  }

  async connectToW3up() {
    try {
      const { connectW3upClient } = await import('../helpers/ipfs/w3upClient.js');
      const stored = await connectW3upClient(true);
      if (stored) {
        this.ipfsConnected = true;
        window.w3upClient = stored.client;
        this.updateUIConnected();
        if (window.onIPFSReady) window.onIPFSReady(stored.client);
        return;
      }
      // No stored credentials — show modal then prompt
      window.showIPFSWaitingModal();
    } catch (err) {
      console.error('IPFS connection failed:', err);
    }
  }

  async finishW3upLogin(email) {
    try {
      const client = await window.w3up.create();
      const account = await client.login(email);
      if (account.plan) await account.plan.wait();
      const spaces = await client.spaces();
      if (!spaces || !spaces.length) throw new Error('No spaces found after login.');
      const space = spaces[0];
      await client.setCurrentSpace(space.did());
      window.hideIPFSWaitingModal();
      this.ipfsConnected = true;
      window.w3upClient = client;
      this.updateUIConnected();
      if (window.onIPFSReady) window.onIPFSReady(client);
    } catch (err) {
      window.hideIPFSWaitingModal();
      console.error('IPFS login failed:', err);
      alert('Failed to connect to IPFS: ' + err.message);
    }
  }

  // ---- UI Updates ----

  updateUIConnected() {
    if (this.statusWrapper) {
      this.statusWrapper.classList.remove('ipfs-disconnected');
      this.statusWrapper.classList.add('ipfs-connected');
    }
    // Animate DID ticker if space available
    if (this.ipfsTickerCircle && window.w3upClient) {
      try {
        const currentSpace = window.w3upClient.currentSpace
          ? (typeof window.w3upClient.currentSpace === 'function'
              ? window.w3upClient.currentSpace()
              : window.w3upClient.currentSpace)
          : null;
        const did = currentSpace && currentSpace.did ? currentSpace.did() : '';
        if (did) this._animateTicker(did);
      } catch (e) {
        console.warn('Ticker animation error:', e);
      }
    }
    this.renderSnapshotHistory();
  }

  _animateTicker(did) {
    const circle = this.ipfsTickerCircle;
    circle.innerHTML = '';
    const prefix = did.slice(8, 14);
    const suffix = did.slice(-4);

    [...prefix].forEach(char => {
      const span = document.createElement('span');
      span.classList.add('ticker-letter');
      span.textContent = char;
      circle.appendChild(span);
    });

    for (let i = 0; i < 4; i++) {
      const img = document.createElement('img');
      img.classList.add('ticker-letter');
      img.src = 'assets/IPFS_Logo.png';
      img.style.width = '10px';
      img.style.height = '10px';
      circle.appendChild(img);
    }

    [...suffix].forEach(char => {
      const span = document.createElement('span');
      span.classList.add('ticker-letter');
      span.textContent = char;
      circle.appendChild(span);
    });

    const letters = circle.querySelectorAll('.ticker-letter');
    // Circle is 90×90px → center at (45, 45); radius 38 keeps all items inside
    const centerX = 45;
    const centerY = 45;
    const radius = 38;
    const angleStep = (2 * Math.PI) / letters.length;
    letters.forEach((letter, i) => {
      const angle = i * angleStep - Math.PI / 2; // start from top
      letter.style.position = 'absolute';
      letter.style.left = `${centerX + radius * Math.cos(angle) - 4}px`;
      letter.style.top  = `${centerY + radius * Math.sin(angle) - 4}px`;
    });

    let angle = 0;
    const rotate = () => {
      circle.style.transform = `rotate(${angle}deg)`;
      angle += 0.2;
      requestAnimationFrame(rotate);
    };
    rotate();
  }

  renderSnapshotHistory() {
    if (!this.ipfsHoverPopup) return;
    const history = JSON.parse(localStorage.getItem('calendarHistory') || '[]');
    const links = history
      .slice(0, 10)
      .map(entry => {
        const date = new Date(entry.timestamp).toLocaleString();
        const cls = entry.timestamp.startsWith(new Date().toISOString().slice(0, 10))
          ? 'snapshot-today'
          : 'snapshot-old';
        return `<div class="${cls}"><a href="https://w3s.link/ipfs/${entry.cid}" target="_blank">${date}</a></div>`;
      })
      .join('');

    this.ipfsHoverPopup.innerHTML = `
      <strong>${this.ipfsConnected ? '✅ Connected to IPFS' : 'Not connected to IPFS'}</strong>
      ${links}
      <div id="cid-import-area" style="margin-top:8px;">
        <input id="cid-import-input" type="text" placeholder="Enter CID to import..."
          style="width:180px;padding:4px;background:#000;color:#0ff;border:1px solid #0ff;border-radius:4px;" />
        <button id="cid-import-btn"
          style="padding:4px 8px;background:#0ff;color:#000;border:none;border-radius:4px;cursor:pointer;">
          Import
        </button>
      </div>
    `;

    // Re-wire import button after re-render
    const importBtn = this.ipfsHoverPopup.querySelector('#cid-import-btn');
    if (importBtn) {
      importBtn.addEventListener('click', async () => {
        const input = this.ipfsHoverPopup.querySelector('#cid-import-input');
        const cid = input ? input.value.trim() : '';
        if (cid && window.onIPFSImportCID) {
          await window.onIPFSImportCID(cid);
        }
      });
    }
  }

  // ---- Waiting Modal Helpers ----

  renderWaitingModal() {
    // Managed by IPFSWaitingModal component; expose show/hide globals
    window.showIPFSWaitingModal = () => {
      let modal = document.querySelector('waiting-modal');
      if (!modal) {
        modal = document.createElement('waiting-modal');
        document.body.appendChild(modal);
      }
    };
    window.hideIPFSWaitingModal = () => {
      const modal = document.querySelector('waiting-modal');
      if (modal) modal.remove();
    };
  }

  // ---- Shadow DOM Render ----

  render() {
    this.shadowRoot.innerHTML = `
      <link rel="stylesheet" href="css/header.css" />
      <style>
        :host { display: block; }
        .ticker-wrapper {
          position: relative;
          width: 100px;
          height: 100px;
          cursor: pointer;
        }
        #ipfs-status {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          position: relative;
        }
        #ipfs-status.ipfs-disconnected #ipfsIcon {
          filter: grayscale(60%) drop-shadow(0 0 4px #0ff);
          opacity: 0.7;
        }
        #ipfs-status.ipfs-connected #ipfsIcon {
          filter: drop-shadow(0 0 8px #0f0);
          animation: glow-pulse 1.5s ease-in-out infinite alternate;
        }
        #ipfsIcon {
          width: 40px;
          height: 40px;
          position: absolute;
          top: 50%; left: 50%;
          transform: translate(-50%, -50%);
          z-index: 2;
        }
        #ipfs-ticker-circle {
          position: absolute;
          /* Center the 90×90 circle inside the 100×100 wrapper */
          top: 5px;
          left: 5px;
          width: 90px;
          height: 90px;
          /* rotate() via JS will spin around the circle's own center (45,45) */
          transform-origin: 45px 45px;
        }
        .ticker-letter {
          position: absolute;
          font-size: 8px;
          color: #0ff;
          font-family: monospace;
          line-height: 1;
        }
        #ipfsHoverPopup {
          display: none;
          position: absolute;
          top: 110%;
          left: 0;
          background: rgba(0,0,0,0.92);
          border: 1px solid #0ff;
          border-radius: 8px;
          padding: 10px;
          min-width: 240px;
          z-index: 1000;
          color: #0ff;
          font-family: monospace;
          font-size: 0.75rem;
        }
        #ipfsHoverPopup a {
          color: #0ff;
          text-decoration: underline;
        }
        .snapshot-today { color: #0f0; }
        .snapshot-old   { color: #0ff; }
        @keyframes glow-pulse {
          from { filter: drop-shadow(0 0 6px rgba(0,255,0,0.5)); }
          to   { filter: drop-shadow(0 0 16px rgba(0,255,0,1)); }
        }
      </style>
      <div id="ipfs-status" class="ipfs-disconnected">
        <div class="ticker-wrapper">
          <div id="ipfs-ticker-circle"></div>
          <img id="ipfsIcon" src="assets/IPFS_Logo.png" alt="IPFS" />
        </div>
        <div id="ipfsHoverPopup">Not connected to IPFS</div>
      </div>
    `;

    // Show a placeholder spinning ring even before IPFS connection
    this._startIdleRing();
  }

  // Idle ring: show "·IPFS·" dots orbiting before connection is established
  _startIdleRing() {
    const circle = this.shadowRoot.getElementById('ipfs-ticker-circle');
    if (!circle) return;

    const chars = ['·', 'I', 'P', 'F', 'S', '·', 'c', 'l', 'i', 'c', 'k', '·'];
    chars.forEach((char, i) => {
      const span = document.createElement('span');
      span.classList.add('ticker-letter');
      span.textContent = char;
      span.style.color = 'rgba(0, 255, 255, 0.53)';
      const angle = (2 * Math.PI * i) / chars.length - Math.PI / 2;
      span.style.left = `${45 + 38 * Math.cos(angle) - 4}px`;
      span.style.top  = `${45 + 38 * Math.sin(angle) - 4}px`;
      circle.appendChild(span);
    });

    this._idleRotation = 0;
    const spin = () => {
      // Stop spinning once ticker has been replaced by real DID
      if (this.ipfsConnected) return;
      this._idleRotation += 0.15;
      circle.style.transform = `rotate(${this._idleRotation}deg)`;
      requestAnimationFrame(spin);
    };
    spin();
  }
}

if (!customElements.get('ipfs-status')) {
  customElements.define('ipfs-status', IPFSStatus);
}
