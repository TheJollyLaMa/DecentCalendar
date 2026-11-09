# Invited availability and free appointments

The new registry is deployed and independently verified on Base. The receiving
Calendar release enables public appointment writes with explicit browser-wallet
signing. A source test or local preview is not a live booking link.

Deployment: `0xa61869FD9C4376fF1DA9E7dF48b5Ba746d4bD048`, block `54943576`,
transaction `0x59b2266404930b3c88e565fc798f3b0066bd22ea4af29a9fdc5472e37e504997`.
Exact source/runtime hashes and the historical deployment-time writes-disabled
configuration are recorded in [deployment evidence](./deployments/base-dcal-appointments-1.json).
The current site config pins those hashes and enables writes. Two-wallet live
rehearsal and real availability publication remain outstanding.

The approved local two-wallet rehearsal uses a loopback-only preview.
The checked-in config now has `writesEnabled:true`; deployment receipts retain
their original `false` value as historical evidence. A server that changes config
using string replacement must be checked again after this cutover: replacing
`writesEnabled: false` no longer overrides the current appointment setting.
Server overrides are not an authorization boundary. Browser-wallet confirmations
submit real Base transactions and permanent public records.

## The receiving need

A host offers date-bounded daily windows to one wallet. That person picks one
fixed-duration appointment per host day, signs a Base transaction with no
attendance fee, and both people's DecentCalendar views recover the same confirmed
record from chain. Host and guest appointments cannot overlap within the new
registry; cancelled appointments free the day for another choice.

For the first pilot the intended template is four Mon-Thu dates, 30 minutes,
07:00-10:00 and 15:00-19:00 America/New_York. This is **14 candidate starts per
day**, ending at 09:30 and 18:30. No performer address or public offer is
hardcoded. The steward must approve the actual wallet, dates and public subject.

## Flow

1. Connect the host wallet on Base. Open **Free appointment windows**, enter the
   invited wallet/ENS, dates, weekdays, windows and duration. ENS is resolved with
   the existing forward-address helper. Review the exact resolved address.
2. Explicitly consent to permanent public wallets, dates and subject. Publishing
   is an on-chain host action, not a clipboard link or automatic message.
3. Copy the generated `?availability=<actual registry ID>` link and send it.
   Viewing the public link needs no wallet and grants no booking rights.
4. The invited wallet connects on Base, selects a candidate, reviews local/host
   times and signs. Confirmation means a successful receipt and chain record,
   not just pressing the button. There is no token approval, fee or deposit;
   Base gas is still required.
5. The guest's view refreshes after confirmation. The host's visible connected
   calendar refreshes every 30 seconds and on visibility return; disconnected
   browsers do not secretly run background services. Wallet-indexed chain reads
   recover appointments across devices without copying localStorage.
6. Either participant may cancel before start. Cancel then choose again is two
   transactions, **not atomic rescheduling**. Closing offered windows blocks new
   choices but does not cancel already confirmed appointments.
7. Use **Add to iPhone / Android** to export a static `.ics` containing a
   `VALARM` display reminder 15 minutes before start. Confirm the import in your
   calendar; Android app support varies and may require Google Calendar web
   import. **Add to Google** opens a UTC-safe template with the public subject,
   time and availability link. Set a 15-minute notification before saving:
   Google templates cannot enforce reminder settings. Calendar permissions and
   device settings control alert delivery. Neither action is a live subscription;
   rescheduled/cancelled events need manual updates. Cancelled ICS has no alarm.

An appointment is not proof of attendance, meeting-room authorization,
performance-slot reservation, $10 prep-task payment or escrow funding.

### Public UI and link handoff

