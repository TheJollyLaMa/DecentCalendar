import test from 'node:test';
import assert from 'node:assert/strict';
import { createAbout, safeLink } from '../decent-calendar-vanilla/js/about.js';
import { SUPPORTER_RELEASE } from '../decent-calendar-vanilla/js/supporter-release.js';

globalThis.window = {};
await import('../decent-calendar-vanilla/decent.config.js');
const config = window.DECENT_CONFIG;

class Element {
  constructor(tagName) { this.tagName = tagName; this.children = []; this.attributes = {}; this.textContent = ''; this.listeners = {}; }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children = children; }
  addEventListener(type, fn) { this.listeners[type] = fn; }
}
const document = { createElement: tag => new Element(tag), createElementNS: (_, tag) => new Element(tag) };
const flatten = node => [node, ...node.children.flatMap(flatten)];

test('About is a symbol-led walkthrough with no dropdowns', () => {
  const nodes = flatten(createAbout(document, config, { onTutorial() {} }));
  assert.ok(nodes.every(node => !['details', 'summary', 'select'].includes(node.tagName)));
  assert.ok(nodes.some(node => node.tagName === 'svg' && node.attributes.class === 'time-wheels'));
  const steps = nodes.filter(node => node.attributes.class === 'trail-glyph');
  assert.equal(steps.length, 5);
  assert.ok(steps.every(step => step.textContent.trim()));
  assert.ok(nodes.some(node => node.attributes.id === 'about-supporter-slot'));
  assert.ok(nodes.some(node => node.attributes.class === 'about-rabbit'));
  assert.ok(nodes.some(node => /unaudited/.test(node.textContent)));
});

test('link tiles are https, open safely and include related dapps', () => {
  const anchors = flatten(createAbout(document, config)).filter(node => node.tagName === 'a');
  const hrefs = anchors.map(a => a.attributes.href);
  for (const a of anchors) {
    assert.match(a.attributes.href, /^https:\/\//);
    assert.equal(a.attributes.rel, 'noopener noreferrer');
  }
  for (const expected of ['DecentBusking', 'BigNuten_Vanilla', 'github.com/TheJollyLaMa/DecentCalendar', 'decentcalendar.decentagency.eth']) {
    assert.ok(hrefs.some(href => href.includes(expected)), expected);
  }
  const unsafe = createAbout(document, { about: {}, links: [{ label: 'x', url: 'javascript:alert(1)' }, { label: 'y', url: 'http://example.test' }] });
  assert.equal(flatten(unsafe).filter(node => node.tagName === 'a').length, 0);
  assert.equal(safeLink('https://user:pw@example.test'), null);
});

test('Supporter art loads only on request and only for a verified release', async () => {
  let calls = 0;
  const loadArt = async () => { calls++; return { name: 'DCal Supporter', image: 'https://example.test/art.png' }; };
  const figure = flatten(createAbout(document, config, { loadArt })).find(node => node.tagName === 'figure');
  assert.equal(calls, 0);
  figure.loadArt();
  figure.loadArt();
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(calls, 1);
  const img = figure.children.find(node => node.tagName === 'img');
  assert.ok(!img, 'image replaces glyph only after it loads');
  const pending = flatten(createAbout(document, config, { release: { ...SUPPORTER_RELEASE, chainId: 1 }, loadArt })).find(node => node.tagName === 'figure');
  pending.loadArt();
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(calls, 1);
});
