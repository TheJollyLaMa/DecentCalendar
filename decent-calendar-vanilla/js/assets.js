const ethIcon = 'vendor/decent-head/2.0.0/img/Ens_Eth_Breathe.png';
const ethStill = 'vendor/decent-head/2.0.0/img/Ens_Eth_Breathe-still.png';
export const ASSETS = Object.freeze([
  Object.freeze({ id: 'base:eth', chainId: 8453, address: null, symbol: 'ETH', decimals: 18, icon: ethIcon, still: ethStill }),
  Object.freeze({ id: 'base:usdc', chainId: 8453, address: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913', symbol: 'USDC', decimals: 6, icon: 'assets/usdc.svg', still: 'assets/usdc.svg' }),
]);

export function getAsset(id) {
  const asset = ASSETS.find(asset => asset.id === id);
  if (!asset) throw new Error('Unsupported asset. Every supported token needs a Base address, decimals and reviewed icon.');
  return asset;
}

export function eventAsset(event) {
  if (event.assetId) return getAsset(event.assetId);
  // Historical symbol-only records are not token identities or safe checkout instructions.
  return null;
}

export function parseAmount(value, decimals) {
  if (typeof value !== 'string' || !/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value) || value.length > 100) {
    throw new Error('Enter a non-negative decimal amount, without exponent notation.');
  }
  const [whole, fraction = ''] = value.split('.');
  if (fraction.length > decimals) throw new Error(`This asset supports at most ${decimals} decimal places.`);
  const amount = BigInt(whole) * 10n ** BigInt(decimals) + BigInt(fraction.padEnd(decimals, '0') || '0');
  if (amount >= 2n ** 256n) throw new Error('Amount exceeds uint256.');
  return amount;
}

export function formatAmount(amount, decimals) {
  const units = BigInt(amount);
  if (units < 0n) throw new Error('Negative amount.');
  const scale = 10n ** BigInt(decimals);
  const fraction = (units % scale).toString().padStart(decimals, '0').replace(/0+$/, '');
  return `${units / scale}${fraction ? `.${fraction}` : ''}`;
}

export function slotQuote(event) {
  const asset = eventAsset(event);
  if (!asset || typeof event.rateAmount !== 'string') throw new Error('Legacy or unsupported currency. Re-create this draft with an identified Base asset before checkout.');
  const rate = parseAmount(event.rateAmount, asset.decimals);
  const milliseconds = Date.parse(event.end) - Date.parse(event.start);
  if (!Number.isSafeInteger(milliseconds) || milliseconds <= 0 || milliseconds % 1000) throw new Error('Slot must have a positive whole-second duration.');
  // Round the gross up to the nearest base unit; round the fee down.
  const gross = (rate * BigInt(milliseconds / 1000) + 3599n) / 3600n;
  if (gross >= 2n ** 256n) throw new Error('Slot amount exceeds uint256.');
  const fee = gross * 300n / 10000n;
  return { asset, gross, fee, host: gross - fee };
}

export function assetImage(asset) {
  const picture = document.createElement('picture');
  const source = document.createElement('source');
  source.media = '(prefers-reduced-motion: reduce)';
  source.srcset = asset.still;
  const image = document.createElement('img');
  image.src = asset.icon;
  image.alt = asset.symbol;
  image.className = 'asset-icon';
  picture.append(source, image);
  return picture;
}
