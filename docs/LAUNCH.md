# DCal launch sequence

## What this release publishes

The White Rabbit tutorial, ENS-enriched right-ankh profile and calendar
identity, exact ETH/USDC agreement previews, and existing deliberate storage
controls, plus the release-gated registry UI. These require only the existing
GitHub Pages deployment. The live config has empty registry address/code hash
and `writesEnabled: false`; no payment or approval can be requested.
No Discord integration or OAuth credentials are needed.

The old Ommm/SmartHome decorations are removed from the runtime and Pages
artifact. ETH's animated ENS/Ethereum artwork comes from the pinned Head;
reduced motion uses its still frame. USDC has a local symbol adapted from
Busking. Icons appear for actual assets, not as unrelated decoration.

ENS names require reverse lookup plus forward-address verification. Avatar
and banner/header images are HTTPS or IPFS, without referrer disclosure.
An image host still sees the request. Failed lookups and images retain the
address and report unavailability. Names/artwork are mutable display data,
never authorization or evidence of money received.

## Approved economic agreement (2026-10-28)

- Base mainnet, chain 8453; ETH and canonical Base USDC
  `0x833589fcd6edb6e08f4c7c32d4f71b54bda02913` only at launch.
- Nontransferable registry bookings, not transferable time NFTs.
- Development fee: 300 basis points of settled gross, deducted from the
  gross. Host receives the remainder. No fee on free or refunded bookings;
  Base gas is separate.
- Steward selected `DecentAgency.eth`. A read-only Ethereum ENS lookup on
  2026-10-28 returned `0xcAeEd8422fB5682C298B7F0971906d446fFd4e7a`.
  This is evidence, **not deployment approval of a newly resolved address**.
  Re-resolve and confirm the exact intended address immediately before
  signing. The deployed contract snapshots an immutable address; later ENS
  record changes cannot redirect existing credits.
- A timebox has a host, public subject (1-200 bytes), fixed UTC interval,
  asset, hardline flag, host IANA timezone and 1-50 attendee seats (host
  plus at least one attendee). A host's open timeboxes can never overlap;
  adjacent boxes are allowed. Seats are nontransferable.
- **Per-head** pricing: each attendee deposits and pays the price.
  **Split** pricing: each deposits `ceil(total / minimum)`; at release each
  pays `ceil(total / attendees at start)` and the remainder is credited
  back. Rounding can give the host at most attendees-1 extra base units.
- Attendees cannot leave on their own before start. The host may refund any
  seat in full or cancel the whole timebox (every funded seat credited).
  After start the attendee count is frozen, so a host refund then forgoes
  that share rather than raising others' split charges.
- If the minimum is not met by start, attendees may reclaim in full. After
  the end each attendee releases their own seat; after seven unresolved days
  they may reclaim it. Nothing executes automatically, and no admin can
  adjudicate or seize escrow.
- The owner (`DecentAgency.eth`) can only allowlist ERC-20 tokens (ETH and
  canonical USDC at deployment). Delisting stops new timeboxes/joins only;
  release, refund and withdrawal always continue.
- This attendee-protective policy can leave a host unpaid. A meeting timer
  is never evidence of delivery or permission to release payment.
- Resolution credits pull-based withdrawals. A failed transfer does not
  relock the seat; the credited owner can retry to another destination.
- Cancelled timeboxes are terminal; a refunded seat cannot rejoin. Re-listing
  creates a new ID, avoiding stale links or room access.

Exact-amount example: 1.01 USDC/hour for 90 minutes previews 1.515 USDC
gross, 0.04545 USDC development and 1.46955 USDC host. Gross rounds up to
the smallest asset unit; fee rounds down. A one-base-unit settlement has
zero fee. Never use floating point to determine transfer amounts.

## Contract build and remaining checks

`contracts/DCalBooking.sol` is a new candidate registry implementing those
rules. The legacy `decent-calendar-vanilla/contracts/TimeslotMarket.sol`
does not: **do not deploy it**.

```sh
npm ci --ignore-scripts
npm test
npm run test:escrow
npm run test:base-fork
```

Compiler: solc 0.8.30, optimizer enabled with 200 runs, EVM Shanghai.
The test chain is ephemeral, in-process Hardhat with synthetic accounts.
It is not a funded mainnet fork or an independent audit. The contract test
suite covers ETH/USDC accounting, stale terms, competing/duplicate bookings,
refund/settlement authorization and timing, failure recovery, reentrancy,
free sessions, unsupported transfers and terminal states. The 18 local-EVM
tests also exercise the production adapter, exact start/end/seven-day
boundaries, coherent post-receipt block reads, pending-action exclusion,
wallet changes, bytecode/policy pinning, runtime verification and aggregate
custody-versus-credits conservation.

