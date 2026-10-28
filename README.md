# DecentCalendar
🗓️ A Decent Calendar - another decent creation by TheJollyLaMa to return back some agency to the decent people of 🌎

## First-version build: shared Head foundation

The vanilla app is the active receiving implementation for this work. The
React prototype has not been migrated. This is **not a live paid-booking
service**: minting, checkout, fiat payment, settlement and video meetings remain unavailable
until the Base release gates are implemented and validated. No contracts
were deployed by this integration.

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
  Kubo provider. It does not publish private events, room IDs, booking state,
  token IDs, feed credentials or unrelated localStorage. Public descriptions
  still need human review: do not put secrets in them. IPFS copies may
  persist forever. A returned CID is not proof of durable retention.
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
the app's existing address/signer consumers. Admin/Profile menus remain
inert Head placeholders, not privileges.

### Run and validate

Serve `decent-calendar-vanilla/` over HTTP(S), including at nested paths; do
not open the HTML using `file:`. The existing `npm run serve:vanilla` serves
port 8080. Head dependencies are vendored; FullCalendar and PeerJS still
use a CDN dependency for FullCalendar. The unauthenticated PeerJS runtime
is disabled and its CDN bundle is no longer loaded.

```sh
npm test
# With an existing Playwright installation:
PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs \
  node scripts/verify-head.mjs
```

The browser check starts its own loopback-only static server and tests
nested-path desktop/mobile loading, wallet lifecycle and public/private
storage boundaries without real funds, wallet signatures or uploads.
Receiving-app result: 18 Node tests passed; desktop (1440px), mobile
(390px), reduced-motion and no-wallet browser acceptance passed. Wallet
responses, upload responses and CID retrieval were synthetic test fixtures,
not evidence of a live provider integration or mainnet deployment.
The shared Head respects reduced motion; the existing animated Calendar
background is not part of that accessibility guarantee.

### Remaining release gates

The White Rabbit tutorial, external calendar bridges, Base escrow and
exact-amount supported-asset checkout, authenticated Rabbit Hole meetings,
hardline countdown/termination and production operation are still planned.
The legacy meeting prototype is not authenticated booking access and is
disabled on the published prototype. Event clicks cannot request media.
Repository publication is a separate history/metadata review and explicit
approval step; source visibility does not authorize publishing user data.

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