Use the current [Pages app](https://thejollylama.github.io/DecentCalendar/), not
the fixed ENS snapshot. Connect the approved host wallet on Base, click
**Free appointments**, then expand **Offer windows**. Confirm the
invitee directly before entering their wallet/ENS. Enter the reviewed public
subject, first/last dates, `America/New_York`, Mon/Tue/Wed/Thu only,
07:00–10:00 and 15:00–19:00, and **30 minutes**. For the November 9–12, 2026
template the preview is eight windows and 56 candidate starts (14 per day);
the last morning/afternoon starts are 09:30/18:30. These are candidate slots,
not published offers or proof that either wallet is free.

Check the permanent-public-record consent, click **Review and publish windows**,
review the resolved host/invitee, dates, subject and gas, and sign only if correct.
After a successful receipt, expand the offered-wallet information panel and use
**Copy link**. Share that exact generated URL; do not invent or predict its ID.
The app reads `?availability=<positive decimal registry ID>`, then fetches the
actual offer from the pinned registry. The URL contains no recipient/subject
or room secret. Viewing it does not book; only the contract's invited wallet
can choose a time and sign.

The read-only browser entry points are
`window.DCalAppointments.openAvailability(id)` and `openAppointment(id)`.
They fetch records and open the existing UI; neither is a publication or
signing API. `appointmentWindows()` builds UTC window structs locally, while
`createAppointmentClient.publish()` is a separately gated wallet-signing action.
No helper sends an invitation or direct message automatically.

## Source and invariants

- `contracts/DCalAppointments.sol`: fundless immutable registry. No admin,
  upgrade, royalty, token custody or settlement powers. Only the offered invitee
  can book; both participant linked lists reject stale hints/overlap. The
  offer's explicit day keys group daily windows; the client validates them
  against the host IANA timezone. Contracts cannot resolve IANA daylight saving.
- `appointments.js`: converts local windows to UTC, rejects nonexistent or
  ambiguous DST input, validates host-day keys, emits exact duration-grid choices
  and calendar exports. Full choices are candidates, not guaranteed free time.
- `appointment-client.js`: pinned runtime/version and Base checks, block-tagged
  reads, bounded newest wallet history, exact wallet checks, receipt handling and
  local pending-hash recovery. Unknown/failed RPC is never a successful empty
  calendar. Older records can be recovered by their ID/link.
- `appointment-ui.js`: explicit offer consent, separate signing, incoming
  availability link, local calendar projections and errors/stale indication.

Local recovery hashes prevent ordinary repeat clicks and known pending retries,
but localStorage is not a cross-device lock. The contract resolves booking races:
one daily booking wins; a duplicate exact availability publication also reverts.
Review chain records before retries from another device or dropped/replaced
transactions. A changed wallet must not sign terms reviewed by another wallet.

## Existing calendar boundaries

The deployed `DCalBooking` and `DCalInvitations` are unchanged. Their old paid
timeboxes retain their original open-seat, funds and invitation semantics.
The client checks the pinned legacy registry's **host** timebox conflicts before
submitting a new appointment. That is not atomic across registries and does not
cover legacy attendee timeboxes, private/external calendars or later legacy
transactions. Do not label a candidate universally free or claim retroactive
invite-only protection on old timeboxes.

Only published public records may appear in wallet/ENS overlays. A wallet lookup
cannot discover somebody's private local calendar. IPFS availability publication
does not by itself establish a wallet-to-latest-CID index.

## Deployment gates

`npm run test:appointments` exercises requested window counts/DST and actual
two-wallet local EVM operations. `npm run prepare:appointments` compiles the
reviewed source and returns creation bytes, source/runtime hashes and a
**writes-disabled** configuration; it performs no transaction.

Before live use:

1. Review source, contract tests, privacy and cross-registry limitations.
2. Steward explicitly approves deployment on Base and signs from their wallet.
3. Run `npm run prepare:appointments -- --address <deployed-address>` against
   Base and verify the exact deployed runtime/version.
4. Configure the reviewed address/hash and explicitly enable appointment writes.
   Release the site through the normal separate approval process.
5. Rehearse in two independent browsers/wallets, including rejection, cancellation,
   receipt recovery, polling and actual calendar projection. Check native `.ics`
   import manually. Only then publish real windows and send the actual link.

No production credential or private key is required by static Calendar.
Never paste a seed or private key into the app or a public document.

### Local low-balance live-test setup

The isolated Calendar feature worktree has a gitignored `.env`, permission 0600,
with a **blank** `DEPLOYER_PRIVATE_KEY`. For CLI deployment only, fill one wallet
locally and select `DCAL_DEPLOYER_ENS=DecentAgency.eth` (recommended) or
`TheJollyLama.eth`. The CLI re-resolves ENS and requires that exact wallet on Base.
Neither participant needs to share a key for ordinary browser-wallet testing.
Do not confuse Ethereum ETH with the Base ETH needed here.

`npm run deploy:appointments` is read-only even with a key filled. It verifies
wallet/network and estimates gas. `-- --broadcast` additionally requires an
interactive terminal and typing `DEPLOY APPOINTMENTS`. No piped confirmation is
accepted. `DCAL_DEPLOY_BUDGET_ETH` defaults to 0.0001; preflight allows a 20% gas
buffer and explicit 0.00001 ETH L1-data reserve. This is a conservative estimate,
not a guarantee against changing Base data fees. Execution fee caps are fixed for
the signed transaction. Recheck before approving.

Only one registry deployment is needed. A hash-only ignored pending record is
written **before broadcast**; interruption never authorizes another deployment.
Reconcile its transaction and derive/verify the resulting address before removing
that guard. A successful deployment writes public receipt evidence with
`writesEnabled:false`; configure/release/enable writes separately. Set
`DCAL_APPOINTMENTS_ADDRESS` locally afterwards and clear the deployer key.

Use DecentAgency.eth as host and TheJollyLama.eth as guest for the initial
two-browser live appointment test, with a tiny fundless test offer. This does not
replace the musician's actual invitation wallet. Test one booking/cancellation,
then publish the approved musician windows; avoid redundant deployments and
unnecessary transactions. Both wallets were resolved and their Base gas balances
checked read-only during preparation; no ETH moved.

## Reuse decision

Receiving test: invited guest chooses a free half-hour in host windows and both
calendars recover the same Base appointment. Adapt existing Calendar main
`a3b5c360e5e038536c902f1dbd4d4506d496afc2`: `DCalBooking.findPrev/link/unlink`,
`booking-client.confirmedBookingReceipt`, `createProfileResolver.address`,
`invitations.foldICS` and existing calendar/session lifecycle. Paid booking
semantics are incompatible with worker wages and flexible invite-only choices,
so build one separate fundless registry rather than change deployed contracts.
Timezone conversion adapts Busking main `5c1db30`,
`js/radio-calendar.mjs::newYorkInputToUtc`, adding IANA-zone validation and
ambiguity rejection. Calendar's Apache-2.0 license applies; no vendor fork.
Canopy and Calendar issues #7/#12/#31 were inspected as leads, not proof of
complete remote availability. The build remains uncommitted feature work until
review; local EVM/browser results are not production deployment evidence.
