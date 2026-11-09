# First-booking Supporter promotion

The receiving Calendar release pins and enables the verified reward reader.
A deployment receipt is recorded for the reward vault; it
is **funded with ten copies but inactive** at the recorded funding check.
DJuke worker deployment and owner activation are separate rollout gates; no live
gift delivery has been verified. The reader checks on-chain activation and
eligibility before showing pending delivery, and fails visibly on read errors.
The existing appointment registry remains unchanged.

## Agreed rules

- Ten DecentCalendar v0.1.0 Supporter copies: canonical Base DecentNFT
  `0xe63EC9f8228720bAAC2fD528C0A6d06B3Dc5439B`, token **77**.
- Reward the invited guest who actually signs a confirmed appointment, once per
  guest wallet across this promotion, not the host and not after attendance.
- Any two wallets may participate. Fresh wallets and sham bookings can exhaust
  the pool: wallet uniqueness is not unique-human verification. This risk is
  explicitly accepted. The limit means ten gifts, not necessarily ten humans.
- Only bookings created after owner activation qualify. Historical test bookings
  are not retroactively promoted. Cancelled bookings cannot receive a new award;
  cancellation after delivery never claws a token back.
- The worker scans appointment IDs in ascending order, in bounded pages. The
  first ten successful awards win; transaction races and rejected token receivers
  mean no promise of strict chronological fairness.
  Known incompatible ERC-1155 receivers are skipped with explicit operator logs;
  unknown/global token reverts retain the booking cursor for retry, not a
  success-shaped skip. A repaired skipped receiver can be retried with the same
  on-chain appointment ID by a gas payer while the promotion remains open.
- No advance advertisement or purchase requirement. The gift screen appears
  only for a verified eligible/received guest. Pending never means delivered.

## Inventory and funding

