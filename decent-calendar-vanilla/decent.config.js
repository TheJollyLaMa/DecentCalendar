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
      { title: 'Planned paid bookings', body: 'The v1 target is Base with ETH, USDC or an agreed supported token. The planned development fee is 3% of settled paid bookings, deducted from the gross; Base gas is separate. Checkout, escrow and deployment are not live. Do not send funds to this prototype.' },
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
  contractAddresses: {
    TimeslotNFT: '',
    TimeslotMarket: '',
  },
  supportedChainIds: [8453],
  defaultChainId: 8453,
  defaultChainHex: '0x2105',
};