On 2026-10-28, the separate canonical-USDC fork test passed at Base block
53215844 through `https://base-rpc.publicnode.com`. It exercises actual
USDC proxy/code/state, exact approval, escrow, refund/withdrawal and
settlement with 1.46955 USDC host / 0.04545 USDC fee. Only the local
in-process fork impersonates a public USDC holder and signs synthetic
transactions; the upstream RPC is read-only. Hardhat uses OP Isthmus
execution rules for this test. It is not production gas/finality acceptance
or an independent review. The first public Base RPC was rate-limited;
network failures must fail the test, not turn into a skipped/pass result.
Override `DCAL_BASE_RPC` with an appropriate trusted RPC when needed;
never commit its credentials. Repeat against current state before launch.

The current package audit reports eight advisories (five high, two moderate,
one low; no critical). They include development compiler/EVM/ethers tooling
and the pre-existing Moment dependency. They have not been independently
triaged as exploits. None of the npm dependency tree is bundled into the
allowlisted Pages artifact; the existing vendored Head ethers distribution
is a separate pinned runtime dependency. Do not start a public Hardhat node
or reuse test accounts for real funds. Tool/package maintenance and runtime
dependency review remain part of the production release checks.

Before asking the steward to sign:

1. Complete independent contract review and address findings.
2. Repeat the now-passing Base fork suite and boundary/conservation tests
   against the reviewed source. A mock ERC-20 alone is not that acceptance.
3. Rehearse the wired ABI/frontend integration against an isolated deployment
   of the reviewed source:
   public offers, terms/hardline consent, separate exact USDC approval and
   payment, confirmed receipts, recovery, cancellation/refund/credit withdrawal.
   Never interpret imported JSON or local `status`/`buyer` as chain truth.
   The registry rejects a host's overlapping open timeboxes; external-calendar
   conflicts still need the planned iCal/Google bridges.
   Repeat the minimal approved lifecycle on Base after deployment, before
   opening general paid booking.
4. Re-resolve and confirm the fee address; verify canonical USDC bytecode
   and chain ID; prepare the exact constructor arguments and bytecode hash.

### Read-only preparation and post-deployment pinning

The operator can generate unsigned deployment calldata without any key:

```sh
npm run prepare:booking -- --fee-recipient 0xcAeEd8422fB5682C298B7F0971906d446fFd4e7a
# --owner defaults to the same steward-confirmed DecentAgency.eth address
```

This rechecks Base, canonical USDC code/decimals and the current Ethereum
ENS record against the supplied exact address. It compiles the same source
and settings used by the tests and prints constructor arguments, source
hash, creation-code hash and deployment data. It sends no transaction.
This artifact is **not permission to sign before independent review**.
Rebuild after any source change and reconfirm the exact recipient with the
steward.

### Signing the deployment from a local `.env`

Copy `.env.example` to `.env` (gitignored, `chmod 600`) and fill it in
locally. Never commit it or paste a key into chat, issues or Pages.
`DEPLOYER_PRIVATE_KEY` should be a **fresh wallet holding only a little Base
ETH**; it receives no powers in the contract, and the script refuses to sign
with the fee-recipient/owner address. Then run:

```sh
npm run deploy:booking
```

It re-resolves DecentAgency.eth and rechecks Base, canonical USDC and the
`.env` addresses, then prints the deployer, balance, gas estimate (about
2.9M gas) and constructor arguments, and signs only after you type `DEPLOY`.
After two confirmations it verifies the deployed runtime and policy, writes
`docs/deployments/base-dcal-timebox-1.json`, and pins `booking` in
`decent.config.js` with `writesEnabled: false`. With `ETHERSCAN_API_KEY` set
it also publishes verified source on Basescan; retry later with
`npm run deploy:booking -- --verify-only 0x...`. Empty the key from `.env`
when done.

Then the steward uses their wallet on **Base**, funded with enough ETH
for deployment gas, to deploy the reviewed registry. Constructor arguments
are `(feeRecipient, owner, [canonical Base USDC])`; both addresses are the
steward-confirmed DecentAgency.eth address. Native ETH is always allowed. No private
key, seed, shared RPC secret or wallet permission should be entered into
chat, source code, Pages or a public issue.

