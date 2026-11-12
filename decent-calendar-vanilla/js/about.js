import { SUPPORTER_RELEASE } from './supporter-release.js';
import { supporterCheckout } from './supporter.js';
import { loadSupporterArt } from './supporter-art.js';

const SVG = 'http://www.w3.org/2000/svg';

export const ABOUT_STYLES = `
  dialog { width:min(720px,calc(100vw - 24px)); }
  .about-hero { display:grid; justify-items:center; gap:10px; margin:6px 0 34px; text-align:center; }
  .time-wheels { width:min(220px,58vw); height:auto; overflow:visible; }
  .time-wheels circle { fill:none; }
  .wheel { transform-box:view-box; transform-origin:50% 50%; }
  .wheel-a { animation:spin 60s linear infinite; }
  .wheel-b { animation:spin 36s linear infinite reverse; }
  .wheel-c { animation:spin 24s linear infinite; }
  .wheel-a circle { stroke:#00ffff; } .wheel-b circle { stroke:#bd7cff; } .wheel-c circle { stroke:#80edd2; }
  .wheel .ring { stroke-width:1.2; stroke-dasharray:2 7; opacity:.75; }
  .wheel .bead { stroke:none; }
  .wheel-a .bead { fill:#00ffff; filter:drop-shadow(0 0 5px #00ffff); }
  .wheel-b .bead { fill:#bd7cff; filter:drop-shadow(0 0 5px #bd7cff); }
  .wheel-c .bead { fill:#80edd2; filter:drop-shadow(0 0 5px #80edd2); }
  .hub { font-size:30px; fill:#eef8ff; text-anchor:middle; dominant-baseline:central; }
  .hub-glow { fill:#00ffff22; stroke:#00ffff; stroke-width:1; animation:breathe 4s ease-in-out infinite; transform-box:fill-box; transform-origin:center; }
  .about-tagline { margin:0; font-size:1.15rem; letter-spacing:.04em; color:#00ffff; text-shadow:0 0 12px #00ffff88; }
  .about-summary { margin:0; max-width:46ch; opacity:.85; }
  .about-kicker { margin:0 0 18px; text-align:center; font-size:.78rem; letter-spacing:.3em; text-transform:uppercase; color:#bd7cff; }
  .about-trail { position:relative; display:grid; gap:26px; margin:0 0 40px; padding:0; list-style:none; }
  .about-trail::before { content:''; position:absolute; top:24px; bottom:24px; left:23px; width:2px;
    background:linear-gradient(#00ffff,#bd7cff,#80edd2); box-shadow:0 0 10px #00ffff88; }
  .about-trail li { position:relative; display:grid; grid-template-columns:48px 1fr; gap:16px; align-items:center;
    opacity:0; animation:arrive .7s ease forwards; animation-delay:calc(var(--i) * 140ms); }
  .trail-glyph { display:grid; place-items:center; width:48px; height:48px; border-radius:50%; font-size:22px;
    background:#080e1a; border:1px solid #00ffff; box-shadow:0 0 14px #00ffff55, inset 0 0 10px #bd7cff44; }
  .trail-step h3 { margin:0 0 2px; font-size:1rem; color:#eef8ff; }
  .trail-step p { margin:0; opacity:.78; }
  .about-supporter { display:grid; grid-template-columns:minmax(0,170px) 1fr; gap:22px; align-items:center;
    margin:0 0 40px; padding:22px; border-radius:20px; border:1px solid #bd7cff88;
    background:radial-gradient(circle at 20% 30%,#bd7cff22,transparent 60%),#0b1322; }
  .supporter-art { margin:0; display:grid; place-items:center; aspect-ratio:1; border-radius:16px; overflow:hidden;
    background:#131b30; box-shadow:0 0 22px #bd7cff55; font-size:56px; color:#bd7cff; }
  .supporter-art img { width:100%; height:100%; object-fit:contain; animation:float 6s ease-in-out infinite; }
  .supporter-art figcaption { position:absolute; width:1px; height:1px; overflow:hidden; clip:rect(0 0 0 0); }
  .about-supporter #dcal-supporter { margin:0; padding:0; border:0; background:none; box-shadow:none; }
  .about-supporter #dcal-supporter h3 { margin:0 0 6px; color:#bd7cff; }
  .about-supporter #dcal-supporter p { margin:0 0 8px; }
  .about-links { display:grid; grid-template-columns:repeat(auto-fit,minmax(112px,1fr)); gap:12px; margin:0 0 30px; padding:0; list-style:none; }
  .about-links a, .about-links button { box-sizing:border-box; display:grid; justify-items:center; gap:6px; width:100%; height:100%; padding:16px 10px;
    border-radius:16px; border:1px solid #00ffff44; background:#0b1322; color:#eef8ff; text-align:center;
    text-decoration:none; font-size:.85rem; cursor:pointer; transition:transform .2s, box-shadow .2s, border-color .2s; }
  .about-links a:hover, .about-links a:focus-visible, .about-links button:hover, .about-links button:focus-visible {
    transform:translateY(-3px); border-color:#00ffff; box-shadow:0 0 16px #00ffff55; outline:none; }
  .link-glyph { font-size:26px; line-height:1; }
  .about-note { margin:0 0 12px; text-align:center; font-size:.8rem; opacity:.7; }
  .about-note a { color:#80edd2; }
  .about-footer { margin:0; text-align:center; font-size:.85rem; color:#80edd2; }
  @keyframes spin { to { transform:rotate(360deg); } }
  @keyframes breathe { 50% { transform:scale(1.08); opacity:.7; } }
  @keyframes arrive { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:none; } }
  @keyframes float { 50% { transform:translateY(-6px); } }
  @media (max-width:520px) { .about-supporter { grid-template-columns:1fr; justify-items:center; text-align:center; } .supporter-art { width:160px; } }
  @media (prefers-reduced-motion:reduce) {
    .wheel, .hub-glow, .supporter-art img { animation:none; }
    .about-trail li { animation:none; opacity:1; }
  }
`;

