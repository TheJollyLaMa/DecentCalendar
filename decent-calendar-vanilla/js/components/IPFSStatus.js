export class IPFSStatus extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.ipfsConnected = false;
  }

  connectedCallback() {
    this.render();
    this.renderWaitingModal();

    window.promptForEmail = async () => {
      const email = prompt('Enter your email to login:');
      if (!email) {
        window.hideIPFSWaitingModal && window.hideIPFSWaitingModal();
        alert('Please enter a valid email to login.');
        return;
      }
      await this.finishW3upLogin(email);
    };

    this.checkForStoredCredentials();

    this.button = this.shadowRoot.getElementById('ipfsIcon');
    if (this.button) {
      this.button.addEventListener('click', () => {
        window.connectToW3up && window.connectToW3up();
      });
    }

    this.statusWrapper = this.shadowRoot.getElementById('ipfs-status');
    this.ipfsTickerCircle = this.shadowRoot.getElementById('ipfs-ticker-circle');
    this.ipfsHoverPopup = this.shadowRoot.getElementById('ipfsHoverPopup');

    if (this.statusWrapper) {
      this.statusWrapper.addEventListener('click', async () => {
        if (window.onIPFSUploadClick) {
          await window.onIPFSUploadClick();
        }
      });

      this.statusWrapper.addEventListener('mouseenter', () => {
        if (this.ipfsHoverPopup) this.ipfsHoverPopup.style.display = 'block';
      });

      this.statusWrapper.addEventListener('mouseleave', () => {
        if (this.ipfsHoverPopup) this.ipfsHoverPopup.style.display = 'none';
      });
    }

    if (this.ipfsHoverPopup) {
      this.ipfsHoverPopup.innerHTML = 'Not connected to IPFS';
    }

    window.connectToW3up = async () => {
      if (window.ethereum && window.ethereum.isConnected()) {
        if (!this.ipfsConnected) {
          await this.connectToW3up();
        }
      } else {
        console.warn('Wallet not connected. IPFS connection postponed.');
      }
    };
  }

  async checkForStoredCredentials() {
    try {
      if (!window.w3up) {
        console.warn('w3up not available yet — skipping auto-connect');
        window.showIPFSWaitingModal && window.showIPFSWaitingModal();
        return;
      }
      const client = await window.w3up.create();
      const spaces = await client.spaces();
      if (spaces && spaces.length > 0) {
        await client.setCurrentSpace(spaces[0].did());
        this.ipfsConnected = true;
        window.w3upClient = client;
        this.updateUIConnected();
        if (window.onIPFSReady) window.onIPFSReady(client);
      } else {
        console.warn('No stored spaces found.');
        this.showWaitingModal();
      }
    } catch (err) {
      console.warn('Auto-connect failed or no stored credentials:', err);
      this.showWaitingModal();
    }
  }

  async connectToW3up() {
    try {
      if (!window.w3up) {
        console.warn('w3up not available');
        return;
      }
      this.showWaitingModal();
      const email = prompt('Enter your email to login:');
      if (!email) {
        this.hideWaitingModal();
        alert('Please enter a valid email to login.');
        return;
      }
      this.finishW3upLogin(email);
    } catch (err) {
      this.hideWaitingModal();
      console.error('IPFS connection failed:', err);
      alert('Failed to connect to IPFS. Please make sure your credentials are valid.');
    }
  }

  async finishW3upLogin(email) {
    try {
      const client = await window.w3up.create();
      const account = await client.login(email);
      if (account.plan) {
        await account.plan.wait();
      }
      const spaces = await client.spaces();
      const space = spaces[0];
      await client.setCurrentSpace(space.did());
      this.hideWaitingModal();
      this.ipfsConnected = true;
      window.w3upClient = client;
      this.updateUIConnected();
      if (window.onIPFSReady) window.onIPFSReady(client);
    } catch (err) {
      this.hideWaitingModal();
      console.error('IPFS connection failed:', err);
      alert('Failed to connect to IPFS. Please make sure your credentials are valid.');
    }
  }

  updateUIConnected() {
    if (this.statusWrapper) {
      this.statusWrapper.classList.remove('ipfs-disconnected');
      this.statusWrapper.classList.add('ipfs-connected');
    }

    if (this.ipfsTickerCircle && window.w3upClient && window.w3upClient.currentSpace) {
      const did = typeof window.w3upClient.currentSpace === 'function'
        ? window.w3upClient.currentSpace().did()
        : window.w3upClient.currentSpace?.did?.();
      if (!did) {
        console.warn('Unable to retrieve DID from currentSpace.');
        return;
      }
      const prefix = did.slice(8, 14);
      const suffix = did.slice(-4);
      const tickerCircle = this.ipfsTickerCircle;
      tickerCircle.innerHTML = '';

      [...prefix].forEach(char => {
        const span = document.createElement('span');
        span.classList.add('ticker-letter');
        span.textContent = char;
        tickerCircle.appendChild(span);
      });

      for (let i = 0; i < 4; i++) {
        const img = document.createElement('img');
        img.classList.add('ticker-letter');
        img.src = 'img/IPFS_Logo.png';
        img.style.width = '12px';
        img.style.height = '12px';
        tickerCircle.appendChild(img);
      }

      [...suffix].forEach(char => {
        const span = document.createElement('span');
        span.classList.add('ticker-letter');
        span.textContent = char;
        tickerCircle.appendChild(span);
      });

      const star1 = document.createElement('span');
      star1.classList.add('ticker-letter');
      star1.textContent = '*';
      tickerCircle.appendChild(star1);

      const shakti = document.createElement('span');
      shakti.classList.add('ticker-letter');
      shakti.textContent = '⚸';
      tickerCircle.appendChild(shakti);

      const star2 = document.createElement('span');
      star2.classList.add('ticker-letter');
      star2.textContent = '*';
      tickerCircle.appendChild(star2);

      const self = this;
      function positionLetters() {
        if (!self.shadowRoot) return;
        const letters = tickerCircle.querySelectorAll('.ticker-letter');
        const wrapperEl = self.shadowRoot.querySelector('.ticker-wrapper');
        if (!wrapperEl) return;
        const centerX = tickerCircle.offsetWidth / 2;
        const centerY = tickerCircle.offsetHeight / 2;
        const radius = 45;
        const angleStep = (2 * Math.PI) / letters.length;
        letters.forEach((letter, index) => {
          const angle = index * angleStep;
          const x = centerX + radius * Math.cos(angle);
          const y = centerY + radius * Math.sin(angle);
          letter.style.position = 'absolute';
          letter.style.left = `${x}px`;
          letter.style.top = `${y}px`;
        });
      }

      const wrapper = this.shadowRoot.querySelector('.ticker-wrapper');
      if (wrapper) {
        positionLetters();
        let angle = 0;
        function rotate() {
          tickerCircle.style.transform = `rotate(${angle}deg)`;
          angle += 0.2;
          requestAnimationFrame(rotate);
        }
        rotate();
      }
    }

    if (this.ipfsHoverPopup) {
      this.ipfsHoverPopup.innerHTML = '<strong>Connected to IPFS</strong><br/>Click to upload calendar events';
    }
  }

  renderSnapshotHistory() {
    if (!this.ipfsHoverPopup) return;
    const history = JSON.parse(localStorage.getItem('calendarIPFSHistory') || '[]');
    if (history.length === 0) {
      this.ipfsHoverPopup.innerHTML = '<strong>Connected to IPFS</strong><br/>Click to upload calendar events';
      return;
    }
    this.ipfsHoverPopup.innerHTML = history
      .slice(0, 10)
      .map(entry => {
        const ts = entry.timestamp;
        const today = new Date().toISOString().slice(0, 10);
        const date = new Date(ts).toLocaleString();
        const cls = typeof ts === 'string' && ts.startsWith(today) ? 'snapshot-today' : 'snapshot-old';
        return `<div class="${cls}"><a href="https://w3s.link/ipfs/${entry.cid}" target="_blank">${date}</a></div>`;
      }).join('');
  }

  render() {
    this.shadowRoot.innerHTML = `
      <link rel="stylesheet" href="css/styles.css" />
      <link rel="stylesheet" href="css/header.css" />
      <div id="ipfs-status" class="ipfs-disconnected">
        <div class="ticker-wrapper">
          <div id="ipfs-ticker-circle" class="ticker-circle-ipfs" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);"></div>
          <img id="ipfsIcon" src="img/IPFS_Logo.png" />
        </div>
        <div id="ipfsHoverPopup" class="hover-popup">
          <div id="hoverPopupContent">
            <strong>IPFS Snapshot History</strong>
            <ul id="ipfsSnapshotList"></ul>
          </div>
        </div>
      </div>
    `;
  }

  renderWaitingModal() {
    // Modal is managed via the waiting-modal custom element appended to document.body
  }

  async showWaitingModal() {
    if (!window.customElements.get('waiting-modal')) {
      await import('./IPFSWaitingModal.js');
    }
    if (!document.querySelector('waiting-modal')) {
      const modal = document.createElement('waiting-modal');
      document.body.appendChild(modal);
    }
  }

  hideWaitingModal() {
    const existingModal = document.querySelector('waiting-modal');
    if (existingModal) existingModal.remove();
  }
}

if (!customElements.get('ipfs-status')) {
  customElements.define('ipfs-status', IPFSStatus);
}
