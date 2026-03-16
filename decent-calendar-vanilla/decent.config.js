/* decent.config.js — Application configuration for DecentCalendar
   Fill in contract addresses after deploying to Optimism. */

const DECENT_CONFIG = {
  // OMMM token address on Optimism (fill after deployment)
  tokenAddress: '',

  // Contract addresses — fill after deploying contracts to Optimism
  contractAddresses: {
    TimeslotNFT: '',    // e.g. '0xAbCd...'
    TimeslotMarket: '', // e.g. '0xAbCd...'
  },

  // Supported chain IDs: Optimism mainnet, Optimism Goerli, Optimism Sepolia
  supportedChainIds: [10, 420, 11155420],
  defaultChainId: 10,
  defaultChainHex: '0xa', // Optimism mainnet

  // IPFS gateway for fetching CIDs
  ipfsGateway: 'https://w3s.link/ipfs/',
};
