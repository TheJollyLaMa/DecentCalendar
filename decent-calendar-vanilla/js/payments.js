/**
 * payments.js — Payment flows for DecentCalendar vanilla
 * Handles POL (native) and Ommm token payments for booking timeslots.
 */

const OMMM_TOKEN_ADDRESS = window.DECENT_CONFIG?.tokenAddress || '0x1a74f818F1b42dBFcE449c7Fa93B107C6e4A2433';

const ERC20_ABI = [
  'function transfer(address to, uint256 amount) public returns (bool)',
  'function approve(address spender, uint256 amount) public returns (bool)',
  'function balanceOf(address account) public view returns (uint256)',
  'function decimals() public view returns (uint8)',
];

/**
 * Get the ethers provider and signer using MetaMask.
 * @returns {Promise<{provider: ethers.BrowserProvider, signer: ethers.Signer}>}
 */
async function getProviderAndSigner() {
  if (!window.ethereum) throw new Error('MetaMask not detected.');
  const provider = new ethers.BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();
  return { provider, signer };
}

/**
 * Pay for a booked event using POL (native) or Ommm token.
 * @param {string} creatorAddress - Wallet address of the event creator
 * @param {string|number} totalCost - Total cost in POL/Ommm
 * @param {'pol'|'ommm'} paymentType - Payment method
 * @param {string} senderAddress - Wallet address of the payer
 * @returns {Promise<object>} - Transaction receipt
 */
export async function payForBooking(creatorAddress, totalCost, paymentType, senderAddress) {
  if (!window.ethereum) throw new Error('MetaMask not detected.');
  const { signer } = await getProviderAndSigner();

  if (paymentType === 'ommm') {
    return await payWithOmmm(creatorAddress, totalCost, signer);
  } else {
    return await payWithPOL(creatorAddress, totalCost, signer);
  }
}

/**
 * Send POL (native Polygon token) to an address.
 * @param {string} to - Recipient address
 * @param {string|number} amountPOL - Amount in POL
 * @param {ethers.Signer} signer - ethers signer
 * @returns {Promise<object>} - Transaction receipt
 */
async function payWithPOL(to, amountPOL, signer) {
  const value = ethers.parseEther(amountPOL.toString());
  const tx = await signer.sendTransaction({ to, value });
  const receipt = await tx.wait();
  console.log('POL payment sent:', receipt);
  return receipt;
}

/**
 * Send Ommm ERC-20 tokens to an address.
 * @param {string} to - Recipient address
 * @param {string|number} amountOmmm - Amount in Ommm tokens (human-readable)
 * @param {ethers.Signer} signer - ethers signer
 * @returns {Promise<object>} - Transaction receipt
 */
async function payWithOmmm(to, amountOmmm, signer) {
  const tokenAddress = window.DECENT_CONFIG?.tokenAddress || OMMM_TOKEN_ADDRESS;
  const contract = new ethers.Contract(tokenAddress, ERC20_ABI, signer);
  const decimals = await contract.decimals();
  const amount = ethers.parseUnits(amountOmmm.toString(), decimals);
  const tx = await contract.transfer(to, amount);
  const receipt = await tx.wait();
  console.log('Ommm payment sent:', receipt);
  return receipt;
}
