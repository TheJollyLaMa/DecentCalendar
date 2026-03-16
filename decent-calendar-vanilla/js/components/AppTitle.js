/* AppTitle.js — <app-title> Web Component (Shadow DOM)
   Renders the 🗓️ Decent Calendar branding. */

class AppTitle extends HTMLElement {
  connectedCallback() {
    const shadow = this.attachShadow({ mode: 'open' });
    shadow.innerHTML = `
      <style>
        :host {
          display: block;
          text-align: center;
        }
        .title {
          font-family: chalkduster, fantasy, sans-serif;
          font-size: 1.4rem;
          color: #0ff;
          text-shadow: 0 0 8px #0ff, 0 0 18px #0ff;
          margin: 0;
          letter-spacing: 2px;
          white-space: nowrap;
        }
        .emoji {
          font-size: 1.6rem;
        }
      </style>
      <h1 class="title"><span class="emoji">🗓️</span> Decent Calendar</h1>
    `;
  }
}

customElements.define('app-title', AppTitle);
