/* IPFSWaitingModal.js — <waiting-modal> Web Component (Shadow DOM)
   Animated IPFS connection modal with icon ring.
   Lets users configure Pinata API keys for IPFS storage. */

class IPFSWaitingModal extends HTMLElement {
  constructor() {
    super();
    this._visible = false;
  }

  connectedCallback() {
    this._shadow = this.attachShadow({ mode: 'open' });
    this._render();
  }

  show() {
    this._visible = true;
    this._render();
  }

  hide() {
    this._visible = false;
    this._render();
  }

  _render() {
    const savedKey = localStorage.getItem('pinata_api_key') || '';
    const savedSecret = localStorage.getItem('pinata_api_secret') || '';

    this._shadow.innerHTML = `
      <style>
        :host { display: block; }
        .backdrop {
          position: fixed;
          top: 0; left: 0;
          width: 100%; height: 100%;
          background: rgba(0, 0, 0, 0.8);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 3000;
        }
        .backdrop.hidden { display: none !important; }
        .modal-box {
          background: black;
          border: 2px solid #0ff;
          padding: 30px;
          border-radius: 12px;
          box-shadow: 0 0 40px rgba(0, 255, 255, 0.5);
          min-width: 320px;
          max-width: 440px;
          width: 90%;
          text-align: center;
          font-family: chalkduster, fantasy, sans-serif;
          color: white;
        }
        h3 {
          color: #0ff;
          text-shadow: 0 0 10px #0ff;
          margin-top: 0;
          font-size: 1.3rem;
        }
        p {
          font-size: 0.85rem;
          color: #aaa;
          margin-bottom: 16px;
        }
        /* Animated icon ring */
        .icon-ring {
          position: relative;
          width: 120px;
          height: 120px;
          margin: 0 auto 20px;
        }
        .ring-icon {
          position: absolute;
          width: 28px;
          height: 28px;
          filter: drop-shadow(0 0 6px #0ff);
          animation: orbit 3s linear infinite, shimmer 2s ease-in-out infinite;
        }
        .ring-icon:nth-child(1) { animation-delay: 0s;    top: 0;   left: 50%; transform: translateX(-50%); }
        .ring-icon:nth-child(2) { animation-delay: -0.75s; top: 50%; right: 0;  transform: translateY(-50%); }
        .ring-icon:nth-child(3) { animation-delay: -1.5s;  bottom: 0; left: 50%; transform: translateX(-50%); }
        .ring-icon:nth-child(4) { animation-delay: -2.25s; top: 50%; left: 0;  transform: translateY(-50%); }
        @keyframes shimmer {
          0%, 100% { opacity: 0.5; filter: drop-shadow(0 0 4px #0ff); }
          50%       { opacity: 1;   filter: drop-shadow(0 0 12px #0ff); }
        }
        @keyframes orbit {
          0%   { transform: rotate(0deg)   translateX(46px) rotate(0deg); }
          100% { transform: rotate(360deg) translateX(46px) rotate(-360deg); }
        }
        /* Form */
        .form { text-align: left; margin-top: 8px; }
        label {
          display: block;
          color: #0ff;
          font-size: 0.85rem;
          margin-bottom: 12px;
        }
        input {
          display: block;
          width: 100%;
          box-sizing: border-box;
          padding: 7px 10px;
          margin-top: 4px;
          font-size: 0.9rem;
          border: 1px solid #0ff;
          border-radius: 5px;
          background: #111;
          color: white;
          font-family: inherit;
        }
        .btn-row {
          display: flex;
          gap: 10px;
          justify-content: center;
          margin-top: 18px;
        }
        button {
          padding: 9px 18px;
          font-size: 0.9rem;
          font-family: inherit;
          border: 2px solid #0ff;
          border-radius: 6px;
          background: black;
          color: #0ff;
          cursor: pointer;
          transition: background 0.2s ease, color 0.2s ease;
        }
        button:hover {
          background: #0ff;
          color: black;
        }
        .skip-btn {
          border-color: #555;
          color: #555;
        }
        .skip-btn:hover {
          background: #555;
          color: black;
        }
        a {
          color: #0ff;
          font-size: 0.75rem;
          text-decoration: none;
        }
        a:hover { text-decoration: underline; }
      </style>

      <div class="backdrop ${this._visible ? '' : 'hidden'}">
        <div class="modal-box">
          <h3>🌐 Connect to IPFS</h3>
          <p>Enter your Pinata API keys to enable IPFS storage for your calendar events.</p>

          <div class="icon-ring">
            <img class="ring-icon" src="assets/IPFS_Logo.png" alt="IPFS" />
            <img class="ring-icon" src="assets/DecentSmartHome_Logo.png" alt="DSH" />
            <img class="ring-icon" src="assets/IPFS_Logo.png" alt="IPFS" />
            <img class="ring-icon" src="assets/Ommm_Token_Logo.png" alt="Ommm" />
          </div>

          <div class="form">
            <label>
              Pinata API Key:
              <input type="text" id="pinata-key" placeholder="Your Pinata API Key"
                     value="${savedKey}" autocomplete="off" />
            </label>
            <label>
              Pinata API Secret:
              <input type="password" id="pinata-secret" placeholder="Your Pinata API Secret"
                     value="${savedSecret}" autocomplete="off" />
            </label>
          </div>

          <p><a href="https://app.pinata.cloud/keys" target="_blank" rel="noopener">
            Get a free Pinata API key →
          </a></p>

          <div class="btn-row">
            <button id="save-keys-btn">Save &amp; Connect</button>
            <button id="skip-btn" class="skip-btn">Skip</button>
          </div>
        </div>
      </div>
    `;

    this._shadow.querySelector('#save-keys-btn').addEventListener('click', () => {
      const key = this._shadow.querySelector('#pinata-key').value.trim();
      const secret = this._shadow.querySelector('#pinata-secret').value.trim();
      if (!key || !secret) {
        alert('Please enter both your Pinata API Key and Secret.');
        return;
      }
      localStorage.setItem('pinata_api_key', key);
      localStorage.setItem('pinata_api_secret', secret);
      this.hide();
      // Notify IPFSStatus component that keys are now set
      const statusEl = document.querySelector('ipfs-status');
      if (statusEl && statusEl._setConnected) statusEl._setConnected(true);
    });

    this._shadow.querySelector('#skip-btn').addEventListener('click', () => {
      this.hide();
    });
  }
}

customElements.define('waiting-modal', IPFSWaitingModal);
