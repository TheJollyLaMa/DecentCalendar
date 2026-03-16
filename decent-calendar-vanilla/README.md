# DecentCalendar — Vanilla Edition

> A decentralized calendar dApp. No build step, no framework, runs directly in the browser.  
> Deployable to IPFS. Your Ethereum wallet address **is** your identity.

---

## 1. Project Vision

DecentCalendar is a decentralized alternative to Calendly. Instead of a company owning your availability data, your **wallet address** is your public calendar URL. Anyone can look you up, see your public timeslots, and book you — paying in crypto (POL/ETH) held in escrow until you confirm the appointment.

Key principles:
- **No sign-up, no account** — connect your MetaMask wallet and you're in
- **Self-sovereign data** — public event metadata lives on IPFS; private events never leave your browser
- **Trustless payments** — funds are held on-chain in `TimeslotMarket` until the appointment is confirmed
- **Decentralized hosting** — the app itself (`index.html` + static assets) can be pinned to IPFS

---

## 2. Current Status (v0.1)

| Feature | Status |
|---------|--------|
| Wallet connect (MetaMask) | ✅ Working |
| Add personal events | ✅ Working |
| Public/private event toggle | ✅ Working |
| localStorage persistence | ✅ Working |
| Fetch another wallet's public events | ✅ Working |
| IPFS upload via w3up/web3.storage | ✅ Email auth flow (no API keys needed) |
| CID import (load another address's calendar) | ✅ Working |
| PeerJS video meeting room | ✅ Working |
| Mint timeslot NFT on-chain | 🔧 Stub (requires contract deployment) |
| Escrow booking via TimeslotMarket | 🔧 Stub (requires contract deployment) |
| Confirm/cancel appointment | 🔧 Stub (requires contract deployment) |
| PayPal payment | 🔧 Stub (requires PayPal client ID) |
| Card payment (Stripe) | 🔜 Planned |
| ENS name resolution | 🔜 Planned |

---

## 3. Architecture

```
Browser
  │
  ├── index.html                (app shell — Web Component structure)
  │
  ├── js/
  │   ├── main.js               → ES module entry: imports all Web Components
  │   │
  │   ├── components/
  │   │   ├── Header.js         → <app-header> (shadow DOM, composes ipfs-status/app-title/wallet-connect)
  │   │   ├── AppTitle.js       → <app-title> (shadow DOM, title + subtitle)
  │   │   ├── WalletConnect.js  → <wallet-connect> (shadow DOM, MetaMask + Polygon network check)
  │   │   ├── IPFSStatus.js     → <ipfs-status> (shadow DOM, w3up connection, CID import UI)
  │   │   ├── IPFSWaitingModal.js → <waiting-modal> (shadow DOM, email-auth flow modal)
  │   │   └── Calendar.js       → <decent-calendar> (light DOM, orchestrator, FullCalendar init)
  │   │
  │   ├── helpers/
  │   │   └── ipfs/
  │   │       ├── w3upClient.js    → connectW3upClient() — w3up email-auth login
  │   │       └── uploadToIPFS.js  → uploadDataToIPFS() — calendar JSON → IPFS CID
  │   │
  │   ├── calendar.js           → FullCalendar init, event click handlers, toggle UI (global)
  │   ├── events.js             → saveEvent(), loadMyEvents(), fetchPublicEventsForAddress() (global)
  │   ├── contract.js           → mintTimeslot(), bookTimeslot(), confirmAppointment() (global)
  │   ├── payments.js           → payWithCrypto(), payWithPayPal(), payWithCard() (global)
  │   └── meetingRoom.js        → initMeetingRoom(), startCall(), closeMeetingRoom() (global)
  │
  ├── css/
  │   ├── app.css               → global styles (cyberpunk neon, SecretPyramid bg)
  │   ├── header.css            → BigNuten-compatible header + Web Component shadow DOM styles
  │   └── calendar.css          → calendar, modal, event type styles
  │
  └── contracts/
      ├── TimeslotNFT.sol       → ERC-721 timeslot minting
      └── TimeslotMarket.sol    → escrow booking / confirm / cancel
```

### Data flow

```
User adds event
    │
    ├─→ saveEvent()
    │       └─→ localStorage (always)
    │
    └─→ addEventToCalendar() → FullCalendar re-renders

User clicks IPFS icon (saves calendar to IPFS)
    │
    ├─→ window.onIPFSUploadClick()
    │       ├─→ uploadDataToIPFS(data, w3upClient) → CID
    │       └─→ alert with CID

User imports CID
    │
    ├─→ window.onIPFSImportCID(cid)
    │       ├─→ fetch https://w3s.link/ipfs/<cid>
    │       └─→ setOtherEvents() → FullCalendar re-renders

User mints timeslot
    │
    ├─→ uploadDataToIPFS() → get CID
    ├─→ mintTimeslot(CID, ...) → TimeslotNFT.mintTimeslot() → tokenId
    └─→ saveEvent() → localStorage + calendar

Someone books a timeslot
    │
    └─→ bookTimeslot(tokenId, value) → TimeslotMarket.bookTimeslot()
            → funds held in escrow
            → event status = "pending"

Owner confirms
    │
    └─→ confirmAppointment(tokenId) → TimeslotMarket.confirmAppointment()
            → funds released to creator
            → event status = "confirmed"
```

---

## 4. IPFS Data Model

Each public timeslot is stored as a JSON document pinned to IPFS:

```json
{
  "version": "0.1",
  "type": "timeslot",
  "tokenId": null,
  "owner": "0xABC...123",
  "title": "IT Consultation",
  "description": "1-hour technical advisory session",
  "date": "2026-04-01",
  "startTime": "14:00",
  "endTime": "15:00",
  "timezone": "America/Los_Angeles",
  "durationMinutes": 60,
  "hourlyRate": 0.05,
  "currency": "POL",
  "status": "available",
  "meetingRoomId": "meeting-1743800000000-0xABC...123",
  "fiatOptions": {
    "paypal": true,
    "card": true,
    "fiatRateUSD": 0
  },
  "isPublic": true,
  "classNames": ["public-event"],
  "creator": "0xABC...123",
  "start": "2026-04-01T14:00",
  "end": "2026-04-01T15:00",
  "createdAt": "2026-03-16T10:00:00.000Z",
  "ipfsCID": "Qm..."
}
```

The IPFS CID is used as the `tokenURI` for the NFT (`ipfs://<CID>`).

---

## 5. Smart Contracts

### `TimeslotNFT.sol` (ERC-721)

Deployed to Polygon. Each minted token represents one bookable timeslot.

**Key functions:**
| Function | Description |
|----------|-------------|
| `mintTimeslot(ipfsCID, startTime, endTime, hourlyRate)` | Mint a new timeslot NFT |
| `setStatus(tokenId, status)` | Update status (called by market contract) |
| `getTimeslot(tokenId)` | Read full timeslot data |
| `tokenURI(tokenId)` | Returns `ipfs://<CID>` |

**Events:**
- `TimeslotMinted(tokenId, creator, ipfsCID)`
- `StatusUpdated(tokenId, status)`

### `TimeslotMarket.sol`

Handles escrow booking without a middleman.

**Key functions:**
| Function | Description |
|----------|-------------|
| `bookTimeslot(tokenId)` | Book + pay; funds held in escrow |
| `confirmAppointment(tokenId)` | Creator confirms; funds released |
| `cancelBooking(tokenId)` | Either party cancels; buyer refunded |
| `getBooking(tokenId)` | Read booking details |

**Events:**
- `TimeslotBooked(tokenId, buyer, amount)`
- `AppointmentConfirmed(tokenId, creator, amount)`
- `BookingCancelled(tokenId, buyer, amount)`

---

## 6. Payment Flows

### 💎 Crypto (POL/ETH)
1. Buyer clicks a public timeslot on the calendar
2. Booking modal shows: title, time, duration, total cost in POL
3. Buyer clicks "Pay with POL/ETH"
4. `TimeslotMarket.bookTimeslot(tokenId)` is called with `msg.value = totalCost`
5. Funds held in escrow; event status → "pending"
6. After the meeting, owner clicks the event → "Confirm & Release Funds"
7. `TimeslotMarket.confirmAppointment(tokenId)` releases funds to owner

### 🅿️ PayPal
1. Buyer clicks "Pay with PayPal" in the booking modal
2. PayPal JS SDK renders a button (requires `YOUR_PAYPAL_CLIENT_ID` in `payments.js`)
3. On approval, event is marked `status: "booked-fiat"` in localStorage + IPFS

### 💳 Card (Stripe — planned)
- Placeholder in `payments.js`. Stripe integration coming in v0.2.

---

## 7. Setup & Running

### Prerequisites
- A modern browser with [MetaMask](https://metamask.io/) installed
- Polygon wallet with some POL for gas (if using on-chain features)
- A free [web3.storage](https://web3.storage/) account for IPFS uploads

### Run locally

**Option 1 — from the vanilla folder (simplest):**
```bash
cd decent-calendar-vanilla
npm start
# Opens http://localhost:8080 automatically
```

**Option 2 — from the repository root:**
```bash
npm start
# Serves decent-calendar-vanilla at http://localhost:8080
```

**Option 3 — without npm scripts:**
```bash
npx http-server decent-calendar-vanilla -p 8080 -o --cors
# or
python3 -m http.server 8080 --directory decent-calendar-vanilla
```

No build step, no webpack, no `npm install` required for the vanilla app.

---

## 8. Configuration

### IPFS via web3.storage (w3up)

IPFS uploads now use the **w3up / web3.storage email-auth flow** — no API keys needed.

1. Click the IPFS icon in the header
2. Click **"Enter Email"** in the waiting modal
3. Enter your [web3.storage](https://web3.storage/) email address
4. Check your email and click the confirmation link
5. Done — your browser stores credentials in IndexedDB for future sessions

### PayPal Client ID (for PayPal payments)

Open the browser console and run:
```js
localStorage.setItem('paypal_client_id', 'YOUR_PAYPAL_CLIENT_ID');
```

Get your client ID at [developer.paypal.com](https://developer.paypal.com/).

### Contract Addresses

After deploying contracts, edit `decent.config.js`:
```js
contractAddresses: {
  TimeslotNFT: '0x...',
  TimeslotMarket: '0x...',
},
```

---

## 9. Contract Deployment

### Prerequisites
```bash
npm install -g hardhat
npm install @openzeppelin/contracts
```

### Compile
```bash
cd decent-calendar-vanilla/contracts
npx hardhat compile
```

### Deploy to Polygon Amoy testnet
```bash
npx hardhat run scripts/deploy.js --network amoy
```

Example deploy script (`scripts/deploy.js`):
```js
const [deployer] = await ethers.getSigners();
const NFT = await ethers.getContractFactory('TimeslotNFT');
const nft = await NFT.deploy();
await nft.waitForDeployment();

const Market = await ethers.getContractFactory('TimeslotMarket');
const market = await Market.deploy(await nft.getAddress());
await market.waitForDeployment();

console.log('TimeslotNFT:', await nft.getAddress());
console.log('TimeslotMarket:', await market.getAddress());
```

Get Amoy testnet POL at [faucet.polygon.technology](https://faucet.polygon.technology/).

---

## 10. Roadmap

| Version | Features |
|---------|----------|
| **v0.1** (current) | Wallet connect, localStorage events, IPFS upload, PeerJS meetings |
| **v0.2** | Contract deployment to Amoy testnet, full booking/confirm flow |
| **v0.3** | Stripe card payments, PayPal integration |
| **v0.4** | ENS name resolution (`vitalik.eth` → calendar) |
| **v0.5** | IPFS CID index per wallet address (replace localStorage) |
| **v1.0** | Full IPFS hosting, DAO governance for market fees |

---

## License

MIT — See [LICENSE](../LICENSE) for details.

---

*Another creation by A Decent Agency to help the world be on the same page.* 🌎
