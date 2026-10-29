# DecentCalendar
🗓️ A Decent Calendar - another decent creation by TheJollyLaMa to return back some agency to the decent people of 🌎

## Invitations for published timeboxes

For a published timebox, **Invite & remember** offers device sharing (clipboard
fallback), an `.ics` download, and a Google Calendar template link. Calendar
exports use the exact UTC interval, include the host timezone, and are static
snapshots; adding one does not join, pay, reserve a seat, or grant meeting access.
Check the refreshed Base state for cancellation or other changes.

The connected host can resolve an ENS name or enter a wallet address and create
a recipient-specific link. The recipient address is visible in that link.
Creating it sends nothing; the host shares it explicitly. An invite link is
untrusted routing metadata, **not proof the host sent it**, authorization, or an
invite-only restriction. The deployed contract still permits anyone to join
before the start while seats remain. Public payment writes remain gated.

The invitation roster is local to this origin/browser, scoped to Base, registry,
host and timebox ID. It is not included in calendar backups, public availability
or IPFS uploads. A matching seat's status comes from the last chain read; refresh
to reconcile. ENS display failures retain the resolved wallet. No email, Discord
or wallet notification is sent, and personal notes are not placed in URLs.

Reuse: this adapts DCal's existing `createProfileResolver.address` / `lookup`,
`profileImage`, `bookingId`, and checked booking snapshots at `b5da459`.
The Busking action-badge/signed-acknowledgement lead recorded in #31 is not needed
for this link-only phase; its notification delivery and different escrow terms
are not imported. No shared package or contract change is introduced.
Acceptance is exercised by `tests/invitations.test.js` and the existing
`scripts/verify-booking.mjs` at 1440 and 390 pixels in New York and Tokyo.
Native Apple/Outlook/Google import still needs a manual receiving-calendar check.

## First-version build: shared Head foundation

The vanilla app is the active receiving implementation for this work. The
React prototype has not been migrated. This is **not a live paid-booking
service**: minting, checkout, fiat payment, settlement and video meetings remain unavailable
until the Base release gates are implemented and validated. No contracts
were deployed by this integration.

- **Follow the white rabbit**: an eleven-hop, replayable tutorial below the
  header and in the right ankh. It remembers your place and supports
  keyboard navigation, Escape, reduced motion and explicit storage errors.
  It never connects, signs, pays, uploads or requests media.
- **My ENS profile** in the right ankh shows forward-verified primary name,
  avatar and banner/header records. ENS identity enriches the calendar and
  slot details; failed/missing records retain the wallet address. HTTPS/IPFS
  images are display-only and use no-referrer requests. No Discord is used.
- **Asset-aware drafts and slot previews** use an exact decimal hourly
  rate and chain/address identity for native Base ETH or canonical Base
  USDC. Asset icons appear in the picker, slot and agreement preview;
  unrelated Ommm/SmartHome decorations are removed. ETH animation has a
  reduced-motion still. No imported image or currency symbol can authorize
  payment. Gross rounds up and the 300 bps fee rounds down in base units.
- **Group timebox registry integration (release-gated)** publishes public
  timeboxes from owned drafts: subject, UTC interval, asset, per-head or split
  pricing, 1-50 attendee seats (host plus at least one), hardline and the
  host's IANA timezone. Each attendee joins with their own timezone; the
  registry rejects overlapping open timeboxes for the same host. Exact USDC
  approval is separate from joining; confirmed receipts are reconciled.
  Per-seat release, host refunds/cancellation, minimum-not-met and
  seven-day reclaims and ETH/USDC credit withdrawal are wired.
  `?booking=<id>` (IDs start at 1) is the permanent recovery link.
  The Bookings / recover / withdraw control reports an undeployed registry
  explicitly, never as an empty booking. Every read verifies the pinned Base
  runtime hash and policy; transactions additionally require the release gate
  and current Base wallet. The live site pins the Base deployment below with
  `writesEnabled: false` until the live rehearsal is accepted.
- A recovered chain slot can be shown as a **checked calendar snapshot**,
  enriched with host/attendee ENS display identities. Clicking it re-reads the
  registry; artwork and local/imported fields never authorize payment.
  Snapshots are cleared on wallet changes and are not an automatic index.
- **Two clocks, one agreement.** Times always render in your local
  timezone. Slot details and agreements add one compact line for the other
  party, such as "🌙 2:00 AM - 3:00 AM Fri for host (Asia/Tokyo, +16h vs you,
  +1 day)", and the roster shows each attendee's local time. Timezones are
  public on-chain when you publish or join; they are display context and
  never change the UTC interval.
- One canonical DecentHead 2.0.0 session: EIP-6963/injected-wallet discovery,
  explicit connect/disconnect, Base mainnet (8453), verified ENS display,
  orbit styling, storage-provider controls and a DCal About modal.
- Existing address-keyed local event records remain in place. New drafts
  use ETH; legacy records retain their currency (including POL).
  Malformed local records cause an explicit error rather than being
  replaced with an empty calendar.
