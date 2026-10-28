export default {
  chainDescriptors: {
    8453: { name: 'Base', chainType: 'op', hardforkHistory: { isthmus: { timestamp: 1746806401 } } },
  },
  networks: {
    local: { type: 'edr-simulated', chainType: 'l1', chainId: 8453 },
    baseFork: {
      type: 'edr-simulated', chainType: 'op', chainId: 8453, hardfork: 'isthmus',
      forking: { url: process.env.DCAL_BASE_RPC || 'https://base-rpc.publicnode.com' },
    },
  },
};
