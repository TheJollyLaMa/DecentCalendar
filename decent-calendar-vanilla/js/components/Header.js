class AppHeader extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
  }

  render() {
    this.shadowRoot.innerHTML = `
        <link rel="stylesheet" href="css/styles.css" />
        <link rel="stylesheet" href="css/header.css" />
        <header>
            <ipfs-status></ipfs-status>
            <app-title></app-title>
            <wallet-connect></wallet-connect>
        </header>
    `;
  }
}

customElements.define('app-header', AppHeader);
