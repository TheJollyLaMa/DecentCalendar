/**
 * contract.js — ethers.js contract interactions for DecentCalendar vanilla
 * Interacts with TimeslotNFT and TimeslotMarket contracts on Polygon.
 */

const TIMESLOT_NFT_ABI = [
  'function mint(uint256 startTime, uint256 endTime, uint256 hourlyRate) public payable returns (uint256)',
  'function ownerOf(uint256 tokenId) public view returns (address)',
  'function tokenURI(uint256 tokenId) public view returns (string)',
  'event TimeslotMinted(uint256 indexed tokenId, address indexed owner, uint256 startTime, uint256 endTime)',
];

const TIMESLOT_MARKET_ABI = [
  'function listTimeslot(uint256 tokenId, uint256 price) public',
  'function buyTimeslot(uint256 tokenId) public payable',
  'event TimeslotListed(uint256 indexed tokenId, address indexed seller, uint256 price)',
  'event TimeslotSold(uint256 indexed tokenId, address indexed buyer, uint256 price)',
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
 * Mint a Timeslot NFT on chain.
 * @param {string} start - ISO datetime string for start
 * @param {string} end - ISO datetime string for end
 * @param {number} hourlyRate - Hourly rate in POL
 * @param {string} walletAddress - Connected wallet address
 * @returns {Promise<object>} - Transaction receipt
 */
export async function mintTimeslot(start, end, hourlyRate, walletAddress) {
  const contractAddress = window.DECENT_CONFIG?.contractAddresses?.TimeslotNFT;
  if (!contractAddress) {
    throw new Error('TimeslotNFT contract address not configured. Please update decent.config.js after deployment.');
  }

  const { signer } = await getProviderAndSigner();
  const contract = new ethers.Contract(contractAddress, TIMESLOT_NFT_ABI, signer);

  const startTimestamp = Math.floor(new Date(start).getTime() / 1000);
  const endTimestamp = Math.floor(new Date(end).getTime() / 1000);
  const hourlyRateWei = ethers.parseEther(hourlyRate.toString());

  const tx = await contract.mint(startTimestamp, endTimestamp, hourlyRateWei);
  const receipt = await tx.wait();
  console.log('Timeslot minted:', receipt);
  return receipt;
}

/**
 * List a timeslot NFT on the marketplace.
 * @param {string|number} tokenId - NFT token ID
 * @param {number} price - Price in POL (ETH)
 * @returns {Promise<object>} - Transaction receipt
 */
export async function listTimeslot(tokenId, price) {
  const contractAddress = window.DECENT_CONFIG?.contractAddresses?.TimeslotMarket;
  if (!contractAddress) {
    throw new Error('TimeslotMarket contract address not configured.');
  }

  const { signer } = await getProviderAndSigner();
  const contract = new ethers.Contract(contractAddress, TIMESLOT_MARKET_ABI, signer);
  const priceWei = ethers.parseEther(price.toString());

  const tx = await contract.listTimeslot(tokenId, priceWei);
  const receipt = await tx.wait();
  console.log('Timeslot listed:', receipt);
  return receipt;
}