After signing, record the contract address, transaction, block, compiler,
source verification and deployed code hash; wire them into reviewed app
configuration. Validate a steward-approved minimal real booking, settlement
and full-refund path before opening general paid booking. Source deployment
is not contract deployment. Adding a token later requires a reviewed
chain/address/decimals/icon registry entry and matching contract support;
symbols or an arbitrary image URL cannot enable token transfers.

After deployment, the same preparation command with `--address 0x...`
compares deployed executable code to the local compilation (accounting
for Solidity immutable references), verifies the immutable addresses and
policy getters, and prints `bookingConfig`. Copy it into the app's
`booking` config **with writes still false**. Only open transactions after
the release checks and minimal live rehearsal are explicitly approved.
Merely entering an address or flipping the boolean cannot bypass runtime
hash, policy, asset and Base-wallet checks.

### Booking and recovery UI

1. Connect the host explicitly on Base. Create a public local draft with
   an identified asset, exact rate, UTC-equivalent interval, pricing mode,
   minimum/maximum attendees, your IANA timezone and hardline preference. Click the slot, then Review public on-chain offer.
2. Review permanent public title/terms and confirm publication. No private
   description, room ID or arbitrary metadata fetch is included. The ID
   (starting at 1) comes from the successful registry receipt. An overlap
   with your other open timeboxes is rejected before signing.
3. Share/save the `?booking=<id>` link. It always reads the configured,
   hash-pinned registry. The original local draft remains unverified.
4. Each attendee reviews their local time, the host's local time, UTC,
   exact asset/address/deposit, split charge, fee recipient and policy,
   confirms the public timezone they join with, then checks agreement. For
   paid USDC, approve exactly the deposit; wait for its receipt, review
   again and join separately. Approval alone reserves no seat. Free USDC requires
   neither allowance nor a token transfer.
5. Refund/release/withdraw-offer controls reflect chain state, party and
   latest block time. The contract re-enforces these conditions. No timer
   or artwork can authorize payment.
6. Resolution creates pull credit. My withdrawal credits reads both asset
   balances for the connected wallet. Confirm the full destination address
   before withdrawal; a failed transfer retains the credit for recovery.
7. Submitted and confirmed receipt links remain visible for reconciliation.
   Identical successful transaction speed-ups are recognized; cancellations
   or different replacement instructions are not reported as success.
   Pending actions block duplicate in-tab submissions. Lost tabs and
   cross-tab activity require re-reading by ID before retrying; one mined
   receipt is not a claim of irreversible Base finality.

ENS names/avatars/banners enrich the actual on-chain host/attendees without
changing authority. Show checked slot on calendar adds an explicitly labeled
snapshot; clicking it re-reads the registry. This does not discover all
bookings, follow the chain in the background, or implement a wallet index.
Keep the booking link and wallet transaction history for recovery.

## Meeting launch

The existing unauthenticated PeerJS prototype remains disabled. No public
call should be enabled by flipping its boolean.

Implement/adapt Canopy's signed-session Rabbit Hole with:

- Fresh booking-, origin-, contract-, chain-, peer- and role-bound challenges;
  host and guest verified against confirmed on-chain booking parties.
- Explicit join, camera/microphone consent, waiting room and host admission.
- Session-key expiry, replay resistance, account/network/disconnect cleanup,
  correct reconnect behavior and complete track/peer disposal.
- Optional agreed hardline checked against the fixed UTC end. Show the final
  five-minute countdown, including short or late-joined sessions. End the
  supported app connection at the end; late arrival never extends the slot.
  No automatic payment, overtime or escrow settlement.

Steward accepted **app-enforced P2P**, not server-enforced room expiry.
Modified clients cannot be prohibited from reconnecting elsewhere. An
additional trusted meeting service is not required by that decision, but
signaling/TURN reliability, privacy, CORS and deployment configuration still
need evidence from a real two-device test before calls are enabled.

## Additional readiness worth keeping

- Counterpart local times use the browser's IANA database, so DST shifts
  are shown per date; add-to-calendar reminders and external-calendar
  conflict checks are still needed before users rely on availability.
- A shareable booking receipt and a visible recover/refund/withdraw path.
- Distinguish RPC/provider outage from empty availability. Retry without
  duplicate payments and recover from a lost browser tab using chain data.
- Accessibility and two-device meeting tests, including media denial and
  reduced motion. Do not equate an attractive profile with verified delivery.
- GitHub project Pages shares the owner's browser origin with other projects.
  LocalStorage is not encrypted or isolated by URL path; use synthetic or
  already-public calendar data until confidential storage is designed.

The tutorial does not imply these remaining gates have passed. It explains
the current product truth and can be replayed after deployment.
