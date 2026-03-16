export class IPFSStatus extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.ipfsConnected = false;
  }

  connectedCallback() {
    this.render();

    this.button = this.shadowRoot.getElementById('ipfsIcon');
    this.statusWrapper = this.shadowRoot.getElementById('ipfs-status');
    this.ipfsTickerCircle = this.shadowRoot.getElementById('ipfs-ticker-circle');
    this.ipfsHoverPopup = this.shadowRoot.getElementById('ipfsHoverPopup');

    // Click on IPFS icon → trigger upload hook (defined by Calendar component)
    if (this.statusWrapper) {
      this.statusWrapper.addEventListener('click', async () => {
        if (this.ipfsConnected) {
          if (window.onIPFSUploadClick) await window.onIPFSUploadClick();
        } else {
          this.promptPinataKeys();
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
      this.ipfsHoverPopup.innerHTML = 'Not connected to IPFS. Click to configure.';
    }

    // Check if Pinata keys exist and auto-connect
    this.checkForStoredKeys();

    // Expose global connect hook for external callers
    window.connectToIPFS = () => this.promptPinataKeys();
  }

  checkForStoredKeys() {
    const key = localStorage.getItem('pinata_api_key') || '';
    const secret = localStorage.getItem('pinata_api_secret') || '';
    if (key && secret) {
      this.ipfsConnected = true;
      this.updateUIConnected();
    }
  }

  promptPinataKeys() {
    const key = prompt('Enter your Pinata API Key (or leave blank to skip):');
    if (key === null) return;
    const secret = prompt('Enter your Pinata Secret API Key:');
    if (secret === null) return;

    if (key && secret) {
      localStorage.setItem('pinata_api_key', key);
      localStorage.setItem('pinata_api_secret', secret);
      this.ipfsConnected = true;
      this.updateUIConnected();
      if (window.onIPFSReady) window.onIPFSReady();
    }
  }

  updateUIConnected() {
    if (this.statusWrapper) {
      this.statusWrapper.classList.remove('ipfs-disconnected');
      this.statusWrapper.classList.add('ipfs-connected');
    }
    if (this.ipfsHoverPopup) {
      this.renderUploadHistory();
    }
    // Start ticker animation with stored key prefix
    const key = localStorage.getItem('pinata_api_key') || '';
    if (this.ipfsTickerCircle && key) {
      this.animateIPFSTicker(key);
    }
  }

  animateIPFSTicker(keyPrefix) {
    const circle = this.ipfsTickerCircle;
    if (!circle) return;
    circle.innerHTML = '';

    // Handle short keys gracefully
    const prefix = keyPrefix.length >= 10
      ? keyPrefix.slice(0, 6) + '⚸' + keyPrefix.slice(-4)
      : keyPrefix.slice(0, Math.min(keyPrefix.length, 6)) + '⚸';
    const chars = [...(prefix + '✦')];
    const n = chars.length;
    const centerX = 30;
    const centerY = 30;
    const radius = 25;

    chars.forEach((char, i) => {
      const angle = (2 * Math.PI * i) / n;
      const x = centerX + radius * Math.cos(angle);
      const y = centerY + radius * Math.sin(angle);
      const span = document.createElement('span');
      span.className = 'ticker-letter';
      span.textContent = char;
      span.style.left = `${x}px`;
      span.style.top = `${y}px`;
      span.style.position = 'absolute';
      circle.appendChild(span);
    });

    let angle = 0;
    const rotate = () => {
      circle.style.transform = `rotate(${angle}deg)`;
      angle += 0.4;
      requestAnimationFrame(rotate);
    };
    rotate();
  }

  renderUploadHistory() {
    if (!this.ipfsHoverPopup) return;
    const history = JSON.parse(localStorage.getItem('calendarIPFSHistory') || '[]');
    if (history.length === 0) {
      this.ipfsHoverPopup.innerHTML = '<strong>IPFS Connected ✅</strong><br/>Click to upload calendar events.';
      return;
    }
    const today = new Date().toISOString().slice(0, 10);
    this.ipfsHoverPopup.innerHTML =
      '<strong>IPFS Upload History</strong>' +
      history
        .slice(0, 10)
        .map((entry) => {
          const ts = typeof entry.timestamp === 'string' ? entry.timestamp : '';
          const date = new Date(ts).toLocaleString();
          const cls = ts.startsWith(today) ? 'snapshot-today' : 'snapshot-old';
          return `<div class="${cls}"><a href="https://gateway.pinata.cloud/ipfs/${entry.cid}" target="_blank">${date}</a></div>`;
        })
        .join('');
  }

  render() {
    this.shadowRoot.innerHTML = `
      <link rel="stylesheet" href="css/header.css" />
      <div id="ipfs-status" class="ipfs-disconnected">
        <div class="ticker-wrapper">
          <div id="ipfs-ticker-circle" class="ticker-circle-ipfs"
               style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:60px;height:60px;"></div>
          <img id="ipfsIcon" src="assets/IPFS_Logo.png" onerror="this.src='assets/Ommm_Token_Logo.png'" />
        </div>
        <div id="ipfsHoverPopup" class="hover-popup"></div>
      </div>
    `;
  }
}

if (!customElements.get('ipfs-status')) {
  customElements.define('ipfs-status', IPFSStatus);
}
