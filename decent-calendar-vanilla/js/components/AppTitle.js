export class AppTitle extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
  }

  render() {
    this.shadowRoot.innerHTML = `
        <link rel="stylesheet" href="css/header.css" />
        <div id="header-center">
            <h1 id="app-title">🗓️ Decent Calendar 🗓️</h1>
            <h3 id="app-subtitle">(Another Decent Frankenstein)</h3>
        </div>
    `;
  }
}

customElements.define('app-title', AppTitle);
