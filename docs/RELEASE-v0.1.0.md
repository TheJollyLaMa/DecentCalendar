# DecentCalendar versioned Supporter readiness

Review date: 2026-11-05. Recommended first tag: **`v0.1.0-beta.1`**,
not `v1.0.0`. This is a supportable, explicitly limited beta snapshot, not
completion of the paid-scheduling v1 roadmap. No release, tag, mint, listing,
ENS update or announcement has been created by this change.

## Exact scope

Baseline: `761541e24e22bed9a45289cc4f82a7db7510de0d` (`origin/main`,
merged PR #33). This release candidate retains:

- Canonical vendored DecentHead 2.0.0: explicit Base wallet session,
  forward-verified ENS display, orbit header, About and host-owned IPFS controls.
- Browser-local private/public calendar drafts, explicit private JSON backups,
  consent-based public availability publication and validated imports.
  Wallet lookup is browser-local, **not cross-browser public discovery**.
- Base small-value ETH/canonical-USDC group-timebox beta: immutable terms,
  per-head/split pricing, seat joining, runtime/policy checks, fee disclosures,
  recovery, resolution and credit withdrawals. The existing 3% settled-booking
  fee is separate from optional Supporter purchases.
- Invitation links/ENS resolution, local roster, UTC `.ics` and Google template
  export; explicit host-signed public invitation registry/inbox, Requests,
  trusted unread badges and device-local read/trust/mute state from PRs #32/#33.
  Invitations/preferences **do not reserve or restrict seats**.
- Two-timezone agreement display, asset-aware exact-decimal previews,
  a twelve-step inert/replayable white-rabbit tutorial and read-only profiles.

New in this candidate:

- A Supporter section in the existing title/About modal, matching Head's
  semantic section/heading/quiet-text conventions without changing the vendor.
  It says **Unavailable — preparing**; there is no configured token/listing.
  There is no Supporter wallet, approval, signing, PayPal or purchase button.
- Receipt-shaped, fail-closed configuration for a future external DecentHead
  checkout. Only the canonical HTTPS checkout route with Base, approved escrow,
  listing and exact 10-USDC query can be linked; missing/invalid evidence keeps
  the card unavailable. This validates trusted configuration shape, **not live
  chain state**; the steward must first verify evidence through the shared kit.
- SHA-pinned preparation and optional announcement callers. The shared kit's
  `site_root: decent-calendar-vanilla` renders and pins the real tagged app
  rather than accidentally serving the repository root.
- Unit/build coverage and a nested-path desktop/mobile About verifier.

## Edition and steward gates

Approved policy: 1,000 editions, `10000000` six-decimal USDC units (10 USDC),
Base 8453; existing DecentNFT
`0xe63EC9f8228720bAAC2fD528C0A6d06B3Dc5439B`, community escrow
`0x31b07b83e99A9bdF379bf40225b8A80d3804C89d`.
Creator/royalty defaults are inherited unchanged from DecentHead's kit;
do not infer them from Calendar booking fees or replace them locally.
There are deliberately **no token IDs, listing IDs or receipt hashes** here.

1. Review/merge through the parent coordinator, then publish the agreed exact
   version tag/release. Do not silently call this full v1 acceptance.
2. Configure `PINATA_JWT` in this repository; preparation is blocked until it
   exists. Do not read/copy credentials from another app. Preparation performs
   pinning and opens the steward issue, not wallet transactions.
3. Review the rendered front/back, provenance, immutable source commit,
   flattened static site and frozen manifest for the published tag. Confirm
   the creator/royalty defaults and the policy above before any signing.
4. The authorized steward alone performs mint/listing actions separately.
   Register public evidence with the pinned kit, verifying receipt success,
   mint quantity/token, at least 12 confirmations, escrow, price and stock.
5. Only then populate
   **`decent-calendar-vanilla/js/supporter-release.js`** in a reviewed follow-up.
   Required fields and checks are documented in the root README and exercised
   in `tests/supporter.test.js`; `js/supporter.js` needs no token-specific edits.
   Use the verified `purchaseUrl`, not a guessed token or listing route.
   The allowlisted destination is
   `https://thejollylama.github.io/DecentHead/supporter/buy.html`;
   its existing checkout rechecks the live listing and handles signing.
6. ENS is optional configuration, never a guessed name or automatic signing
   authorization. For announcements, provide `DISCORD_SUPPORTER_WEBHOOK` and
   explicitly set `SUPPORTER_DISCORD_ENABLED=true`; the shared workflow holds
   delivery until mint/listing and ENS/site evidence passes. The parent owns
   actual preparation, mint coordination and approved Canopy/Office updates.

The pre-mint tag's site will remain honestly “preparing,” even after a later
current-site receipt-config commit. Never move/rewrite that immutable tag.
Missing secret **names only**: `PINATA_JWT`, `DISCORD_SUPPORTER_WEBHOOK`
(the latter is unnecessary while announcements are disabled).
Optional public variables: `SUPPORTER_ENS_NAME`, `SUPPORTER_ENS_RPC_URL`.

## Every current open issue

Snapshot: 23 open issues, no open PRs. All stay open; no blanket closure or
roadmap relabeling is implied. “Next” means next feature version, recommended
`v0.2.0`, or a later explicitly scoped v1 milestone, **not a promise to ship
every item in v0.2.0**. Receipt delivery is a separate steward gate.

| Issue | Present scope / explicit disposition |
| --- | --- |
| #3 Base identity and wallet routing | Shared Base session/ENS exists; defer static public-wallet routing and clean-browser/back-forward acceptance to next. It depends on actual remote discovery, not localStorage masquerading as a directory. |
| #4 Visual identity/provenance | Existing relative assets, notices and reduced-motion surfaces retained; new About checked at 320/390/1440. Defer whole-app contrast/optional-asset matrix to next; do not touch unrelated local image work. |
| #5 Publication/latest-pointer discovery | Explicit public-schema preview/upload and private backup exist. Defer authenticated wallet-to-latest-CID index, stale-pointer handling and browser-A/browser-B acceptance to next; requires a public discovery contract/service decision. |
| #6 Independent calendar layers | Own/public views exist. Defer imported busy layers, idempotent source updates and conflict-safe toggles to next, alongside #26 parsing/privacy work. |
| #7 Remote availability lookup | Same-browser lookup is disclosed honestly. Defer clean-browser wallet discovery and booking-aware remote reconciliation to next; blocked on #5's approved index. |
| #8 Accessible state labels | Existing state text and details retained. Defer full non-color legend, imported/stale vocabulary and assistive-technology audit to next; no claim that color proves payment or meeting completion. |
| #9 Canonical slot model | Existing `DCalBooking` group registry/immutable terms replaces collectible ownership; ID-zero remains explicitly nonexistent for this deployed model (booking IDs start at 1). Defer broader invariant/ABI acceptance review to next; no new contract or transfer-based obligations. |
| #10 ETH/USDC escrow | Existing integer-safe payments, refunds, expiry and credit withdrawal remain a tiny-value beta; local suite passes. Defer additional ERC-20 behavior, independent review and complete Base-fork/mainnet rehearsal to next; no contract upgrade is safe to improvise in Supporter work. |
| #11 Bookable offers | Owned drafts publish immutable ETH/USDC group timeboxes with preview/hardline terms. Defer imported/private conflict checks and expanded token/free-path acceptance to next with #6/#26 and policy review. |
| #12 Booking sync/recovery | Receipt reconciliation, ID recovery and wallet-change protections exist. Defer global bounded discovery/indexing, full reorg/replacement/race/resume matrix and multi-device proof to next; current checked snapshots are not an automatic chain index. |
| #13 Exact Base checkout | Existing ETH/USDC exact allowance/payment disclosure is retained; unsupported fiat/direct-transfer paths stay disabled. Defer additional allowlisted ERC-20 and full replacement/free-session journey acceptance to next; Supporter checkout is separate and external. |
| #14 Authenticated Rabbit Hole | Unavailable. Defer booking-bound proof/admission, media consent, signaling/TURN and real two-device tests to next; a link or ENS name cannot authorize a room. |
| #15 Mobile/accessibility | New About card passes narrow/desktop layout, keyboard reopen/Escape and reduced-motion context. Defer complete booking/meeting/wallet deep-link/device/assistive matrix to next; Chromium fixture evidence is not universal device support. |
| #21 Supporter release kit | Callers/card/provenance scope implemented here. Defer actual delivered edition/receipt/ENS/announcement acceptance until coordinator-controlled release and steward mint; preparation credentials and receipts are absent. Full v1 acceptance is not claimed. |
| #22 v1 umbrella | Keep open. This is v0.1 beta supportability, not the complete import → discovery → payment → authenticated meeting → settlement journey. Defer remaining epics and full v1 milestone to subsequent feature versions. |
| #23 Agreement model | Existing runbook/registry document 300 bps, immutable terms and credits. Defer independent policy review, unresolved broader dispute/no-show/service-hardline guarantees to next before changing any contract. Timer expiry is never proof of delivery. |
| #24 Canonical DecentHead | Existing exact vendor/session/storage adapter and notices retained, with a host-only About extension. Defer newest-distribution upgrade/full lifecycle screenshot matrix to next; release workflow pinning is not a browser vendor upgrade. |
| #25 About/white-rabbit tutorial | Existing honest About/tutorial retained; Supporter limits added without any action on opening. Defer real external-calendar/meeting/hardline tutorial steps, About replay/control restoration and complete two-role journey acceptance to next; unavailable features are not simulated as working. |
| #26 Calendar bridges | `.ics`/Google one-off export ships from invitations. Defer maintained parser, recurrence/DST/cancellation/private busy import, feed refresh/CORS policy and receiving-calendar manual checks to next. No OAuth/background sync is promised. |
| #27 Hardline | Immutable opt-in flag exists, not enforced call termination. Defer countdown, trusted-time admission, background/reconnect and media-track cutoff tests to next with authenticated meetings; a client timer cannot certify settlement or tamper-proof P2P enforcement. |
| #28 Release gates | Unit/local contract and focused browser checks run for this candidate. Defer full import/discovery/room journey, independent review, Base fork and approved low-value mainnet rehearsal to next; no real funds used to validate gaps. |
| #29 Deployment/operations | Existing Base manifests and Pages allowlist remain. New exact-tag static preparation is configured. Defer public operational/runbook approval, complete live payment/refund evidence and receipt-backed inventory to next/coordinator; no mainnet transactions or fee-income claims here. |
| #31 Invitations | PRs #32/#33 deliver links, roster, one-off calendar export and optional signed public inbox/badge. Defer enforced invite-only reservations (new audited contract), optional opt-in delivery channels and manual Apple/Google DST import checks to next. Requested places/intended invitees are explicitly non-binding; public sends disclose permanence. |

## PRs, branches and unfinished work

All current remote branches and relevant locally retained work were assessed
without changing/deleting any branch or another worktree:

- `origin/main`: `761541e24e22bed9a45289cc4f82a7db7510de0d`;
  includes invitation PRs **#32 and #33**, both merged. No reimplementation.
- Remote `copilot/update-header-for-web-component`:
  `afc4cfc9fff17e9043f8679d76e8b68dcd7e080f`, corresponding to **closed PR #2**;
  25 main-only / 3 branch-only commits. Its legacy local Web Component rebuild
  still configures Polygon Ommm decoration and separate wallet/header modules,
  superseded by main's canonical Base Head. Do not merge/cherry-pick this
  obsolete stack into the Supporter candidate; retain untouched for history.
- Locally retained remote-tracking `feat/invitations`
  (`936b25084f7d3a959b09da695706c2b151bbf74f`) is 1 main-only / 0 branch-only
  commits; invitation work is already incorporated.
- Locally retained remote-tracking `copilot/make-header-title-clickable`
  (`b0e270b9173fb9bb64c52c1943c2f84f04fd489f`) has 14 main-only / 3 branch-only
  commits. **PR #20 is merged**, but squash/history means this tracking head is
  not an ancestor. Its old clickable-title/centered-About/how-to implementation
  is functionally superseded by the current Head About and host tutorial;
  no legacy header revival is needed. Retain history, no cherry-pick.
  The remote API no longer lists these latter two heads; no pruning/deletion
  performed.
- Historical PRs #1/#17/#18 are merged. There are **zero current open PRs**.
- Existing `calendar-decent-head` and `calendar-invitations` worktrees and the
  original dirty Calendar checkout were left untouched. This candidate uses
  only the fresh `calendar-supporter-release` worktree/dedicated branch.
  No unrelated asset was staged or copied.

## Reuse decision and licensing

Need: archive the actual Calendar version and expose optional support honestly,
without duplicating wallet/signing or the ecosystem release pipeline.

- Canopy `data/agency-map.json` was consulted as a lead; its Calendar entry only
  says repository identity unresolved. It is not proof of implementation.
  No public inventory snapshot is changed by this work.
- Inspected DecentHead donor at
  `426ccb7ad8de658cda374b11ebc4b544b35257e6`: reusable
  `.github/workflows/product-supporter-{prepare,announce}.yml` and
  `templates/supporter/`. Adapted caller templates and then pinned the parent’s
  published compatible static-root fix at
  **`2b87543db1ff5c44c720e5c7f782386bbd702bc1`** in both `uses` and `head_ref`.
  This avoids a new root wrapper, copying secrets, or independently rebuilding
  the release machinery.
- Reused the actual Calendar vendored Head
  `js/components/Header/AboutModal.js` dialog structure via the host adapter
  `js/supporter.js`; vendor and its existing notices remain unchanged.
  Its built-in purchase implementation is deliberately not configured.
- The requested BigNuten `main:js/supporterToken.mjs` prior-art path was not
  available in the accessible local main/origin-main snapshots; that checkout's
  origin fetch returned repository-not-found. No claim of whole-library
  absence or a tested BigNuten integration is made. Existing Head external
  `supporter/buy.html` is the compatible checkout rather than new signing code.
- Donor code is Apache-2.0 with required NOTICE; artwork/docs are CC BY 4.0
  subject to third-party exceptions. Calendar already carries the corresponding
  LICENSE/NOTICE/CC attribution, preserved by the Pages build. The static source
  root also includes `NOTICE` with Calendar/Busking attribution and CC license
  links; the complete Apache license and Head notice already travel in the
  vendor directory. No new donor art or third-party dependency is copied.

Receiving acceptance: pending About never exposes a transaction control;
untrusted/incomplete config never becomes a checkout link; actual nested static
build renders on desktop/mobile. Tests and results are below.

## Hosting, runtime and verification

- Public Pages URL/root:
  `https://thejollylama.github.io/DecentCalendar/`.
  Source/render root: **`decent-calendar-vanilla/`**, entry `index.html`.
  Never serve/pin the whole repository as the app.
- Browser site needs no bundler/npm build or application secrets. It uses
  browser ES modules, vendored Head/ethers and existing external calendar/date
  CDN assets from the HTML. HTTPS is required for normal wallet/share behavior;
  public Base/Ethereum RPC, optional ENS images and configured IPFS gateways
  have ordinary availability/privacy dependencies.
- `node scripts/build-pages.mjs` assembles an allowlisted **`_site/`** for Pages
  and preserves license notices. It intentionally refuses an existing output
  directory. Preparation instead renders/pins the exact tagged static source
  directory, including its distribution `NOTICE` and vendor license notices.
- Node 24, Python 3 and the locked dependencies are required for tooling/CI;
  the preparation job provisions Chromium from the pinned shared kit.
- `npm test`: **54 passed**, including five new Supporter tests and Pages
  module inclusion. Pages test scratch output now stays inside this worktree.
- `npm run test:escrow`: **23 passed** (existing contract/adapter regression
  suite, local chain only). Locked dependencies restored with
  `npm ci --ignore-scripts` after the missing-package failure.
- `PLAYWRIGHT_MODULE=<existing-playwright>/index.mjs node scripts/verify-supporter.mjs`:
  **passed at 1440, 390 and 320 px**, actual allowlisted site at a nested path;
  no page errors, no purchase controls, no horizontal overflow, keyboard reopen
  and Escape work. External requests are blocked in this fixture, so this is
  not RPC/CDN/ENS/checkout or native-wallet availability evidence.
- Canonical external checkout path responded HTTP 200 on review; no purchase
  or connection was attempted. No Base-fork or mainnet transaction validation
  was performed by this work.

## Risks and rollback boundaries

The existing Base paid-booking beta remains live-configured; independent audit
and complete mainnet rehearsal are still unrecorded. Keep stakes tiny.
Public chain invitations/timezones and public IPFS payloads are persistent;
private backups are unencrypted. Imported busy data, public remote discovery,
authenticated calls and automatic hardline cutoff are not available.

Rollback of the Supporter UI is to leave/reset `SUPPORTER_RELEASE` to `null`
and disable announcements, not to fabricate an inactive purchase result.
Never disable existing refund/withdrawal recovery while halting new bookings;
use the separate booking operator runbook in `docs/LAUNCH.md`.
No Supporter revenue, successful mint, delivered token or live inventory is
asserted until public receipt evidence exists.