- **Local backup** downloads/restores only the connected wallet's calendar,
  including private events. JSON files are not encrypted; keep them offline
  and safe. Restore validates schema, owner, event fields, maximum 2,000
  events and 2 MiB size before confirmation/replacement. Other wallet and
  browser records are not included or modified.
- **Public availability** previews only explicitly public events. Publishing
  requires consent, confirmation and the user's configured Pinata or local
  Kubo provider, and includes each public slot's host timezone and seat
  terms. It does not publish private events, room IDs, booking state,
  token IDs, feed credentials or unrelated localStorage. Public descriptions
  still need human review: do not put secrets in them. IPFS copies may
  persist forever. A returned CID is not proof of durable retention.
  IPFS is used only for this public availability; private events and
  backups stay in the browser/your files, and booking terms live on Base.
  A local Kubo node must allow the page origin in its API CORS headers, and
  Chrome asks for local-network permission when the live site calls it.
- Importing a DCal public-availability CID displays read-only information;
  it does not overwrite local events, authorize meetings or prove bookings.
  Calendar-feed import and automatic wallet-to-CID discovery are not yet
  implemented. Address lookup currently reads this browser only.
- Account/network/disconnect changes clear the app signer, calendar view
  and open controls. A wrong chain does not trigger an automatic switch
  or reload. The wallet session is restored only on Base.

### Reuse decision and attribution

