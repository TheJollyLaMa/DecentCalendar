/* Header.js — <app-header> Web Component (Shadow DOM)
   Fixed top header; composes <ipfs-status>, <app-title>, <wallet-connect>. */

class AppHeader extends HTMLElement {
  connectedCallback() {
    const shadow = this.attachShadow({ mode: 'open' });
    shadow.innerHTML = `
      <style>
        :host {
          display: block;
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          z-index: 100;
          background: rgba(0, 0, 0, 0.88);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          border-bottom: 1px solid rgba(0, 255, 255, 0.3);
          box-shadow: 0 2px 20px rgba(0, 255, 255, 0.15);
          box-sizing: border-box;
        }
        .header-inner {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 20px;
          max-width: 1200px;
          margin: 0 auto;
          gap: 16px;
        }
        .header-left,
        .header-right {
          flex: 1;
          display: flex;
          align-items: center;
        }
        .header-left {
          justify-content: flex-start;
        }
        .header-right {
          justify-content: flex-end;
        }
        .header-center {
          flex: 0 0 auto;
          display: flex;
          align-items: center;
          justify-content: center;
        }
      </style>
      <header>
        <div class="header-inner">
          <div class="header-left">
            <ipfs-status></ipfs-status>
          </div>
          <div class="header-center">
            <app-title></app-title>
          </div>
          <div class="header-right">
            <wallet-connect></wallet-connect>
          </div>
        </div>
      </header>
    `;
  }
}

customElements.define('app-header', AppHeader);
