/* AppTitle.js — <app-title> Web Component (Shadow DOM)
   Renders the 🗓️ Decent Calendar branding.
   Click the title (or press '?') to open the About modal.
   The overlay is appended to document.body so that the header's
   backdrop-filter stacking context does not clip the fixed overlay. */

class AppTitle extends HTMLElement {
  connectedCallback() {
    const shadow = this.attachShadow({ mode: 'open' });
    shadow.innerHTML = `
      <style>
        :host {
          display: block;
          text-align: center;
        }

        /* ── Title ── */
        .title {
          font-family: chalkduster, fantasy, sans-serif;
          font-size: 1.4rem;
          color: #0ff;
          text-shadow: 0 0 8px #0ff, 0 0 18px #0ff;
          margin: 0;
          letter-spacing: 2px;
          white-space: nowrap;
          cursor: pointer;
          transition: text-shadow 0.2s ease, color 0.2s ease;
          user-select: none;
        }
        .title:hover {
          color: #fff;
          text-shadow: 0 0 12px #0ff, 0 0 28px #0ff, 0 0 48px #7300ff;
        }
        .emoji {
          font-size: 1.6rem;
        }
      </style>

      <h1 class="title" id="appTitle" tabindex="0" role="button" aria-label="About Decent Calendar">
        <span class="emoji">🗓️</span> Decent Calendar
      </h1>
    `;

    // ── Build the overlay in the light DOM (document.body) so that
    //    the header's backdrop-filter stacking context doesn't clip it.
    this._overlay = document.createElement('div');
    this._overlay.id = 'decent-about-overlay';
    this._overlay.setAttribute('role', 'dialog');
    this._overlay.setAttribute('aria-modal', 'true');
    this._overlay.setAttribute('aria-labelledby', 'decent-about-modal-title');
    this._overlay.innerHTML = `
      <style>
        #decent-about-overlay {
          display: none;
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.78);
          z-index: 99999;
          align-items: center;
          justify-content: center;
          backdrop-filter: blur(5px);
          -webkit-backdrop-filter: blur(5px);
          animation: dc-fadeIn 0.2s ease;
        }
        #decent-about-overlay.open {
          display: flex;
        }
        @keyframes dc-fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }

        /* ── Modal Box ── */
        #decent-about-overlay .about-modal {
          position: relative;
          background: rgba(0, 0, 20, 0.96);
          border: 1px solid rgba(0, 255, 255, 0.45);
          border-radius: 14px;
          padding: 2rem 2.2rem 1.6rem;
          max-width: 600px;
          width: 92%;
          max-height: 80vh;
          overflow-y: auto;
          box-shadow: 0 0 40px rgba(0, 255, 255, 0.25), 0 0 80px rgba(115, 0, 255, 0.18);
          animation: dc-slideUp 0.25s ease;
          color: #cff;
          font-family: chalkduster, fantasy, sans-serif;
          box-sizing: border-box;
        }
        @keyframes dc-slideUp {
          from { transform: translateY(30px); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }

        /* scrollbar */
        #decent-about-overlay .about-modal::-webkit-scrollbar { width: 6px; }
        #decent-about-overlay .about-modal::-webkit-scrollbar-track { background: transparent; }
        #decent-about-overlay .about-modal::-webkit-scrollbar-thumb { background: rgba(0,255,255,0.3); border-radius: 3px; }

        /* ── Close Button ── */
        #decent-about-overlay .close-btn {
          position: absolute;
          top: 0.8rem;
          right: 1rem;
          background: none;
          border: none;
          color: #0ff;
          font-size: 1.5rem;
          cursor: pointer;
          line-height: 1;
          transition: color 0.15s;
        }
        #decent-about-overlay .close-btn:hover { color: #fff; }

        /* ── Modal Header ── */
        #decent-about-overlay .modal-logo {
          font-size: 2.6rem;
          text-align: center;
          margin-bottom: 0.3rem;
        }
        #decent-about-overlay .modal-title {
          font-size: 1.3rem;
          color: #0ff;
          text-shadow: 0 0 8px #0ff;
          text-align: center;
          margin: 0 0 0.25rem;
          letter-spacing: 2px;
        }
        #decent-about-overlay .modal-tagline {
          font-size: 0.8rem;
          color: #7af;
          text-align: center;
          margin: 0 0 1.3rem;
          opacity: 0.9;
          letter-spacing: 1px;
          font-family: sans-serif;
        }

        /* ── Sections ── */
        #decent-about-overlay .modal-section {
          margin-bottom: 1.1rem;
        }
        #decent-about-overlay .modal-section h3 {
          font-size: 0.9rem;
          color: #0ff;
          text-shadow: 0 0 6px #0ff;
          margin: 0 0 0.45rem;
          letter-spacing: 1px;
          border-bottom: 1px solid rgba(0,255,255,0.2);
          padding-bottom: 0.25rem;
        }
        #decent-about-overlay .modal-section p,
        #decent-about-overlay .modal-section li {
          font-size: 0.8rem;
          line-height: 1.6;
          color: #b0e8ff;
          font-family: sans-serif;
          margin: 0 0 0.35rem;
        }
        #decent-about-overlay .modal-section ul {
          margin: 0;
          padding-left: 1.3rem;
        }
        #decent-about-overlay .modal-section a {
          color: #0ff;
          text-decoration: underline;
        }
        #decent-about-overlay .modal-section a:hover { color: #fff; }

        /* ── How-To Steps ── */
        #decent-about-overlay .steps {
          list-style: none;
          padding: 0;
          margin: 0;
          counter-reset: step-counter;
        }
        #decent-about-overlay .steps li {
          counter-increment: step-counter;
          display: flex;
          gap: 0.6rem;
          align-items: flex-start;
          margin-bottom: 0.55rem;
        }
        #decent-about-overlay .steps li::before {
          content: counter(step-counter);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 1.4rem;
          height: 1.4rem;
          border-radius: 50%;
          border: 1px solid rgba(0,255,255,0.5);
          color: #0ff;
          font-size: 0.7rem;
          flex-shrink: 0;
          margin-top: 0.1rem;
        }

        /* ── Feature Grid ── */
        #decent-about-overlay .feature-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.4rem 0.8rem;
          list-style: none;
          padding: 0;
          margin: 0;
        }
        #decent-about-overlay .feature-grid li {
          display: flex;
          align-items: flex-start;
          gap: 0.35rem;
        }
        #decent-about-overlay .feature-grid li::before {
          content: '⚡';
          flex-shrink: 0;
        }

        /* ── Links ── */
        #decent-about-overlay .link-row {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          margin-top: 0.3rem;
        }
        #decent-about-overlay .link-row a {
          display: inline-block;
          padding: 0.3rem 0.8rem;
          border: 1px solid rgba(0,255,255,0.4);
          border-radius: 20px;
          font-size: 0.75rem;
          font-family: sans-serif;
          color: #0ff;
          text-decoration: none;
          transition: background 0.15s, color 0.15s;
        }
        #decent-about-overlay .link-row a:hover {
          background: rgba(0,255,255,0.12);
          color: #fff;
        }

        /* ── Footer Hint ── */
        #decent-about-overlay .hint {
          font-size: 0.68rem;
          color: rgba(0,255,255,0.45);
          text-align: center;
          margin-top: 1rem;
          font-family: sans-serif;
        }
      </style>

      <div class="about-modal">
        <button class="close-btn" id="dc-close-btn" aria-label="Close About modal">✕</button>

        <div class="modal-logo">🗓️</div>
        <h2 class="modal-title" id="decent-about-modal-title">Decent Calendar</h2>
        <p class="modal-tagline">Decentralized scheduling for the Web3 era 🌐</p>

        <div class="modal-section">
          <h3>📖 About</h3>
          <p>
            Decent Calendar is a fully decentralized scheduling dApp built on Ethereum/Polygon.
            Book, mint, and manage time-slot NFTs — pay with crypto, PayPal, or card. All
            event data is stored on-chain and pinned to IPFS for true data sovereignty.
          </p>
        </div>

        <div class="modal-section">
          <h3>🚀 How to Use</h3>
          <ol class="steps">
            <li><strong>Connect your wallet</strong> — Click "Connect Wallet" in the top-right corner and approve the MetaMask popup. Your address will appear once connected.</li>
            <li><strong>Connect to IPFS</strong> — Click the IPFS status indicator (top-left). Enter your web3.storage email and confirm the link sent to your inbox.</li>
            <li><strong>Add an event</strong> — Click the <strong>+</strong> button or click any open timeslot on the calendar. Fill in the title, start/end times, hourly rate (POL), and choose Public or Private. Hit <em>Add Event</em>.</li>
            <li><strong>Mint a timeslot NFT</strong> — Right-click an event you own and select <em>Mint Timeslot</em>. Confirm the on-chain transaction in MetaMask. The metadata is pinned to IPFS automatically.</li>
            <li><strong>Book a timeslot</strong> — Click any public event to open the booking panel. Choose your payment method: 💎 crypto (POL/ETH), 🅿️ PayPal, or 💳 card.</li>
            <li><strong>Start a P2P meeting</strong> — After a booking is confirmed, click <em>Join Meeting</em> on the event to open a live PeerJS video room shared with the host.</li>
            <li><strong>Confirm &amp; release funds</strong> — As the calendar owner, open the event after a meeting and click <em>Confirm &amp; Release Funds</em> to finalize the smart contract payment.</li>
          </ol>
        </div>

        <div class="modal-section">
          <h3>⚡ Features</h3>
          <ul class="feature-grid">
            <li>🔗 Wallet connect (MetaMask)</li>
            <li>📦 IPFS / web3.storage pinning</li>
            <li>🪙 Time-slot NFT minting</li>
            <li>🤝 P2P video via PeerJS</li>
            <li>💎 Crypto payments (POL/ETH)</li>
            <li>🅿️ PayPal &amp; card checkout</li>
            <li>📅 FullCalendar integration</li>
            <li>🔐 Private &amp; public events</li>
          </ul>
        </div>

        <div class="modal-section">
          <h3>🔗 Links</h3>
          <div class="link-row">
            <a href="https://github.com/TheJollyLaMa/DecentCalendar" target="_blank" rel="noopener noreferrer">GitHub</a>
            <a href="https://ipfs.tech" target="_blank" rel="noopener noreferrer">IPFS</a>
            <a href="https://web3.storage" target="_blank" rel="noopener noreferrer">web3.storage</a>
            <a href="https://fullcalendar.io" target="_blank" rel="noopener noreferrer">FullCalendar</a>
            <a href="https://peerjs.com" target="_blank" rel="noopener noreferrer">PeerJS</a>
          </div>
        </div>

        <p class="hint">Press <kbd>?</kbd> to toggle this modal</p>
      </div>
    `;

    document.body.appendChild(this._overlay);

    // ── Event wiring ──
    const overlay  = this._overlay;
    const title    = shadow.getElementById('appTitle');
    const closeBtn = overlay.querySelector('#dc-close-btn');

    const openModal = () => {
      overlay.classList.add('open');
      closeBtn.focus();
    };
    const closeModal = () => {
      overlay.classList.remove('open');
      title.focus();
    };

    title.addEventListener('click', openModal);
    title.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openModal(); }
    });

    closeBtn.addEventListener('click', closeModal);

    // Close on overlay backdrop click (not on modal box itself)
    overlay.addEventListener('click', e => {
      if (e.target === overlay) closeModal();
    });

    // Global keyboard shortcut: '?' toggles the modal; Escape closes it.
    // Guard against input fields and contenteditable elements.
    this._docKeyHandler = e => {
      const tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target.isContentEditable) return;
      if (e.key === '?') {
        overlay.classList.contains('open') ? closeModal() : openModal();
      } else if (e.key === 'Escape') {
        closeModal();
      }
    };
    document.addEventListener('keydown', this._docKeyHandler);
  }

  disconnectedCallback() {
    if (this._docKeyHandler) {
      document.removeEventListener('keydown', this._docKeyHandler);
      this._docKeyHandler = null;
    }
    if (this._overlay && this._overlay.parentNode) {
      this._overlay.parentNode.removeChild(this._overlay);
    }
  }
}

customElements.define('app-title', AppTitle);
