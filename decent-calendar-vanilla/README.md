# 🗓️ Decent Calendar — Vanilla Web Components Edition

A fully decentralized calendar dApp built with **vanilla Web Components** (no build step required), matching the architecture of [BigNuten](https://github.com/TheJollyLaMa/BigNuten) and [DecentHead](https://github.com/TheJollyLaMa/DecentHead).

---

## 🚀 Quick Start

1. **Copy required images** into `img/` (see `img/README.md`):
   ```bash
   cp ../decent-calendar-react-app/src/assets/SecretPyramid.gif img/SecretPyramid.gif
   cp ../decent-calendar-react-app/src/assets/Ommm_Token_Logo.png img/Ommm_Token_Logo.png
   cp ../decent-calendar-react-app/src/assets/DecentSmartHome_Logo.png img/DecentSmartHome_Logo.png
   cp ../decent-calendar-react-app/src/assets/Metamask_Logo.png img/MetaMaskFox.png
   ```
   Download additionally: `IPFS_Logo.png`, `IPFS_Companion.gif`, `Web3Storage.png`

2. **Serve with a local HTTP server** (required for ES modules):
   ```bash
   npx serve .
   # or
   python3 -m http.server 8080
   ```

3. Open `http://localhost:8080` in your browser with **MetaMask** installed.

---

## 🏗️ Architecture

This app uses the **same Web Component architecture as BigNuten**:

```
decent-calendar-vanilla/
├── index.html              — App shell, <app-header>, <decent-calendar>
├── decent.config.js        — App configuration (contract addresses, token, etc.)
├── css/
│   ├── styles.css          — Global styles (BigNuten base + SecretPyramid bg)
│   ├── header.css          — Header styles (exact BigNuten copy)
│   └── calendar.css        — Calendar-specific styles
├── js/
│   ├── main.js             — ES module entry point
│   ├── events.js           — Event data layer (localStorage)
│   ├── contract.js         — ethers.js contract interactions
│   ├── payments.js         — POL & Ommm payment flows
│   ├── meetingRoom.js      — PeerJS P2P meeting room
│   └── components/
│       ├── Header.js       — <app-header> Web Component (shadow DOM)
│       ├── AppTitle.js     — <app-title> Web Component
│       ├── WalletConnect.js — <wallet-connect> Web Component
│       ├── IPFSStatus.js   — <ipfs-status> Web Component
│       ├── IPFSWaitingModal.js — <waiting-modal> Web Component
│       └── Calendar.js     — <decent-calendar> Web Component (light DOM)
└── img/
    ├── README.md           — Image requirements
    └── ...                 — App images
```

## 🔗 Features

- **MetaMask wallet connection** with Polygon network check
- **Personal calendar** — add public/private events stored in localStorage
- **Import other wallets' public calendars** by address
- **Book timeslots** — pay in POL (native) or Ommm tokens
- **P2P meeting rooms** via PeerJS WebRTC
- **IPFS upload** via web3.storage w3up client
- **Mint Timeslot NFTs** (requires deployed TimeslotNFT contract)

## ⚙️ Configuration

Edit `decent.config.js` to set contract addresses after deployment:

```js
window.DECENT_CONFIG = {
  contractAddresses: {
    TimeslotNFT: '0x...', // after deployment
    TimeslotMarket: '0x...', // after deployment
  },
};
```

## 🌐 Global Hooks

The Web Components communicate via global function hooks:

| Hook | Set by | Called by |
|---|---|---|
| `window.onWalletConnected(address)` | `Calendar.js` | `WalletConnect.js` after MetaMask connect |
| `window.onIPFSUploadClick()` | `Calendar.js` | `IPFSStatus.js` on IPFS icon click |
| `window.onIPFSReady(client)` | *(optional)* | `IPFSStatus.js` after w3up login |
| `window.connectToW3up()` | `IPFSStatus.js` | Any — triggers IPFS login flow |
| `window.w3upClient` | `IPFSStatus.js` | Global w3up client instance |
| `window.DECENT_CONFIG` | `decent.config.js` | App-wide configuration |
