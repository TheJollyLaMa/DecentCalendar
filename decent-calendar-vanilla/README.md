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
| IPFS upload via Pinata | ✅ Working (requires API keys) |
| PeerJS video meeting room | ✅ Working |
| Meeting room ID fix (React bug) | ✅ Fixed |
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
  ├── index.html          (app shell)
  ├── js/
  │   ├── app.js          → entry point, event wiring, modal handlers
  │   ├── wallet.js       → MetaMask state, connectWallet(), disconnectWallet()
  │   ├── calendar.js     → FullCalendar init, event click handlers, toggle UI
  │   ├── events.js       → saveEvent(), loadMyEvents(), fetchPublicEventsForAddress()
  │   ├── ipfs.js         → uploadToIPFS(), fetchFromIPFS() via Pinata REST API
  │   ├── contract.js     → mintTimeslot(), bookTimeslot(), confirmAppointment()
  │   ├── payments.js     → payWithCrypto(), payWithPayPal(), payWithCard()
  │   └── meetingRoom.js  → initMeetingRoom(), startCall(), closeMeetingRoom()
  │
  ├── css/
  │   ├── app.css         → global styles (cyberpunk neon, SecretPyramid bg)
  │   └── calendar.css    → calendar, modal, event type styles
  │
  └── contracts/
      ├── TimeslotNFT.sol     → ERC-721 timeslot minting
      └── TimeslotMarket.sol  → escrow booking / confirm / cancel
```

### Data flow

```
User adds event
    │
    ├─→ saveEvent()
    │       ├─→ localStorage (always)
    │       └─→ uploadToIPFS() if public + Pinata keys set
    │
    └─→ addEventToCalendar() → FullCalendar re-renders

User mints timeslot
    │
    ├─→ uploadToIPFS() → get CID
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

### Run locally
```bash
# No build step needed!
# Just open index.html in your browser:
open decent-calendar-vanilla/index.html

# Or serve with any static server:
npx serve decent-calendar-vanilla
python3 -m http.server 8080 --directory decent-calendar-vanilla
```

That's it. No npm install, no webpack, no build.

---

## 8. Configuration

### PayPal Client ID (for PayPal payments)

Open the browser console and run:
```js
localStorage.setItem('paypal_client_id', 'YOUR_PAYPAL_CLIENT_ID');
```

Get your client ID at [developer.paypal.com](https://developer.paypal.com/).

### Pinata API Keys (for IPFS uploads)

Open the browser console and run:
```js
localStorage.setItem('pinata_api_key', 'YOUR_API_KEY');
localStorage.setItem('pinata_api_secret', 'YOUR_API_SECRET');
```

Get your free API keys at [pinata.cloud](https://www.pinata.cloud/).

Without keys, events are saved to `localStorage` only (still fully functional for personal use).

### Contract Addresses

After deploying contracts, edit `js/contract.js`:
```js
const CONTRACT_ADDRESSES = {
  TimeslotNFT: '0x...',
  TimeslotMarket: '0x...',
};
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
