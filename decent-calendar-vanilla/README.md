# 🗓️ Decent Calendar — Vanilla Web Components Edition

A decentralized calendar dApp built with **vanilla Web Components** (no build step), matching the architecture of [BigNuten](https://github.com/TheJollyLaMa/BigNuten) and [DecentHead](https://github.com/TheJollyLaMa/DecentHead).

---

## 🚀 Quick Start

Serve with any static HTTP server (required for ES modules):
```bash
npx serve .
# or
python3 -m http.server 8080
```
Open `http://localhost:8080` with **MetaMask** installed.

---

## 🏗️ Architecture

Web Component pattern — same as BigNuten:

```
decent-calendar-vanilla/
├── index.html              — App shell: <app-header>, modals, <script type="module">, <decent-calendar>
├── decent.config.js        — App configuration (contract addresses, token, etc.)
├── assets/                 — Images (SecretPyramid.gif, logos, etc.)
│   └── README.md           — Documents images needed (IPFS_Logo.png etc.)
├── contracts/              — Solidity: TimeslotNFT.sol, TimeslotMarket.sol
├── css/
│   ├── app.css             — Global styles (SecretPyramid bg, animations, layout)
│   ├── calendar.css        — Calendar, modal, and event styles
│   └── header.css          — Header Web Component styles (BigNuten exact)
└── js/
    ├── main.js             — ES module entry point (imports all Web Components)
    ├── events.js           — Event data layer (localStorage)
    ├── contract.js         — ethers v6 contract interactions
    ├── payments.js         — POL & PayPal & Card payment flows
    ├── meetingRoom.js      — PeerJS P2P meeting room
    ├── calendar.js         — FullCalendar v6 init and event management
    └── components/
        ├── Header.js       — <app-header>: shadow DOM, composes ipfs/title/wallet
        ├── AppTitle.js     — <app-title>: 🗓️ Decent Calendar branding
        ├── WalletConnect.js — <wallet-connect>: MetaMask + Polygon network check
        ├── IPFSStatus.js   — <ipfs-status>: Pinata IPFS connection + upload
        ├── IPFSWaitingModal.js — <waiting-modal>: IPFS connection modal
        └── Calendar.js     — <decent-calendar>: light DOM, wires all calendar logic
```

---

## 🌐 Global Communication

Components communicate via global hooks:

| Hook | Set by | Called by |
|---|---|---|
| `window.onWalletConnected(address)` | `Calendar.js` | `WalletConnect.js` after MetaMask connect |
| `window.onWalletDisconnected()` | `Calendar.js` | `WalletConnect.js` on disconnect |
| `window.onIPFSUploadClick()` | `Calendar.js` | `IPFSStatus.js` on IPFS icon click |
| `window._walletAddress` | `WalletConnect.js` | All scripts via `window.*` |
| `window._walletSigner` | `WalletConnect.js` | `contract.js`, `payments.js` |
| `window.DECENT_CONFIG` | `decent.config.js` | App-wide configuration |
| `window.connectToIPFS()` | `IPFSStatus.js` | Optional external trigger |

---

## 🔗 Features

- **MetaMask wallet connection** with Polygon network check (mainnet + Amoy testnet)
- **Personal calendar** — add public/private events stored in localStorage
- **Import other wallets' public calendars** by address
- **Book timeslots** — pay in POL (crypto), PayPal, or Card
- **P2P meeting rooms** via PeerJS WebRTC
- **IPFS upload** via Pinata REST API (configure keys on first IPFS click)
- **Mint Timeslot NFTs** (requires deployed TimeslotNFT contract)

---

## ⚙️ Configuration

Edit `decent.config.js` after contract deployment:
```js
window.DECENT_CONFIG = {
  contractAddresses: {
    TimeslotNFT: '0x...',
    TimeslotMarket: '0x...',
  },
};
```

For IPFS, add Pinata keys via the IPFS icon in the header (stored in localStorage).

---

## 📦 Missing Assets

See `assets/README.md` for images that need to be downloaded:
- `assets/IPFS_Logo.png` — IPFS logo (favicon + IPFS status icon)
- `assets/IPFS_Companion.gif` — Waiting modal background
- `assets/Web3Storage.png` — Web3.Storage logo for modal
