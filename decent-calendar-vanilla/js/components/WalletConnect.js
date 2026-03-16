export class WalletConnect extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.walletAddress = null;
    this.walletConnected = false;
    this.walletButton = null;
    this.walletDisplay = null;
    this.walletHoverDisplay = null;
    this.walletTickerCircle = null;
  }

  connectedCallback() {
    this.render();

    this.walletButton = this.shadowRoot.getElementById('wallet-connect');
    this.walletDisplay = this.shadowRoot.getElementById('wallet-display');
    this.walletHoverDisplay = this.shadowRoot.getElementById('walletHoverDisplay');
    this.walletTickerCircle = this.shadowRoot.getElementById('wallet-ticker-circle');

    if (window.ethereum) {
      this.walletButton.addEventListener('click', () => {
        if (this.walletConnected) {
          this.disconnectWallet();
        } else {
          this.connectWallet();
        }
      });

      // Listen for account changes in MetaMask
      window.ethereum.on('accountsChanged', (accounts) => {
        if (accounts.length === 0) {
          this.disconnectWallet();
        } else {
          this.walletAddress = accounts[0];
          this.walletConnected = true;
          window._walletAddress = accounts[0];
          this.updateWalletUI();
          if (window.onWalletConnected) window.onWalletConnected(accounts[0]);
        }
      });

      window.ethereum.on('chainChanged', () => window.location.reload());
    } else {
      this.walletButton.addEventListener('click', () => {
        alert('MetaMask not detected. Please install MetaMask!');
      });
    }

    // Restore if already connected
    if (window.ethereum && window.ethereum.selectedAddress) {
      this.walletAddress = window.ethereum.selectedAddress;
      this.walletConnected = true;
      window._walletAddress = this.walletAddress;
      this.updateWalletUI();
      this.animateWalletTicker(this.walletAddress);
    }
  }

  render() {
    this.shadowRoot.innerHTML = `
        <link rel="stylesheet" href="css/header.css" />
        <div id="walletHeaderContainer" style="display:flex;align-items:center;justify-content:flex-end;height:100px;">
          <div id="walletIconWrapper">
            <div class="ticker-wrapper wallet-ticker">
                <div class="ticker-circle-metamask" id="wallet-ticker-circle"></div>
            </div>
            <button id="wallet-connect" class="disconnected">
                <img id="metamaskIcon" src="assets/Metamask_Logo.png" alt="Connect Wallet" />
            </button>
            <div id="wallet-display"></div>
            <div id="walletHoverDisplay" class="wallet-hover-display"></div>
          </div>
        </div>
    `;
  }

  shortenAddress(address) {
    if (!address || address.length < 10) return address;
    return address.substring(0, 6) + '...' + address.substring(address.length - 4);
  }

  async connectWallet() {
    if (!window.ethereum) {
      alert('MetaMask not detected. Please install MetaMask!');
      return;
    }
    try {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      this.walletAddress = accounts[0];
      this.walletConnected = true;

      // Set globals for use by calendar.js, contract.js, payments.js
      window._walletAddress = accounts[0];
      const provider = new ethers.BrowserProvider(window.ethereum);
      window._walletProvider = provider;
      window._walletSigner = await provider.getSigner();

      this.updateWalletUI();
      this.animateWalletTicker(this.walletAddress);
      await this.checkNetwork();

      if (window.onWalletConnected) window.onWalletConnected(this.walletAddress);
    } catch (err) {
      alert(`Wallet connection failed: ${err.message || 'Please try again.'}`);
      this.walletConnected = false;
      this.walletAddress = null;
      this.updateWalletUI();
    }
  }

  disconnectWallet() {
    this.walletAddress = null;
    this.walletConnected = false;
    window._walletAddress = null;
    window._walletProvider = null;
    window._walletSigner = null;
    this.updateWalletUI();
    if (this.walletTickerCircle) {
      this.walletTickerCircle.innerHTML = '';
      this.walletTickerCircle.classList.remove('animated');
    }
    if (window.onWalletDisconnected) window.onWalletDisconnected();
  }

  async checkNetwork() {
    try {
      const chainId = await window.ethereum.request({ method: 'eth_chainId' });
      // 0x89 = Polygon mainnet (137), 0x13882 = Amoy testnet (80002)
      if (chainId !== '0x89' && chainId !== '0x13882') {
        const switchIt = confirm('DecentCalendar runs on Polygon. Switch network now?');
        if (switchIt) {
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '0x89' }],
          });
        }
      }
    } catch (e) {
      console.warn('Network check failed:', e);
    }
  }

  updateWalletUI() {
    if (!this.walletButton || !this.walletDisplay) return;
    if (this.walletConnected && this.walletAddress) {
      this.walletButton.classList.remove('disconnected');
      this.walletButton.classList.add('connected');
      this.walletDisplay.innerHTML =
        `<span class="wallet-display-label">${this.shortenAddress(this.walletAddress)}</span>`;
    } else {
      this.walletButton.classList.remove('connected');
      this.walletButton.classList.add('disconnected');
      this.walletDisplay.innerHTML = '';
    }
  }

  animateWalletTicker(address) {
    const circle = this.walletTickerCircle;
    if (!circle) return;
    circle.innerHTML = '';

    const display = [
      ' ', '⚡️', ' ', '⚸', ' ', '⚡️', ' ',
      ...address.slice(0, 6),
      ' ', 'logo', ' ', 'logo', ' ', 'logo', ' ', 'logo', ' ',
      ...address.slice(-4),
    ];
    const n = display.length;
    const radius = 47;
    const origin_x = 61;
    const origin_y = 60;

    for (let i = 0; i < n; i++) {
      const angle = (2 * Math.PI * i) / n - Math.PI / 2;
      const x = radius * Math.cos(angle) + origin_x;
      const y = radius * Math.sin(angle) + origin_y;

      if (display[i] === 'logo') {
        const img = document.createElement('img');
        img.src = 'assets/Ommm_Token_Logo.png';
        img.alt = 'token';
        img.className = 'ticker-letter-logo';
        img.style.left = `${x}px`;
        img.style.top = `${y}px`;
        img.style.position = 'absolute';
        img.style.width = '12px';
        img.style.height = '12px';
        img.style.padding = '4px';
        img.style.transform = `translate(-50%, -50%) rotate(${-angle}rad) rotate(90deg)`;
        circle.appendChild(img);
      } else {
        const span = document.createElement('span');
        span.className = 'ticker-letter';
        span.textContent = display[i];
        span.style.left = `${x}px`;
        span.style.top = `${y}px`;
        span.style.position = 'absolute';
        span.style.transform = `translate(-50%, -50%) rotate(${-angle}rad) rotate(90deg)`;
        circle.appendChild(span);
      }
    }
    circle.classList.add('animated');
  }
}

customElements.define('wallet-connect', WalletConnect);
