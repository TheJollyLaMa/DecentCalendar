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
    summary: 'Public office hours for a scattered, decentralized world: offer your time, see each other\'s clocks, and settle the value exchanged on Base.',
    trail: [
      { symbol: '◷', title: 'Time has value', body: 'Knowledge, wisdom, presence and care are worth acknowledging. DCal lets people agree on that value before they meet.' },
      { symbol: '⌂', title: 'Your office door, not your whole life', body: 'Private plans stay on your device. You choose which windows become public office hours.' },
      { symbol: '◎', title: 'Every clock, side by side', body: 'Web3 lives across time zones and seasons. Each slot shows your local time and the time you are asking of the other person.' },
      { symbol: '✉', title: 'Invite, then commit', body: 'Send a public Base invitation to an ENS name or wallet. Invitations ask; only a funded seat commits.' },
      { symbol: '⛁', title: 'Meet, then settle', body: 'ETH or USDC waits in escrow, split or per head. After the meeting, attendees release payment: 97% to the host, 3% to development.' },
    ],
    note: '⚠ Small-value beta: contracts are unaudited and video meetings are not live yet. Keep stakes tiny and public IPFS content may last forever.',
    noteUrl: 'https://github.com/TheJollyLaMa/DecentCalendar#remaining-release-gates',
  },
  links: [
    { symbol: '◬', label: 'Calendar ENS site', url: 'https://decentcalendar.decentagency.eth.limo' },
    { symbol: '⟡', label: 'Source code', url: 'https://github.com/TheJollyLaMa/DecentCalendar' },
    { symbol: '☷', label: 'Public roadmap', url: 'https://github.com/A-Decent-Agency/a-decent-agency.github.io/issues/15' },
    { symbol: '⛓', label: 'Escrow on Basescan', url: 'https://basescan.org/address/0x56844e14d2e29fb8d9Df04B1F19fB9d732C5063A' },
  ],
  relatedDapps: [
    { symbol: '♫', label: 'DecentBusking', url: 'https://thejollylama.github.io/DecentBusking/' },
    { symbol: '✺', label: 'BigNuten', url: 'https://thejollylama.github.io/BigNuten_Vanilla/' },
    { symbol: '❦', label: 'DecentCanopy', url: 'https://thejollylama.github.io/DecentCanopy/' },
    { symbol: '⌘', label: 'Planning Office', url: 'https://a-decent-agency.github.io/?site=PVTI_lADODD7ovc4Bn91hzhELHuo' },
  ],
  tokenAddress: '',
  appointments: { address: '0xa61869FD9C4376fF1DA9E7dF48b5Ba746d4bD048', runtimeCodeHash: '0xe55c66a2ec61774dd202696072c6c35b5ad0395eca6238fac6cdfd47b9dedc5c', writesEnabled: true },
  bookingRewards: { enabled: true, address: '0xB079B367efA71Aa4C9358d4A46d72Dfd0AF4bc44', runtimeCodeHash: '0x395859ef212844192c2a6832c392fa7f980a6b9726feecfeb95978f0ea4b9254', registry: '0xa61869FD9C4376fF1DA9E7dF48b5Ba746d4bD048', nft: '0xe63EC9f8228720bAAC2fD528C0A6d06B3Dc5439B', tokenId: '77' },
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
