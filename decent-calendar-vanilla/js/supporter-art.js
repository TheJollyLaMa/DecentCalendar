import { safeImageURL } from './ens-profile.js';
import { SUPPORTER_RELEASE } from './supporter-release.js';

export function supporterMarketLink(release = SUPPORTER_RELEASE) {
  if (release.chainId !== 8453 || release.nftContract?.toLowerCase() !== '0xe63ec9f8228720baac2fd528c0a6d06b3dc5439b' ||
      !/^(0|[1-9]\d*)$/.test(release.tokenId || '') || BigInt(release.tokenId) >= 2n ** 256n) {
    throw new Error('Supporter edition is not configured for DecentMarket.');
  }
  const url = new URL('https://thejollylama.github.io/DecentMarket/');
  url.search = new URLSearchParams({
    supporters:'1', chainId:'8453', nftContract:release.nftContract, tokenId:release.tokenId,
  }).toString();
  return url.href;
}

export function supporterAssetURL(uri) {
  const safe = safeImageURL(uri);
  if (!safe) throw new Error('Supporter artwork uses an unsupported URL.');
  return uri.startsWith('ipfs://') ? safe.replace('https://ipfs.io/ipfs/', 'https://gateway.pinata.cloud/ipfs/') : safe;
}

export async function loadSupporterArt({ fetcher = globalThis.fetch, release = SUPPORTER_RELEASE } = {}) {
  const response = await fetcher(supporterAssetURL(release.metadataURI), { signal:AbortSignal.timeout(10000), referrerPolicy:'no-referrer' });
  if (!response.ok) throw new Error(`Supporter metadata HTTP ${response.status}.`);
  const text = await response.text();
  if (text.length > 65536) throw new Error('Supporter metadata exceeds the display limit.');
  const metadata = JSON.parse(text);
  if (!metadata || Array.isArray(metadata) || typeof metadata !== 'object' ||
      typeof metadata.name !== 'string' || !metadata.name.trim()) throw new Error('Supporter metadata is invalid.');
  return { name:metadata.name, image:supporterAssetURL(metadata.image) };
}
