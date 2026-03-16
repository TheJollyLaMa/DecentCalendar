/* WalletConnect.js — <wallet-connect> Web Component (Shadow DOM)
   MetaMask connect + Optimism mainnet check.
   Address characters + icons orbit the MetaMask fox in an animated ring.
   Chain badge shows current network.
   Sets window._walletAddress / window._walletSigner.
   Fires window.onWalletConnected(address) / window.onWalletDisconnected(). */

class WalletConnect extends HTMLElement {
  constructor() {
    super();
    this._walletAddress = null;
    this._chainName = '';
    this._chainColor = '#0ff';
  }

  connectedCallback() {
    this._shadow = this.attachShadow({ mode: 'open' });
    this._render();
    this._setupEthereumListeners();
  }

  // ---- Rendering ----

  _render() {
    const addr = this._walletAddress;
    const chainColor = this._chainColor;

    this._shadow.innerHTML = `
      <style>
        :host { display: flex; align-items: center; }

        .wallet-outer {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .connect-prompt {
          font-family: chalkduster, fantasy, sans-serif;
          font-size: 0.85rem;
          color: #0ff;
          text-shadow: 0 0 5px #0ff, 0 0 10px #0ff;
          white-space: nowrap;
        }

        /* Orbital ring wrapper — sized to hold ring + button */
        .wallet-wrapper {
          position: relative;
          width: 120px;
          height: 120px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        /* Spinning orbit track */
        .orbit-ring {
          position: absolute;
          top: 0; left: 0;
          width: 120px;
          height: 120px;
          animation: wallet-spin 10s linear infinite;
          pointer-events: none;
        }

        .orbit-char {
          position: absolute;
          font-size: 9px;
          font-family: monospace;
          font-weight: bold;
          color: ${chainColor};
          text-shadow: 0 0 6px ${chainColor};
          /* Counter-rotate each char so text stays upright */
          animation: wallet-counter 10s linear infinite;
          transform-origin: center center;
        }

        .orbit-img {
          position: absolute;
          width: 14px;
          height: 14px;
          filter: drop-shadow(0 0 4px ${chainColor});
          animation: wallet-counter 10s linear infinite;
          transform-origin: center center;
        }

        /* MetaMask button, centered absolutely */
        .wallet-btn {
          position: absolute;
          top: 50%; left: 50%;
          transform: translate(-50%, -50%);
          background: transparent;
          border: none;
          cursor: pointer;
          padding: 0;
          border-radius: 50%;
          box-shadow: 0 0 14px ${chainColor}88;
          transition: box-shadow 0.2s ease, transform 0.2s ease;
          z-index: 2;
          line-height: 0;
        }
        .wallet-btn:hover {
          box-shadow: 0 0 28px ${chainColor};
          transform: translate(-50%, -50%) scale(1.08);
        }
        .wallet-logo {
          width: 48px;
          height: 48px;
          display: block;
        }

        /* Chain badge — bottom-right of the wrapper */
        .chain-badge {
          position: absolute;
          bottom: 4px;
          right: 4px;
          background: ${chainColor};
          color: #000;
          font-size: 8px;
          font-weight: bold;
          font-family: monospace;
          padding: 2px 5px;
          border-radius: 4px;
          z-index: 3;
          white-space: nowrap;
          letter-spacing: 0.5px;
          pointer-events: none;
        }

        @keyframes wallet-spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes wallet-counter {
          from { transform: rotate(0deg); }
          to   { transform: rotate(-360deg); }
        }
      </style>

      <div class="wallet-outer">
        ${!addr ? '<span class="connect-prompt">Connect Wallet to Begin</span>' : ''}
        <div class="wallet-wrapper">
          <div class="orbit-ring" id="orbit-ring"></div>
          <button class="wallet-btn" title="${addr ? 'Click to disconnect' : 'Connect MetaMask'}">
            <img src="assets/Metamask_Logo.png" alt="MetaMask Logo" class="wallet-logo" />
          </button>
          ${addr && this._chainName
            ? `<div class="chain-badge">${this._chainName}</div>`
            : ''}
        </div>
      </div>
    `;

    if (addr) {
      this._populateOrbit(addr);
    }

    this._shadow.querySelector('.wallet-btn').addEventListener('click', () => {
      if (this._walletAddress) {
        this._disconnect();
      } else {
        this._connect();
      }
    });
  }

  // ---- Build Orbital Ring ----

