import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { informationPanel } from '../decent-calendar-vanilla/js/ui-info.js';

const source = name => readFile(new URL(`../decent-calendar-vanilla/${name}`, import.meta.url), 'utf8');
test('small information panels are labelled, native collapsed disclosures with text-safe content', () => {
  const original = globalThis.document;
  globalThis.document = { createElement: tag => ({
    tag, children: [], attributes: {}, dataset: {},
    append(...children) { this.children.push(...children); },
    setAttribute(name, value) { this.attributes[name] = value; },
  }) };
  try {
    const panel = informationPanel('Public wallets and read limits', ['<untrusted name>', 'Private calendars are unknown.']);
    assert.equal(panel.tag, 'details');
    assert.equal(panel.open, undefined);
    assert.equal(panel.children[0].tag, 'summary');
    assert.equal(panel.children[0].textContent, 'i');
    assert.equal(panel.children[0].attributes['aria-label'], 'Public wallets and read limits');
    assert.equal(panel.children[0].title, 'Public wallets and read limits');
    assert.equal(panel.children[1].textContent, '<untrusted name>');
  } finally { globalThis.document = original; }
});

test('empty shell collapses explanations, publishing, recovery and transaction history, not consent/status', async () => {
  const html = await source('index.html');
  assert.match(html, /<details id="appointment-publish" hidden>/);
  assert.match(html, /<details id="appointment-recovery" class="ui-info">/);
  assert.match(html, /<details id="appointment-transaction-history" class="ui-info" hidden>/);
  assert.match(html, /id="recover-appointment-tx"[^>]*hidden/);
  assert.match(html, /id="refresh-calendar-layers"[^>]*hidden/);
  assert.match(html, /class="layer-consent"[^]*?name="consent" required/);
  assert.match(html, /id="appointment-status" role="status" aria-live="polite"/);
  assert.match(html, /id="calendar-layer-status" role="status" aria-live="polite"/);
  assert.match(html, /publishing these windows, wallets and subject permanently on Base/);
});

test('guest offer screen excludes host publishing, unrelated lists and irrelevant appointment actions', async () => {
  const js = await source('js/appointment-ui.js');
  assert.match(js, /publishPanel.hidden = viewingRecord \|\| !writes\(\)/);
  assert.match(js, /viewingRecord = true; records.replaceChildren\(\); detail.replaceChildren\(\); applicableControls\(\)/);
  assert.match(js, /if \(!item.cancelled && item.end > item.now\) \{\s+button\(row, 'Add to iPhone \/ Android'/);
  assert.match(js, /item.start > item.now && \[item.host, item.invitee\]/);
  assert.match(js, /transactionHistory.hidden = false/);
  assert.match(js, /client.pending\(getSession\(\).address\)/);
  assert.match(js, /Host: \$\{offer.host\}\\nInvited wallet: \$\{offer.invitee\}\\nSigning wallet/);
  assert.match(js, /your wallet pays Base gas/);
  assert.match(js, /dates and subject permanently/);
  assert.match(js, /if \(!canBook\) \{\s+const time = element\('p', choiceTime\)/);
  assert.ok(js.indexOf('const reviewedPolicy =') < js.indexOf('const resolved ='));
  assert.match(js, /Subject: \$\{offer.subject\}/);
  assert.match(js, /Offered dates: \$\{offeredDates\}/);
});
