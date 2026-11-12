import { SUPPORTER_RELEASE } from './supporter-release.js';

const NFT = '0xe63ec9f8228720baac2fd528c0a6d06b3dc5439b';
const ESCROW = '0x31b07b83e99a9bdf379bf40225b8a80d3804c89d';
const decimal = value => typeof value === 'string' && /^(0|[1-9]\d*)$/.test(value);

export function supporterCheckout(release) {
  try {
    if (!release || release.chainId !== 8453 || release.quantity !== '1000' ||
        release.priceUSDC !== '10000000' || release.nftContract?.toLowerCase() !== NFT ||
        release.escrow?.toLowerCase() !== ESCROW || !decimal(release.tokenId) ||
        !decimal(release.listingId) || !/^0x[0-9a-f]{64}$/i.test(release.mintTxHash || '') ||
        !/^[0-9a-f]{40}$/i.test(release.sourceCommit || '') ||
        !/^v[0-9]+\.[0-9]+\.[0-9]+(?:-[a-z0-9.-]+)?$/i.test(release.tag || '') ||
        !Number.isSafeInteger(release.confirmations) || release.confirmations < 12) return null;
    const url = new URL(release.purchaseUrl);
    if (url.origin !== 'https://thejollylama.github.io' || url.pathname !== '/DecentHead/supporter/buy.html' ||
        url.username || url.password || url.hash) return null;
    const expected = { chainId: '8453', escrow: ESCROW, listingId: release.listingId, priceUSDC: '10000000' };
    if ([...url.searchParams.keys()].some(key => !Object.hasOwn(expected, key))) return null;
    for (const [key, value] of Object.entries(expected)) {
      const values = url.searchParams.getAll(key);
      if (values.length !== 1 || (key === 'escrow' ? values[0].toLowerCase() : values[0]) !== value) return null;
    }
    return url.href;
  } catch { return null; }
}

export function createSupporterCard(document, release = SUPPORTER_RELEASE) {
  const card = document.createElement('section');
  card.id = 'dcal-supporter';
  card.setAttribute('aria-labelledby', 'dcal-supporter-title');
  const heading = document.createElement('h3');
  heading.id = 'dcal-supporter-title';
  heading.textContent = '◈ DecentCalendar Supporter';
  const status = document.createElement('p');
  const checkout = supporterCheckout(release);
  status.textContent = checkout
    ? `${release.tag} · 1,000 editions · 10 USDC each on Base, plus network gas.`
    : 'Unavailable — preparing a versioned Supporter edition. No verified mint or listing is configured; purchases are not available.';
  card.append(heading, status);
  const explanation = document.createElement('p');
  explanation.className = 'quiet';
  explanation.textContent = 'Support ongoing development and collect a dated release artifact. This is not a booking, paid feature unlock, ownership share, or promise of resale value.';
  card.append(explanation);
  if (checkout) {
    for (const [label, href] of [
      ['Open verified listing in DecentHead ↗', checkout],
      ['View public mint receipt ↗', `https://basescan.org/tx/${release.mintTxHash}`],
      ['Release notes ↗', `https://github.com/TheJollyLaMa/DecentCalendar/releases/tag/${encodeURIComponent(release.tag)}`],
    ]) {
      const paragraph = document.createElement('p');
      const link = document.createElement('a');
      link.textContent = label;
      link.href = href;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      paragraph.append(link);
      card.append(paragraph);
    }
    const notice = document.createElement('p');
    notice.className = 'quiet';
    notice.textContent = 'Checkout opens externally and rechecks the live listing and stock. Review the Base account, token and 10 USDC price before approving. Calendar does not connect or sign for this card.';
    card.append(notice);
  }
  return card;
}

export function installSupporterCard(document = globalThis.document) {
  const dialog = document.querySelector('decent-header')?.shadowRoot
    ?.querySelector('about-modal')?.shadowRoot?.querySelector('dialog');
  if (!dialog) throw new Error('DCal About dialog is unavailable');
  if (!dialog.querySelector('#dcal-supporter')) {
    (dialog.querySelector('#about-supporter-slot') || dialog).append(createSupporterCard(document));
  }
}