Need: the shared Decent app header and explicit wallet/storage lifecycle.
**Adapt host integration, reuse the distribution unchanged** from
[DecentHead commit 426ccb7](https://github.com/TheJollyLaMa/DecentHead/commit/426ccb7ad8de658cda374b11ebc4b544b35257e6):
`js/main.js` (`DecentHead`), `js/wallet.js` (`WalletSession`),
`js/ipfs.js` (`IPFSSession`) and the exact `docs/ADOPTING.md` vendor manifest.
The pinned files and storage setup guide are under
[vendor/decent-head/2.0.0](decent-calendar-vanilla/vendor/decent-head/2.0.0/).
The Jolly LaMa / A Decent Agency's Apache-2.0 LICENSE, NOTICE, CC BY 4.0
art/docs terms and ethers notice travel with the distribution.

The Canopy map's Calendar entry and active Head/Calendar worktrees and open
PRs were checked before implementation. Existing Head Supporter work is not
part of this integration. The old Calendar w3up email flow and separate
wallet globals are incompatible with the current shared-session contract;
the host adapter replaces that runtime path while temporarily bridging
the app's existing address/signer consumers. DCal wires the right ankh's
existing button to its ENS profile and adds tutorial replay without changing
the vendored Head. The left Admin menu is still an inert placeholder.

Onboarding/profile/icon donor:
[DecentBusking 6ef53c8](https://github.com/TheJollyLaMa/DecentBusking/commit/6ef53c84ff48b8ae21d18bd50b337c22644cae53),
`js/tutorial.js`, `js/creator-profile-data.mjs` (`resolveCreatorENS`,
`creatorImageURL`), `js/components/header-right-ankh-override.js` and
`img/usdc.svg`. These were adapted, not wholesale copied: Busking's tutorial
depends on radio/playlist panels and its ENS worker is not DCal infrastructure.
The host uses the current Head v2 ankh structure, direct Ethereum RPC and
explicit lookup/error states rather than a silent worker fallback. The donor
worktree's unfinished changes were not copied. Attribution and the donor
NOTICE are retained.

Booking reuse decision: inspected current standalone
[DecentEscrow c316f2d](https://github.com/TheJollyLaMa/DecentEscrow/tree/c316f2dba007fea471cf0aa240a3943954cf0e91),
`contracts/DecentEscrow.sol` (`EscrowMultiWorkOrder`), the Base marketplace
escrow and
[DecentMarket 11d3e16](https://github.com/TheJollyLaMa/DecentMarket/commit/11d3e16961ca8f32475b62e5db25ac0d243e8822),
`contracts/LivePerformanceEscrow.sol`. The marketplace deployment at
`0x31b07b83e99A9bdF379bf40225b8A80d3804C89d` exists on Base and answers its
documented interface, but holds sale proceeds rather than enforcing DCal's
per-booking refund policy. The work-order model lacks native ETH and DCal's
fee/time rules; the performance model uses USDC-only admin approval,
performer auto-claim and optional kill fees. These cannot become DCal's
attendee-protective, no-adjudicator group timebox policy through a UI
wrapper. Its only admin power is a token allowlist (owner: DecentAgency.eth),
which can never move escrow.

Choice: retain the focused `DCalBooking` candidate as the booking member
of the escrow family, with a separate deployment if approved. Reuse shared
custody/state-transition patterns, not the existing storefront treasury.
No donor source was copied in this slice and no dirty donor worktree was
changed. Keep it with its established Calendar consumer rather than
extracting speculative shared infrastructure. Receiving-app results:
18 local-EVM tests, desktop/mobile real-EVM browser lifecycle, and a real
canonical-USDC Base-fork lifecycle passed. This is not a tested integration
with the existing deployed storefront, nor an independent contract review.

### Run and validate

Serve `decent-calendar-vanilla/` over HTTP(S), including at nested paths; do
not open the HTML using `file:`. The existing `npm run serve:vanilla` serves
port 8080. Head dependencies are vendored; FullCalendar still uses its
versioned CDN dependency. The unauthenticated PeerJS runtime
is disabled and its CDN bundle is no longer loaded.

```sh
npm test
npm run test:escrow
npm run test:base-fork
# With an existing Playwright installation:
PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs \
  node scripts/verify-head.mjs
PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs \
  node scripts/verify-rabbit.mjs
PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs \
  node scripts/verify-booking.mjs
```

The browser check starts its own loopback-only static server and tests
nested-path desktop/mobile loading, wallet lifecycle and public/private
storage boundaries without real funds, wallet signatures or uploads.
Receiving-app result: 31 frontend Node tests and 18 local-EVM escrow tests
passed; desktop (1440px), mobile
(390px), reduced-motion and no-wallet browser acceptance passed. Wallet
responses, upload responses and CID retrieval were synthetic test fixtures,
not evidence of a live provider integration or mainnet deployment.
The booking browser check uses an actual ephemeral EVM through the real
adapter and DOM, with synthetic funded accounts and a mock USDC at the
canonical address. The separate Base-fork check exercises real canonical
USDC proxy/code/state on an in-process fork; it never signs on the upstream
RPC. Its OP Isthmus simulation is token-integration evidence, not proof of
current production gas pricing, finality or meeting reliability.
The shared Head respects reduced motion; the existing animated Calendar
background is not part of that accessibility guarantee.

### Base deployment

`DCalBooking` `dcal-timebox-1` is deployed on Base mainnet at
[`0x56844e14d2e29fb8d9Df04B1F19fB9d732C5063A`](https://basescan.org/address/0x56844e14d2e29fb8d9Df04B1F19fB9d732C5063A)
by DecentAgency.eth (tx `0xf13918bf…b8ac`, block 53221866). Fee recipient and
token-allowlist owner are DecentAgency.eth; ETH and canonical USDC are enabled.
Source is an exact match on
[Sourcify](https://repo.sourcify.dev/contracts/full_match/8453/0x56844e14d2e29fb8d9Df04B1F19fB9d732C5063A/).
Record and standard JSON input: [docs/deployments](docs/deployments/).

### Remaining release gates

External calendar bridges, deployed/reviewed Base escrow,
authenticated Rabbit Hole meetings, hardline countdown/termination and
production operation still require implementation/integration and release checks.
The new candidate registry in `contracts/DCalBooking.sol` (`dcal-timebox-1`)
implements the approved group timebox policy. Checkout/recovery is connected
and tested locally, including a canonical-USDC Base-fork group split, and an
AI security pre-review found no issues; an independent human review,
deployment and a steward-approved minimal production rehearsal remain.
Per-host on-chain overlap is prevented; external-calendar conflicts, a
global discovery index and meeting artifacts are not implemented. The old market must not be used.
The legacy meeting prototype is not authenticated booking access and is
disabled on the published prototype. Event clicks cannot request media.
Repository publication is a separate history/metadata review and explicit
approval step; source visibility does not authorize publishing user data.

See [Launch sequence and operator decisions](docs/LAUNCH.md) for the approved
fee ENS recipient, exact settlement/refund policy, what the steward will sign,
and which remaining checks must pass before any wallet deployment.
Local contract tooling is development-only, never shipped in the Pages
artifact. Package audit advisories must not be confused with a tested
mainnet contract review; no blanket force-upgrade is used.

### GitHub Pages deployment

The Pages address is
[thejollylama.github.io/DecentCalendar](https://thejollylama.github.io/DecentCalendar/).
This is the vanilla prototype, not a production booking service.

[Deploy DecentCalendar prototype](.github/workflows/deploy-pages.yml) runs
the Node tests on pull requests and main pushes. Only main pushes or manual
dispatch deploy; Pages uses the `github-pages` environment and GitHub's OIDC
token, not an embedded credential. `scripts/build-pages.mjs` stages only the
active vanilla runtime, its assets, vendored Head and license notices.
Repository metadata, React prototype, contracts, tests and retired header
modules are not included in the Pages artifact.

Pages must be configured with **GitHub Actions** as its build source.
Subsequent successful main pushes publish automatically. To check the
deployed app using the same synthetic wallet/storage fixtures:

```sh
CALENDAR_URL=https://thejollylama.github.io/DecentCalendar/ \
  PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs \
  node scripts/verify-head.mjs
```

GitHub project Pages shares the owner's origin with other project sites;
URL paths are not a browser-storage security boundary. Do not treat
wallet-keyed localStorage or downloaded JSON as encrypted storage, and do
not use this prototype for sensitive real calendar or meeting data.

## License

Code: [Apache-2.0](LICENSE) · Art and docs: [CC BY 4.0](LICENSES/CC-BY-4.0.txt) · Please keep the [NOTICE](NOTICE) and give The Jolly LaMa / A Decent Agency a head nod when you reuse this work.
Support the work with a [Supporter DNFT](https://thejollylama.github.io/DecentMarket/).
