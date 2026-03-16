/* contract.js — ethers.js v6 contract interactions */

// Fill these after deploying contracts to Polygon
const CONTRACT_ADDRESSES = {
  TimeslotNFT: '',     // e.g. '0x...'
  TimeslotMarket: '',  // e.g. '0x...'
};

// ABIs — fill with full ABI arrays after compiling contracts
const TIMESLOT_NFT_ABI = [
  'function mintTimeslot(string ipfsCID, uint256 startTime, uint256 endTime, uint256 hourlyRate) returns (uint256)',
  'function setStatus(uint256 tokenId, string status)',
  'function getTimeslot(uint256 tokenId) view returns (tuple(address creator, string ipfsCID, uint256 startTime, uint256 endTime, uint256 hourlyRate, string status))',
  'function tokenURI(uint256 tokenId) view returns (string)',
  'event TimeslotMinted(uint256 indexed tokenId, address indexed creator, string ipfsCID)',
  'event StatusUpdated(uint256 indexed tokenId, string status)',
];

const TIMESLOT_MARKET_ABI = [
  'function bookTimeslot(uint256 tokenId) payable',
  'function confirmAppointment(uint256 tokenId)',
  'function cancelBooking(uint256 tokenId)',
  'function bookings(uint256 tokenId) view returns (address buyer, uint256 amount, bool confirmed, bool cancelled)',
  'event TimeslotBooked(uint256 indexed tokenId, address indexed buyer, uint256 amount)',
  'event AppointmentConfirmed(uint256 indexed tokenId, address indexed creator, uint256 amount)',
  'event BookingCancelled(uint256 indexed tokenId, address indexed buyer, uint256 amount)',
];

function getNFTContract() {
  if (!window._walletSigner) throw new Error('Wallet not connected');
  if (!CONTRACT_ADDRESSES.TimeslotNFT) throw new Error('TimeslotNFT address not configured');
  return new ethers.Contract(CONTRACT_ADDRESSES.TimeslotNFT, TIMESLOT_NFT_ABI, window._walletSigner);
}

function getMarketContract() {
  if (!window._walletSigner) throw new Error('Wallet not connected');
  if (!CONTRACT_ADDRESSES.TimeslotMarket) throw new Error('TimeslotMarket address not configured');
  return new ethers.Contract(CONTRACT_ADDRESSES.TimeslotMarket, TIMESLOT_MARKET_ABI, window._walletSigner);
}

/**
 * Mint a timeslot NFT on-chain.
 * @param {string} ipfsCID - IPFS CID of the event metadata
 * @param {number} startTimestamp - Unix timestamp (seconds)
 * @param {number} endTimestamp - Unix timestamp (seconds)
 * @param {string} hourlyRateWei - hourly rate in wei (as string)
 * @returns {number} tokenId
 */
async function mintTimeslot(ipfsCID, startTimestamp, endTimestamp, hourlyRateWei) {
  const contract = getNFTContract();
  const tx = await contract.mintTimeslot(ipfsCID, startTimestamp, endTimestamp, hourlyRateWei);
  console.log('Mint tx sent:', tx.hash);
  const receipt = await tx.wait();

  // Find the TimeslotMinted event to get the tokenId
  const event = receipt.logs
    .map((log) => {
      try { return contract.interface.parseLog(log); } catch { return null; }
    })
    .find((e) => e && e.name === 'TimeslotMinted');

  const tokenId = event ? Number(event.args.tokenId) : null;
  console.log('Minted tokenId:', tokenId);
  return tokenId;
}

/**
 * Book a timeslot by sending POL to the market contract (held in escrow).
 * @param {number} tokenId
 * @param {bigint} valueInWei
 */
async function bookTimeslot(tokenId, valueInWei) {
  const contract = getMarketContract();
  const tx = await contract.bookTimeslot(tokenId, { value: valueInWei });
  console.log('Book tx sent:', tx.hash);
  await tx.wait();
  console.log('Timeslot booked, funds in escrow');
}

/**
 * Owner confirms the appointment — releases escrowed funds.
 * @param {number} tokenId
 */
async function confirmAppointment(tokenId) {
  const contract = getMarketContract();
  const tx = await contract.confirmAppointment(tokenId);
  console.log('Confirm tx sent:', tx.hash);
  await tx.wait();
  console.log('Appointment confirmed, funds released');
}

/**
 * Cancel a booking — refunds the buyer.
 * @param {number} tokenId
 */
async function cancelBooking(tokenId) {
  const contract = getMarketContract();
  const tx = await contract.cancelBooking(tokenId);
  console.log('Cancel tx sent:', tx.hash);
  await tx.wait();
  console.log('Booking cancelled, buyer refunded');
}

/**
 * Read a timeslot from the NFT contract.
 * @param {number} tokenId
 * @returns {object} timeslot data
 */
async function getTimeslot(tokenId) {
  const contract = getNFTContract();
  return contract.getTimeslot(tokenId);
}