  _populateOrbit(addr) {
    const ring = this._shadow.getElementById('orbit-ring');
    if (!ring) return;

    // Characters to orbit: first 6 chars, icons, last 4 chars
    const startChars = addr.slice(0, 6).split('');
    const endChars = addr.slice(-4).split('');
    // We use image icons as orbital elements
    const iconSrcs = [
      'assets/Ommm_Token_Logo.png',
      'assets/DecentSmartHome_Logo.png',
      'assets/Metamask_Logo.png',
      'assets/Ommm_Token_Logo.png',
    ];

    // Build array of items: {type:'char'|'img', value}
    const items = [
      ...startChars.map(c => ({ type: 'char', value: c })),
      ...iconSrcs.map(src => ({ type: 'img', value: src })),
      ...endChars.map(c => ({ type: 'char', value: c })),
    ];

    const wrapperSize = 120;    // matches .wallet-wrapper width/height
    const centerX = wrapperSize / 2;  // 60
    const centerY = wrapperSize / 2;  // 60
    const radius = 52;                // orbit radius in px
    const total = items.length;

    items.forEach((item, i) => {
      // Start from top (-π/2) and go clockwise
      const angle = (2 * Math.PI * i) / total - Math.PI / 2;
      const x = centerX + radius * Math.cos(angle);
      const y = centerY + radius * Math.sin(angle);

      if (item.type === 'char') {
        const span = document.createElement('span');
        span.classList.add('orbit-char');
        span.textContent = item.value;
        // Center the 9px char (~5px wide, 9px tall) on the orbit point
        span.style.left = `${x - 4.5}px`;
        span.style.top = `${y - 4.5}px`;
        ring.appendChild(span);
      } else {
        const img = document.createElement('img');
        img.classList.add('orbit-img');
        img.src = item.value;
        img.alt = '';
        // Center the 14px icon on the orbit point
        img.style.left = `${x - 7}px`;
        img.style.top = `${y - 7}px`;
        ring.appendChild(img);
      }
    });
  }

  // ---- Wallet Logic ----

  async _connect() {
    if (!window.ethereum) {
      alert('MetaMask not detected. Please install MetaMask.');
      return;
    }
    try {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      const provider = new ethers.BrowserProvider(window.ethereum);
      this._walletAddress = accounts[0];
      window._walletAddress = accounts[0];
      window._walletSigner = await provider.getSigner();
      await this._checkNetwork(provider);
      this._render();
      if (window.onWalletConnected) window.onWalletConnected(this._walletAddress);
    } catch (err) {
      console.error('Wallet connection error:', err);
      alert('Failed to connect wallet.');
    }
  }

  async _checkNetwork(provider) {
    try {
      const network = await provider.getNetwork();
      const chainId = Number(network.chainId);

      // Optimism mainnet (10) + Optimism Goerli (420) + Optimism Sepolia (11155420)
      const OPTIMISM_CHAINS = {
        10: { name: '⚡ OP', color: '#ff0420' },
        420: { name: '⚡ OP Goerli', color: '#ff0420' },
        11155420: { name: '⚡ OP Sepolia', color: '#ff6688' },
      };

      if (OPTIMISM_CHAINS[chainId]) {
        this._chainName = OPTIMISM_CHAINS[chainId].name;
        this._chainColor = OPTIMISM_CHAINS[chainId].color;
      } else {
        // Not on Optimism — prompt switch
        this._chainName = '';
        this._chainColor = '#0ff';
        const switchNow = confirm(
          'DecentCalendar runs on Optimism. Switch to Optimism mainnet now?'
        );
        if (switchNow) {
          try {
            await window.ethereum.request({
              method: 'wallet_switchEthereumChain',
              params: [{ chainId: '0xa' }],
            });
          } catch (switchErr) {
            if (switchErr.code === 4902) {
              // Chain not in wallet — add it
              await window.ethereum.request({
                method: 'wallet_addEthereumChain',
                params: [{
                  chainId: '0xa',
                  chainName: 'Optimism',
                  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
                  rpcUrls: ['https://mainnet.optimism.io'],
                  blockExplorerUrls: ['https://optimistic.etherscan.io'],
                }],
              });
            }
          }
          // Re-read chain after switch
          const updated = await provider.getNetwork();
          const newId = Number(updated.chainId);
          if (OPTIMISM_CHAINS[newId]) {
            this._chainName = OPTIMISM_CHAINS[newId].name;
            this._chainColor = OPTIMISM_CHAINS[newId].color;
          }
        }
      }
    } catch (err) {
      console.warn('Network check failed:', err);
    }
  }

  _disconnect() {
    this._walletAddress = null;
    this._chainName = '';
    this._chainColor = '#0ff';
    window._walletAddress = null;
    window._walletSigner = null;
    this._render();
    if (window.onWalletDisconnected) window.onWalletDisconnected();
  }

  // ---- Ethereum Event Listeners ----

  _setupEthereumListeners() {
    if (!window.ethereum) return;

    window.ethereum.on('accountsChanged', (accounts) => {
      if (accounts.length === 0) {
        this._disconnect();
      } else {
        const provider = new ethers.BrowserProvider(window.ethereum);
        this._walletAddress = accounts[0];
        window._walletAddress = accounts[0];
        provider.getSigner().then(async (signer) => {
          window._walletSigner = signer;
          await this._checkNetwork(provider);
          this._render();
          if (window.onWalletConnected) window.onWalletConnected(this._walletAddress);
        });
      }
    });

    window.ethereum.on('chainChanged', () => {
      window.location.reload();
    });
  }
}

customElements.define('wallet-connect', WalletConnect);
