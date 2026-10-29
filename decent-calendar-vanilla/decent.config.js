/* DCal host configuration. Set before the canonical Head module loads. */

window.DECENT_CONFIG = {
  version: '2.0.0',
  appName: 'Decent Calendar',
  subtitle: 'Time, knowledge, wisdom and presence have value.',
  chain: {
    chainId: 8453, chainName: 'Base', rpcUrls: ['https://mainnet.base.org'],
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    blockExplorerUrls: ['https://basescan.org'],
  },
  ens: { enabled: true, rpcUrl: 'https://ethereum-rpc.publicnode.com' },
  theme: { accent: '#00ffff', 'accent-2': '#bd7cff', 'bg-1': '#080e1a', 'bg-2': '#131b30', 'bg-3': '#122c30' },
  about: {
    title: 'About DecentCalendar',
    summary: 'A Decent Agency calendar for recognizing the value exchanged when we sync up.',
    sections: [
      { title: 'Why time matters', body: 'Knowledge, wisdom, presence and care deserve acknowledgement. DCal is being built to help people agree on the value of their time, then book and meet with clear terms.' },
      { title: 'What works today', body: 'This is a local calendar prototype with an explicit Base wallet session. Local backups stay on your device. Public availability is shared only after preview and consent. Wallet-address lookup currently reads this browser, not a global directory. Video meetings are disabled until booking-bound authentication and explicit media consent are ready.' },
      { title: 'Private means private', body: 'Public availability omits private events and meeting IDs. Public IPFS content can remain available forever. Local backup files can contain private details; keep them offline and safe. Never paste feed credentials or room secrets into public event descriptions.' },
      { title: 'Small-value paid office hours beta', body: 'Base ETH and canonical USDC payments are enabled. Independent audit and a complete mainnet rehearsal are not yet recorded: funds are at risk, keep stakes tiny. A host offers per-head or split timeboxes with 1-50 attendee seats; host timeboxes never overlap. Development receives 3% of settled seats; gas is separate. USDC approval alone is not a booking. Resolution creates credit requiring withdrawal. Video meetings are not live. Never send funds outside a verified agreement.' },
      { title: 'Public invitations', body: 'Your public calendar is your office door, not your whole life. The right ankh has a public Base invitation inbox. Sending an invitation publishes host, recipient and timebox forever and requires host signature and gas. Unknown hosts are Requests; trusted unread invitations glow neon blue. Read/trust/mute settings stay on this device. Requested places and intended-invitee preferences do NOT reserve or restrict seats. Only joining commits a seat. Links and calendar reminders do not pay or authenticate the sender. Inbox failures are reported explicitly.' },
      { title: 'Follow the white rabbit', body: 'Start the guided trail from the rabbit button below the header or replay it from the right ankh. It remembers your place and explains profiles, local drafts, currency previews, storage and release gates without connecting, signing, paying, uploading or requesting media.' },
      { title: 'Next on the trail', body: 'iCalendar/Google calendar bridges, authenticated Rabbit Hole meetings and optional hardline endings still require implementation and release checks. A hardline will warn during the final five minutes and end at the scheduled finish, without automatically settling payment.' },
      { title: 'Identity and permissions', body: 'The right ankh opens a read-only ENS profile with forward-verified primary name and optional avatar/banner records. ENS lookup sends public addresses to an Ethereum RPC; image hosts see image requests. Artwork and names are not payment or booking proofs. Disconnect clears this app session, not wallet permissions. The left Admin menu remains an inert placeholder, not authorization.' },
    ],
  },
  links: [{ label: 'Public DCal roadmap', url: 'https://github.com/A-Decent-Agency/a-decent-agency.github.io/issues/15' }],
  relatedDapps: [
    { label: 'DecentCanopy', url: 'https://github.com/TheJollyLaMa/DecentCanopy' },
    { label: 'A Decent Agency Planning Office', url: 'https://a-decent-agency.github.io/?site=PVTI_lADODD7ovc4Bn91hzhELHuo' },
  ],
  tokenAddress: '',
  booking: {
    address: '0x56844e14d2e29fb8d9Df04B1F19fB9d732C5063A',
    runtimeCodeHash: '0xba6aecb43102ac28b8ba3069587798e6a2746bc52312553fe16d24e310e6628d',
    feeRecipient: '0xcAeEd8422fB5682C298B7F0971906d446fFd4e7a',
    writesEnabled: true,
  },
  invitations: { address: '0xde00A0B54FB76DC453B3A68522c592617430556c', runtimeCodeHash: '0x5daf254be1c1cb9fa3bc9b76a6d36e3942d41856fff27a13645547c48057c906' },
  contractAddresses: {
    TimeslotNFT: '',
    TimeslotMarket: '',
  },
  supportedChainIds: [8453],
  defaultChainId: 8453,
  defaultChainHex: '0x2105',
};
