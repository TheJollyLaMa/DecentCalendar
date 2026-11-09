# Public wallet / ENS calendar layers

The vanilla calendar accepts an explicit wallet address or ENS name plus public-read
consent. **Add public layer** reads that wallet's newest 20 offered policies and
appointments from the pinned Base `DCalAppointments` registry. Each layer has its
own label, resolved nonzero address, color, checkbox, loading/error/stale text,
Refresh and Remove. Checkbox changes do not refetch, connect or sign.
**Read newest 100** expands a truncated page; older records remain unscanned.

Layers are held only in memory. Disconnect, account/network/provider changes clear
them, selected details and in-flight results. On another browser, re-add the
wallet/ENS names: records are fetched from Base, not the other wallet's localStorage.
Own local drafts and recovered appointments remain a separate toggle.

## Read contract and limits

`DECENT_CONFIG.appointments.address` and `runtimeCodeHash` must identify a separately
approved deployment. Reads use `DECENT_CONFIG.chain.rpcUrls[0]`; ENS names use the
existing `createProfileResolver.address` and `DECENT_CONFIG.ens.rpcUrl`.
The appointment client verifies Base 8453, bytecode hash, version and window policy,
and reads each wallet page at one block. Missing deployment, wrong chain, hash
mismatch or RPC failure produces **unavailable**, never successful empty availability.
No deployment or publication is performed by the overlay.

Only publicly offered future choices are projected, grouped into contiguous
windows; closed policies, booked days and elapsed choices are excluded. Confirmed
appointments are busy; cancelled appointments remain labelled but are not busy.
The same offer/window or appointment read through host and invitee layers renders
once with both source-wallet identities. Own recovered appointment IDs are not
rendered twice. Checkbox hiding does not erase known own conflict evidence.
When participant pages disagree, the newer checked chain timestamp supersedes an
older cancellation/policy snapshot; a mixed stale source still remains labelled stale.

Candidate overlap is not a booking or guarantee of free time. Actual dated,
half-open UTC intervals determine overlap; touching endpoints do not conflict.
Window-level counts show known busy conflicts and other offered-window overlap,
not whether a particular duration fits. Known own private drafts can contribute
local visual conflict evidence, but their contents are not uploaded or read by
another wallet. Local public offers do not become confirmed busy appointments.
Private/external calendars, older unscanned appointments and paid booking history
are not discovered by this surface. No automatic wallet-to-IPFS-CID discovery exists.

Snapshots become stale after 60 seconds or a failed refresh. Failed refresh retains
only clearly marked stale evidence. A visible-page timer updates labels and elapsed
choices; it does not scan wallets or sign in the background. Refresh requests an
actual new public read. Errors are per-layer; other layers remain usable.

Click a candidate to inspect its wallets, source and known overlap evidence, then
follow **Open actual availability / choose a time**. This invokes existing
`window.DCalAppointments.openAvailability(id)` (real `?availability=id` link fallback).
Confirmed/cancelled detail opens `openAppointment(id)`. Only that existing appointment
UI can request an explicit transaction from the invited wallet and recheck Base,
current policy and contract conflict checks. The overlay is never booking authority.

## Reuse and receiving-app acceptance

Need: recoverable, checkbox-controlled public wallet layers on one calendar.
Scope checked: Canopy's curated calendar lead, this repository's worktrees/current
issue #31, existing calendar/profile source and the shared uncommitted appointment
implementation on `feat/invited-availability-windows` (base `a3b5c36`).
Canopy's calendar entry is incomplete; it is not an exhaustive code index.
Reuse `js/ens-profile.js:createProfileResolver.address`, existing
`js/invitations.js:inviteAddress`, and the parent's uncommitted
`js/appointment-client.js:createAppointmentClient.readWallet`,
`js/appointments.js:availableChoices/appointmentCalendarEvent/availabilityLink`.
Build only the pure layer projection/state and accessible UI; no shared cross-app
architecture, new discovery service, copied licensing or speculative extraction.
Calendar7/12/31 are not imported as remote/private discovery mechanisms.

Run:

```sh
node --test tests/calendar-layers.test.js tests/calendar-integration.test.js tests/appointments.test.js tests/assets-profile-tutorial.test.js
```

Acceptance covers explicit consent, ENS/nonzero address resolution, independent
checkboxes, refresh errors/staleness, bounded reads, late-result/session clearing,
source identity/deduplication, cancelled versus busy state, elapsed/booked/closed
windows, actual-date and endpoint overlap, own-private evidence isolation and
read-only click routing. Live registry recovery and invited-wallet booking require
the separately approved deployment and real two-wallet rehearsal; mock success is
not evidence of a live deployment.

Browser acceptance on the actual localhost vanilla app at 390px verified the
unconfigured registry's explicit unavailable state, no wallet connection, and
no legacy local-address lookup. An isolated local module/config mock verified two
wallet pages produce two unique public records, independent toggles without new
reads, keyboard inspection, the real availability-ID hook, stale retained evidence
after a failed refresh, successful retry/removal, and no display of a seeded
other-wallet private localStorage sentinel. The layer section and calendar wrapper
fit 390px. Separate Head orbit artwork occasionally extended the page by 5–7px;
the overlay section itself remained within its 388px content width.
Mocks did not sign, deploy, publish or validate a live chain integration.

## Compact controls

The default layer view shows Add/consent, visible layers, checkbox states, errors
and short overlap counts. Small native **i** disclosures (labelled for assistive
technology, keyboard-operable) contain privacy/legend/recovery explanations,
full resolved wallets and page limits. No layers means no Refresh-all control.
Expanded per-layer disclosures survive checkbox/refresh/timer renders.

Free appointments uses the same disclosure pattern. An incoming offer shows its
times, duration, one-per-day rule, zero appointment fee and separate Base gas;
it hides host publishing and unrelated wallet lists. Only the invited wallet
gets Book controls. Other readers see times, not disabled booking machinery.
Host publishing is available from the main appointment view when writes and the
wallet session permit it. Publication consent and gas remain visible within the
opened form. Cancel/export are omitted for cancelled records; export is omitted
for elapsed records. Pending recovery appears when there is a recorded pending
hash; transaction history and ID recovery stay behind i. Errors and submitted /
pending transaction status never move into a collapsed panel.

Signing confirmations still expose both exact wallets, the signing wallet, dates
and host-local booking times, public permanence, one-per-day policy and separate
Base gas. Information controls are presentation only: client/contract checks,
consent and receipt requirements are unchanged.

At 390px, actual visible-text checks measured **32 words** for an empty layer
section and **26 words** for the unconfigured appointment dialog including its
visible error. Isolated two-wallet mocks measured **60 words** for two collapsed
layers and **67 words** for a guest offer with six candidate choices. Expanded i
panels exposed full wallets/limits; keyboard activation worked. Cancelled records
had no cancel/export controls; pending recovery and RPC errors remained visible.
Host template remained Nov 9–12, 07:00–10:00 / 15:00–19:00 New York, 30 minutes.
All tested sections/dialogs fit 390px. A booking confirmation was inspected and
dismissed: no transaction was requested. Automated coverage:
`tests/compact-ui.test.js`; full JavaScript suite: **76 passing**.
