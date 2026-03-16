/* decent.config.js — Application configuration for DecentCalendar
   Fill in contract addresses after deploying to Polygon. */

const DECENT_CONFIG = {
  // OMMM token address on Polygon (fill after deployment)
  tokenAddress: '',

  // Contract addresses — fill after deploying contracts to Polygon
  contractAddresses: {
    TimeslotNFT: '',    // e.g. '0xAbCd...'
    TimeslotMarket: '', // e.g. '0xAbCd...'
  },

  // Supported chain IDs: Polygon mainnet, Mumbai testnet, Amoy testnet
  supportedChainIds: [137, 80001, 80002],
  defaultChainId: 137,
  defaultChainHex: '0x89', // Polygon mainnet

  // IPFS
  ipfsGateway: 'https://gateway.pinata.cloud/ipfs/',
};