function el(document, tag, attrs = {}, text) {
  const node = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, value);
  if (text !== undefined) node.textContent = text;
  return node;
}

function svg(document, tag, attrs = {}) {
  const node = document.createElementNS(SVG, tag);
  for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, String(value));
  return node;
}

export function safeLink(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && !parsed.username && !parsed.password ? parsed.href : null;
  } catch { return null; }
}

function timeWheels(document) {
  const root = svg(document, 'svg', { class: 'time-wheels', viewBox: '0 0 200 200', role: 'img', 'aria-label': 'Three time wheels turning at different speeds' });
  for (const [name, radius, bead] of [['a', 92, 0], ['b', 68, 120], ['c', 44, 240]]) {
    const group = svg(document, 'g', { class: `wheel wheel-${name}` });
    group.append(svg(document, 'circle', { class: 'ring', cx: 100, cy: 100, r: radius }));
    const angle = bead * Math.PI / 180;
    group.append(svg(document, 'circle', { class: 'bead', cx: 100 + radius * Math.cos(angle), cy: 100 + radius * Math.sin(angle), r: 5 }));
    root.append(group);
  }
  root.append(svg(document, 'circle', { class: 'hub-glow', cx: 100, cy: 100, r: 24 }));
  const hub = svg(document, 'text', { class: 'hub', x: 100, y: 100, 'aria-hidden': 'true' });
  hub.textContent = '◷';
  root.append(hub);
  return root;
}

// The glyph stays if metadata or the image cannot load; artwork is decoration, not proof.
function supporterArt(document, loadArt) {
  const figure = el(document, 'figure', { class: 'supporter-art' });
  figure.append(el(document, 'span', { 'aria-hidden': 'true' }, '◈'));
  let started = false;
  figure.loadArt = () => {
    if (started || !loadArt) return;
    started = true;
    Promise.resolve().then(loadArt).then(({ name, image }) => {
      const img = el(document, 'img', { src: image, alt: name, referrerpolicy: 'no-referrer' });
      img.addEventListener('load', () => figure.replaceChildren(img, el(document, 'figcaption', {}, name)));
    }).catch(() => {});
  };
  return figure;
}

