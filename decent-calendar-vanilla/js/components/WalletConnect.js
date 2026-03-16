/* WalletConnect.js — <wallet-connect> Web Component (Shadow DOM)
   MetaMask connect + Polygon mainnet/Amoy check.
   Sets window._walletAddress / window._walletSigner.
   Fires window.onWalletConnected(address) / window.onWalletDisconnected(). */

class WalletConnect extends HTMLElement {
  constructor() {
    super();
    this._walletAddress = null;
  }

  connectedCallback() {
    this._shadow = this.attachShadow({ mode: 'open' });
    this._render();
    this._setupEthereumListeners();
  }

  // ---- Rendering ----

  _render() {
    const addr = this._walletAddress;
    this._shadow.innerHTML = `
      <style>
        :host { display: flex; align-items: center; }
        .wallet-container {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .connect-prompt {
          font-family: chalkduster, fantasy, sans-serif;
          font-size: 0.95rem;
          color: #0ff;
          text-shadow: 0 0 5px #0ff, 0 0 10px #0ff;
          white-space: nowrap;
        }
        .wallet-info {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .addr-part {
          font-family: chalkduster, fantasy, sans-serif;
          font-size: 1rem;
          color: #0ff;
          text-shadow: 0 0 5px #0ff, 0 0 10px #0ff;
        }
        .wallet-icons {
          display: flex;
          gap: 4px;
          align-items: center;
        }
        .icon {
          width: 18px;
          height: 18px;
          filter: drop-shadow(0 0 4px #0ff);
          animation: glow 1.5s infinite alternate;
        }
        .wallet-btn {
          background: transparent;
          border: none;
          cursor: pointer;
          padding: 4px;
          border-radius: 50%;
          box-shadow: 0 0 10px rgba(0, 255, 255, 0.7);
          transition: transform 0.2s ease, box-shadow 0.2s ease;
          display: flex;
          align-items: center;
        }
        .wallet-btn:hover {
          transform: scale(1.1);
          box-shadow: 0 0 20px rgba(0, 255, 255, 1);
        }
        .wallet-logo {
          width: 44px;
          height: 44px;
          filter: drop-shadow(0 0 8px rgba(0, 255, 255, 0.8));
        }
        @keyframes glow {
          from { filter: drop-shadow(0 0 4px rgba(0, 255, 255, 0.7)); }
          to   { filter: drop-shadow(0 0 12px rgba(0, 255, 255, 1)); }
        }
      </style>
      <div class="wallet-container">
        ${addr
          ? `<div class="wallet-info">
               <span class="addr-part">${addr.slice(0, 6)}</span>
               <div class="wallet-icons">
                 <img src="assets/Ommm_Token_Logo.png" alt="Ommm" class="icon" />
                 <img src="assets/Metamask_Logo.png" alt="MetaMask" class="icon" />
                 <img src="assets/DecentSmartHome_Logo.png" alt="DSH" class="icon" />
                 <img src="assets/Metamask_Logo.png" alt="MetaMask" class="icon" />
                 <img src="assets/Ommm_Token_Logo.png" alt="Ommm" class="icon" />
               </div>
               <span class="addr-part">${addr.slice(-4)}</span>
             </div>`
          : `<span class="connect-prompt">Connect Wallet to Begin</span>`}
        <button class="wallet-btn" title="${addr ? 'Click to disconnect' : 'Connect MetaMask'}">
          <img src="assets/Metamask_Logo.png" alt="MetaMask Logo" class="wallet-logo" />
        </button>
      </div>
    `;

    this._shadow.querySelector('.wallet-btn').addEventListener('click', () => {
      if (this._walletAddress) {
        this._disconnect();
      } else {
        this._connect();
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
      this._render();
      await this._checkNetwork(provider);
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
      const supported = DECENT_CONFIG
        ? DECENT_CONFIG.supportedChainIds
        : [137, 80001, 80002]; // Polygon mainnet, Mumbai, Amoy — mirrors DECENT_CONFIG defaults
      if (!supported.includes(chainId)) {
        const switchNow = confirm('This app runs on Polygon. Switch network now?');
        if (switchNow) {
          const targetHex = DECENT_CONFIG ? DECENT_CONFIG.defaultChainHex : '0x89';
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: targetHex }],
          });
        }
      }
    } catch (err) {
      console.warn('Network check failed:', err);
    }
  }

  _disconnect() {
    this._walletAddress = null;
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
        provider.getSigner().then((signer) => {
          window._walletSigner = signer;
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
