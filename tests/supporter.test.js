import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { supporterCheckout, createSupporterCard, installSupporterCard } from '../decent-calendar-vanilla/js/supporter.js';
import { SUPPORTER_RELEASE } from '../decent-calendar-vanilla/js/supporter-release.js';

// Synthetic receipt-shaped fixture; not a published token or a verified chain receipt.
const fixture = {
  chainId: 8453, quantity: '1000', priceUSDC: '10000000',
  nftContract: '0xe63EC9f8228720bAAC2fD528C0A6d06B3Dc5439B',
  escrow: '0x31b07b83e99A9bdF379bf40225b8A80d3804C89d',
  tokenId: '0', listingId: '0', confirmations: 12,
  mintTxHash: `0x${'a'.repeat(64)}`, sourceCommit: 'b'.repeat(40), tag: 'v0.1.0',
  purchaseUrl: 'https://thejollylama.github.io/DecentHead/supporter/buy.html?chainId=8453&escrow=0x31b07b83e99A9bdF379bf40225b8A80d3804C89d&listingId=0&priceUSDC=10000000',
};
class Element {
  constructor(tagName) { this.tagName = tagName; this.children = []; this.textContent = ''; }
  setAttribute(name, value) { this[name] = value; }
  append(...children) { this.children.push(...children); }
}
const document = { createElement: tag => new Element(tag) };
const flatten = element => [element, ...element.children.flatMap(flatten)];

test('absent release retains an explicitly unavailable About card with no purchase controls', () => {
  const nodes = flatten(createSupporterCard(document, null));
  assert.ok(nodes.some(node => node.textContent.includes('Unavailable — preparing')));
  assert.ok(nodes.some(node => node.textContent.includes('No verified mint or listing')));
  assert.ok(nodes.every(node => !['a', 'button', 'img', 'script', 'iframe'].includes(node.tagName)));
});
test('published Calendar config binds token 77 and replacement listing 20 to the unchanged v0.1.0 artifact', () => {
  assert.equal(SUPPORTER_RELEASE.tag, 'v0.1.0');
  assert.equal(SUPPORTER_RELEASE.sourceCommit, '27dbbecffa89ca4091ebef3478ad0b1a6ddd69f8');
  assert.equal(SUPPORTER_RELEASE.tokenId, '77');
  assert.equal(SUPPORTER_RELEASE.listingId, '20');
  assert.equal(SUPPORTER_RELEASE.mintTxHash, '0x5c53d1eacf93e7ec1696e5e0e5b1fccab27d42de59b7ffd91dedcf47f69fe07b');
  assert.equal(supporterCheckout(SUPPORTER_RELEASE), SUPPORTER_RELEASE.purchaseUrl);
  const links = flatten(createSupporterCard(document)).filter(node => node.tagName === 'a');
  assert.equal(links.length, 3);
  assert.equal(links[0].href, SUPPORTER_RELEASE.purchaseUrl);
  assert.equal(links[1].href, `https://basescan.org/tx/${SUPPORTER_RELEASE.mintTxHash}`);
});
test('receipt-shaped config produces only external checkout and public evidence links, preserving ID zero', () => {
  assert.equal(supporterCheckout(fixture), fixture.purchaseUrl);
  const nodes = flatten(createSupporterCard(document, fixture));
  const links = nodes.filter(node => node.tagName === 'a');
  assert.equal(links.length, 3);
  assert.equal(links[0].href, fixture.purchaseUrl);
  assert.ok(links.every(link => link.target === '_blank' && link.rel === 'noopener noreferrer'));
  assert.ok(nodes.every(node => node.tagName !== 'button'));
  assert.ok(nodes.some(node => node.textContent.includes('10 USDC each')));
  assert.ok(nodes.some(node => node.textContent.includes('not a booking')));
});
test('missing, unconfirmed, wrong-network, malformed and changed-price configs fail closed', () => {
  for (const change of [
    { chainId: 1 }, { quantity: '100' }, { priceUSDC: '100000000' }, { confirmations: 11 },
    { confirmations: '12' }, { nftContract: fixture.escrow }, { escrow: fixture.nftContract },
    { tokenId: undefined }, { listingId: '' }, { tokenId: '01' }, { listingId: '-1' },
    { mintTxHash: '' }, { sourceCommit: '' }, { tag: '<script>' },
    { purchaseUrl: 'javascript:alert(1)' }, { purchaseUrl: 'https://other.example/' },
    { purchaseUrl: fixture.purchaseUrl.replace('/DecentHead/', '/DecentHead/other') },
    { purchaseUrl: fixture.purchaseUrl.replace('https:', 'http:') },
    { purchaseUrl: fixture.purchaseUrl.replace('listingId=0', 'listingId=1') },
    { purchaseUrl: fixture.purchaseUrl.replace('priceUSDC=10000000', 'priceUSDC=1') },
    { purchaseUrl: fixture.purchaseUrl.replace('chainId=8453', 'chainId=1') },
    { purchaseUrl: fixture.purchaseUrl + '&listingId=0' },
    { purchaseUrl: fixture.purchaseUrl + '&redirect=https://other.example/' },
    { purchaseUrl: fixture.purchaseUrl + '&toString=payload' },
    { purchaseUrl: fixture.purchaseUrl + '&__proto__=payload' },
    { purchaseUrl: fixture.purchaseUrl + '#payload' },
    { purchaseUrl: fixture.purchaseUrl.replace('https://', 'https://name:password@') },
  ]) {
    const release = { ...fixture, ...change };
    assert.equal(supporterCheckout(release), null, JSON.stringify(change));
    assert.ok(flatten(createSupporterCard(document, release)).every(node => node.tagName !== 'a'));
  }
  assert.equal(supporterCheckout(null), null);
});
test('host adapter adds one card to the existing Head About dialog and reports missing host UI', () => {
  const cards = [];
  const dialog = { querySelector: () => cards[0], append: card => cards.push(card) };
  const root = { ...document, querySelector: () => ({ shadowRoot: { querySelector: () => ({ shadowRoot: { querySelector: () => dialog } }) } }) };
  installSupporterCard(root);
  installSupporterCard(root);
  assert.equal(cards.length, 1);
  assert.equal(cards[0].id, 'dcal-supporter');
  assert.throws(() => installSupporterCard({ querySelector: () => null }), /unavailable/);
});
test('supporter callers use one immutable kit, explicit edition policy and the safe site root', async () => {
  const root = new URL('../', import.meta.url);
  const prepare = await readFile(new URL('.github/workflows/supporter-release.yml', root), 'utf8');
  const announce = await readFile(new URL('.github/workflows/supporter-announce.yml', root), 'utf8');
  for (const source of [prepare, announce]) {
    assert.equal((source.match(/2b87543db1ff5c44c720e5c7f782386bbd702bc1/g) || []).length, 2);
    assert.ok(!source.includes('secrets: inherit'));
  }
  assert.match(prepare, /site_root: decent-calendar-vanilla/);
  assert.match(prepare, /quantity: '1000'/);
  assert.match(prepare, /price_usdc: '10000000'/);
  assert.match(announce, /vars.SUPPORTER_DISCORD_ENABLED == 'true'/);
  const notice = await readFile(new URL('decent-calendar-vanilla/NOTICE', root), 'utf8');
  assert.match(notice, /DecentCalendar/);
  assert.match(notice, /DecentBusking/);
  assert.match(notice, /creativecommons.org\/licenses\/by\/4.0/);
  await readFile(new URL('decent-calendar-vanilla/vendor/decent-head/2.0.0/LICENSE', root));
});