/** Builds the DCal About body: hero, theory trail, Supporter showcase, link tiles. */
export function createAbout(document, config, { release = SUPPORTER_RELEASE, loadArt, onTutorial } = {}) {
  const about = config.about || {};
  const body = el(document, 'div', { class: 'about-body' });

  const hero = el(document, 'header', { class: 'about-hero' });
  hero.append(timeWheels(document), el(document, 'p', { class: 'about-tagline' }, config.subtitle || ''),
    el(document, 'p', { class: 'about-summary' }, about.summary || ''));
  body.append(hero);

  if (about.trail?.length) {
    body.append(el(document, 'p', { class: 'about-kicker' }, 'The idea, in five turns'));
    const trail = el(document, 'ol', { class: 'about-trail' });
    about.trail.forEach((step, index) => {
      const item = el(document, 'li', { style: `--i:${index}` });
      const text = el(document, 'div', { class: 'trail-step' });
      text.append(el(document, 'h3', {}, step.title), el(document, 'p', {}, step.body));
      item.append(el(document, 'span', { class: 'trail-glyph', 'aria-hidden': 'true' }, step.symbol || '✦'), text);
      trail.append(item);
    });
    body.append(trail);
  }

  body.append(el(document, 'p', { class: 'about-kicker' }, 'Support the work'));
  const supporter = el(document, 'section', { class: 'about-supporter', id: 'about-supporter-slot' });
  supporter.append(supporterArt(document, release && supporterCheckout(release) ? loadArt : null));
  body.append(supporter);

  const tileGroup = (label, links, rabbit) => {
    const tiles = el(document, 'ul', { class: 'about-links', 'aria-label': label });
    if (rabbit) {
      const button = el(document, 'button', { type: 'button', class: 'about-rabbit' });
      button.append(el(document, 'span', { class: 'link-glyph', 'aria-hidden': 'true' }, '🐇'), el(document, 'span', {}, 'Follow the white rabbit'));
      button.addEventListener('click', rabbit);
      const item = el(document, 'li');
      item.append(button);
      tiles.append(item);
    }
    for (const link of links || []) {
      const href = safeLink(link.url);
      if (!href) continue;
      const anchor = el(document, 'a', { href, target: '_blank', rel: 'noopener noreferrer' });
      anchor.append(el(document, 'span', { class: 'link-glyph', 'aria-hidden': 'true' }, link.symbol || '↗'), el(document, 'span', {}, link.label));
      const item = el(document, 'li');
      item.append(anchor);
      tiles.append(item);
    }
    if (tiles.children.length) body.append(el(document, 'p', { class: 'about-kicker' }, label), tiles);
  };
  tileGroup('This project', config.links, onTutorial);
  tileGroup('Sister dapps', config.relatedDapps);

  if (about.note) {
    const note = el(document, 'p', { class: 'about-note' }, `${about.note} `);
    const href = safeLink(about.noteUrl);
    if (href) note.append(el(document, 'a', { href, target: '_blank', rel: 'noopener noreferrer' }, 'Safety details ↗'));
    body.append(note);
  }
  body.append(el(document, 'p', { class: 'about-footer' }, 'Your wallet. Your data. Always your choice.'));
  return body;
}

export function installAbout(document = globalThis.document, config = globalThis.window?.DECENT_CONFIG) {
  const dialog = document.querySelector('decent-header')?.shadowRoot
    ?.querySelector('about-modal')?.shadowRoot?.querySelector('dialog');
  if (!dialog) throw new Error('DCal About dialog is unavailable');
  if (dialog.querySelector('.about-body')) return dialog;
  const heading = dialog.querySelector('.modal-heading');
  dialog.replaceChildren(...(heading ? [heading] : []));
  dialog.append(el(document, 'style', {}, ABOUT_STYLES));
  const onTutorial = () => {
    dialog.close();
    document.getElementById('rabbit-tour-launch')?.click();
  };
  dialog.append(createAbout(document, config, { loadArt: () => loadSupporterArt(), onTutorial }));
  const figure = dialog.querySelector('.supporter-art');
  const observer = new MutationObserver(() => {
    if (!dialog.open) return;
    figure?.loadArt();
    observer.disconnect();
  });
  observer.observe(dialog, { attributes: true, attributeFilter: ['open'] });
  return dialog;
}