Public release [current-listing evidence](https://github.com/TheJollyLaMa/DecentCalendar/releases/download/v0.1.0/supporter-current-listing.json)
identifies listing **15**, not the old inactive listing 7. Independent read-only
checks at Base block **54966960** found 900 sale copies fully allocated to listing
15, **99 Voyager prize copies** held by the VoyagerRewards contract
`0xCa55A59BD2c15D0F11Ae5f7e7E96Bb58eb0B7DE5`, and one unlisted copy held by
TheJollyLama.eth. These are dated observations, not live stock promises.

These are not spare wallet stock: Voyager owns this funded allocation and has
an outstanding signed DCal voucher. Leave Voyager untouched.

Approved reallocation: the Market owner (TheJollyLama.eth) delists **15**,
withdraws **10** copies directly from sale escrow to the reviewed gift vault,
then lists the remaining **890** at the same price and note. There is no
in-place quantity editor; the replacement gets a new listing ID. Rerun
`npm run prepare:reward-funding` after each confirmed transaction for the
verified next unsigned step. The planner refuses changed inventory/terms,
competing active listings or an already activated promotion. Do not resend
unresolved transactions. Publish the actual replacement listing ID in
Calendar release checkout configuration/evidence and coordinate Voyager's
catalog link update after receipt verification. Do not guess that ID.
No private key is required by this read-only planner. A 10-USDC listing price
is not guaranteed cash value.

## Contract and release gates

`DCalBookingRewards` keeps a fixed ten-award limit, one award per recipient,
and locked registry/NFT/token bindings. An `award(appointmentId)` caller pays gas
but cannot choose or redirect the recipient. Stock transfer, recipient marking
and `BookingRewarded` happen atomically; failed receivers leave bookings intact.
Owner pause/stock recovery can suspend gifts and must be reported honestly.
There is no attendance oracle, master-key grant or claim on Market sale stock.

1. `npm run test:rewards` and `npm run prepare:rewards`: local EVM tests and
   read-only source/runtime preparation.
2. `npm run deploy:rewards`: read-only Base estimate. `-- --broadcast` requires
   an interactive terminal and exact **DEPLOY BOOKING REWARDS** approval. The
   existing ENS-key/network/0.0001-ETH deployment guard is reused. Pending
   hash-only evidence is recorded before broadcast; reconcile, never redeploy,
   after interruption. Deployment does not fund, activate or enable anything.
3. Verify `npm run prepare:rewards -- --address <vault>`. Review the recorded
   constructor bindings, deployed owner, source/runtime hashes and receipt.
4. Market owner browser-signs the verified delist, direct withdrawal and relist
   steps above; verify ten gift copies, 890 sale copies and the new listing
   receipt before updating checkout links. Do not use Voyager's release method.
5. Vault owner browser-signs `activate()` after funding. Verify ten copies and
   the recorded starting appointment ID. No real offers should be promised
   before activation/worker readiness.
6. Pin and explicitly enable both worker and receiving Calendar configuration.
   Release remains a separate approval, not implied by a local preview.
7. Two-wallet live rehearsal: booking -> automatic award -> confirmed recipient
   balance/contract record -> reload recovery. Also test duplicate, cancellation,
   offline/error and exhausted-pool cases without wasting production stock.

## Worker and celebration

The Busking feature branch contains `discord-bot/calendar-rewards.js` and
`worker-signing.js`. It reuses the existing DJuke low-balance signer, the RPC
router, and Pinata plus local mirrored checkpoints. Server-only settings are
`DCAL_REWARDS_ENABLED`, `DCAL_REWARDS_ADDRESS`, `DCAL_REWARDS_RUNTIME_HASH`.
No worker key is copied into static Calendar or local deployment worksheets.

Additional gas budget is **0.001 Base ETH** in total: reserve **0.0003 ETH**
for setup (deployment, Market delist/withdraw/relist and owner activation;
review their combined fees against that reserve before signing) and cap
automatic transfers at **0.0007 ETH**. Ordinary guest
booking gas is not reimbursed by this promotion. A **0.0001 ETH per-send**
guard, 20% execution-gas buffer and 0.00001-ETH Base L1 reserve apply.
Conservative fee reservations count even failed attempts. Actual execution/L1
fees are reconciled from receipts; unusually changing Base L1 fees cannot be
guaranteed by an estimate. No new sends are allowed over the budget. Keep at
least **0.001 ETH** in the sponsored DJuke account, or a larger configured
existing worker minimum. No extra gas top-up is implicitly authorized.

When enabled, DJuke/DVert/reward sends from the same account share one signing
lane. A reward's signed, fixed-calldata transaction is checkpointed before
broadcast; two confirmations reconcile it and release its nonce hold.
Interruption only rebroadcasts the same journaled bytes. Ambiguous transactions
stop signing until reconciled; a second production bot must never be started.
Reward scans run every 30 seconds; pending receipts are reconciled every two
seconds. Failures are logged and never produce a success-shaped gift.

The celebration automatically runs the laser fan above the token and rains
calendar, rabbit, community and celebration emojis across the **whole viewport**
for **4 seconds**, without sound or a start button. The decorative rain uses a
pointer-transparent, inert manual popover so it is not clipped by the scrolling
dialog or hidden behind its backdrop. Skip/Continue are
immediately available, and reduced-motion users get a static card. Closing,
skipping, hiding the page, disconnecting or changing wallets stops the effect. The screen
separates pending delivery from a verified contract award; the token link is
shown only after receipt-state verification.
The gift dialog has no information disclosure; promotion terms remain in this
operator document, while the visible delivery status stays in the dialog.

### Completed sale cutover

At Base block **54969585**, independently verified: sale escrow **890**, gift
vault **10**, VoyagerRewards **99** (unchanged), promotion disabled and starting
appointment ID zero. Listing **15** is inactive; replacement **20** sells the
remaining copies at the same price. Receipt evidence is in
[base-dcal-reward-funding.json](deployments/base-dcal-reward-funding.json).
Three transactions cost **0.000002061634655736 ETH**, including Base L1 fees.
Calendar's checkout-only PR #35 is merged and published with listing **20**.
The receiving release retains that checkout and adds the gift reader, not owner
activation. Voyager's catalog cutover is coordinated separately.

The square token card loads `image` from the verified token-77 release metadata
URI (`ipfs://QmPqCy2g53t4BaffprtfjfM4L5imACB1nWZK63HyN9o3Tj`), using the
existing safe-image URL guard and a public IPFS gateway. Image/metadata failures
stay visible with a retry and the Market link intact; no invented artwork.
Clicking the square or Explore link opens DecentMarket's existing
`supporters=1&chainId=8453&nftContract=...&tokenId=77` display/purchase panel.
Market checks current sale listings itself; opening the link does not buy,
connect a wallet or transfer the reward.

Reuse: adapted Market `market-arrival.mjs:parseMarketArrival` exact-token route
and `supporter-display.mjs:collectibleFaces` metadata-image semantics at reserve
worktree commit `c1351196e3eb2870c364cad37664b557df0360c4`; reused Calendar
`ens-profile.js:safeImageURL`. Pinata public metadata was retrieved and its image
confirmed; receiving-app tests check the requested metadata URI, safe URLs,
exact Market route and failure states.

## Reuse decision and tests

Need: automatic gift after a real free booking plus a truthful, accessible
celebration. Source scope inspected: Canopy offers/needs, Calendar public issues
21/26/current release assets, Market current public main
`2274bb0061df0fcacb60ebd81a00e0ffbd42c496`, and the clean reserve worktree at
`c1351196e3eb2870c364cad37664b557df0360c4`.

- Adapt Market `contracts/DecentEscrow_v001.sol:withdrawNFT/listDNFT` inventory
  boundaries and `js/market-listings.mjs:readFundedListings` aggregate-stock
  invariant. Reallocate sale stock only after delisting, then relist the reduced
  quantity; do not touch Voyager prize custody or change Market contracts.
- Reuse Calendar `invitations.js:foldICS/googleCalendarLink` for UTC-safe export
  and reminder/device actions. Local export tests assert the actual
  `VALARM/TRIGGER:-PT15M`, cancellation alarm removal and Google UTC parameters.
- Adapt Busking `worker-reserve.js:createWorkerReserve` signed-before-broadcast
  journaling and checkpoint helpers. Reward calldata/limits/recipient semantics
  differ; keep treasury refills and performance USDC settlement separate.
- Build the small new vault: no reward hook exists in deployed appointments,
  and Market owner-only custody cannot automatically verify Calendar eligibility.
  Public source licenses are retained; worker implementation in its isolated
  feature branch is not proof of a tested production integration.

Local EVM tests cover ten-award exhaustion, guest-only delivery, duplicate wallet,
old/cancelled bookings, pause/funding, rejected receivers and reentrancy.
Worker tests cover restart rebroadcast, checkpoint failure, shared account nonces,
exact aggregate gas-cap rejection and DJuke reserve protection. Real media,
real-device imports and mainnet reward delivery remain separate acceptance gates.
