/* AppTitle.js — <app-title> Web Component (Shadow DOM)
   Renders the 🗓️ Decent Calendar branding.
   Click the title (or press '?') to open the About modal. */

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

        /* ── About Modal Overlay ── */
        .about-overlay {
          display: none;
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.75);
          z-index: 10000;
          align-items: center;
          justify-content: center;
          backdrop-filter: blur(4px);
          -webkit-backdrop-filter: blur(4px);
          animation: fadeIn 0.2s ease;
        }
        .about-overlay.open {
          display: flex;
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }

        /* ── Modal Box ── */
        .about-modal {
          position: relative;
          background: rgba(0, 0, 20, 0.95);
          border: 1px solid rgba(0, 255, 255, 0.45);
          border-radius: 14px;
          padding: 2rem 2.2rem 1.6rem;
          max-width: 560px;
          width: 92%;
          max-height: 88vh;
          overflow-y: auto;
          box-shadow: 0 0 40px rgba(0, 255, 255, 0.25), 0 0 80px rgba(115, 0, 255, 0.15);
          animation: slideUp 0.25s ease;
          color: #cff;
          font-family: chalkduster, fantasy, sans-serif;
        }
        @keyframes slideUp {
          from { transform: translateY(30px); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }

        /* scrollbar */
        .about-modal::-webkit-scrollbar { width: 6px; }
        .about-modal::-webkit-scrollbar-track { background: transparent; }
        .about-modal::-webkit-scrollbar-thumb { background: rgba(0,255,255,0.3); border-radius: 3px; }

        /* ── Close Button ── */
        .close-btn {
          position: absolute;
          top: 0.8rem;
          right: 1rem;
          background: none;
          border: none;
          color: #0ff;
          font-size: 1.4rem;
          cursor: pointer;
          line-height: 1;
          transition: color 0.15s;
        }
        .close-btn:hover { color: #fff; }

        /* ── Modal Content ── */
        .modal-logo {
          font-size: 2.4rem;
          text-align: center;
          margin-bottom: 0.4rem;
        }
        .modal-title {
          font-size: 1.25rem;
          color: #0ff;
          text-shadow: 0 0 8px #0ff;
          text-align: center;
          margin: 0 0 0.3rem;
          letter-spacing: 2px;
        }
        .modal-tagline {
          font-size: 0.78rem;
          color: #7af;
          text-align: center;
          margin: 0 0 1.2rem;
          opacity: 0.85;
          letter-spacing: 1px;
          font-family: sans-serif;
        }
        .modal-section {
          margin-bottom: 1.1rem;
        }
        .modal-section h3 {
          font-size: 0.9rem;
          color: #0ff;
          text-shadow: 0 0 6px #0ff;
          margin: 0 0 0.4rem;
          letter-spacing: 1px;
          border-bottom: 1px solid rgba(0,255,255,0.2);
          padding-bottom: 0.25rem;
        }
        .modal-section p,
        .modal-section li {
          font-size: 0.78rem;
          line-height: 1.55;
          color: #b0e8ff;
          font-family: sans-serif;
          margin: 0 0 0.3rem;
        }
        .modal-section ul {
          margin: 0;
          padding-left: 1.2rem;
        }
        .modal-section a {
          color: #0ff;
          text-decoration: underline;
        }
        .modal-section a:hover { color: #fff; }

        .feature-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.4rem 0.8rem;
          list-style: none;
          padding: 0;
          margin: 0;
        }
        .feature-grid li {
          display: flex;
          align-items: flex-start;
          gap: 0.35rem;
        }
        .feature-grid li::before {
          content: '⚡';
          flex-shrink: 0;
        }

        .link-row {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          margin-top: 0.3rem;
        }
        .link-row a {
          display: inline-block;
          padding: 0.3rem 0.75rem;
          border: 1px solid rgba(0,255,255,0.4);
          border-radius: 20px;
          font-size: 0.75rem;
          font-family: sans-serif;
          color: #0ff;
          text-decoration: none;
          transition: background 0.15s, color 0.15s;
        }
        .link-row a:hover {
          background: rgba(0,255,255,0.12);
          color: #fff;
        }

        .hint {
          font-size: 0.68rem;
          color: rgba(0,255,255,0.45);
          text-align: center;
          margin-top: 1rem;
          font-family: sans-serif;
        }
      </style>

      <h1 class="title" id="appTitle" tabindex="0" role="button" aria-label="About Decent Calendar">
        <span class="emoji">🗓️</span> Decent Calendar
      </h1>

      <!-- About Modal -->
      <div class="about-overlay" id="aboutOverlay" role="dialog" aria-modal="true" aria-labelledby="aboutModalTitle">
        <div class="about-modal" id="aboutModal">
          <button class="close-btn" id="closeBtn" aria-label="Close About modal">✕</button>

          <div class="modal-logo">🗓️</div>
          <h2 class="modal-title" id="aboutModalTitle">Decent Calendar</h2>
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
            <h3>🙏 Credits &amp; Inspiration</h3>
            <ul>
              <li><strong>BigNuten</strong> — About modal pattern &amp; neon UI design language</li>
              <li><strong>DecentHead</strong> — Header component architecture &amp; overlay styling</li>
              <li><strong>A Decent Agency</strong> — Vision, design &amp; development</li>
              <li><strong>IPFS / web3.storage</strong> — Decentralized file storage</li>
              <li><strong>FullCalendar</strong> — Calendar engine</li>
              <li><strong>PeerJS</strong> — WebRTC peer-to-peer meetings</li>
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
      </div>
    `;

    // ── Event wiring ──
    const overlay  = shadow.getElementById('aboutOverlay');
    const title    = shadow.getElementById('appTitle');
    const closeBtn = shadow.getElementById('closeBtn');

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
  }
}

customElements.define('app-title', AppTitle);
