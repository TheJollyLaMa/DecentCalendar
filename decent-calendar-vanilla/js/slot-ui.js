import { ASSETS, getAsset, assetImage, eventAsset, formatAmount, slotQuote } from './assets.js';
import { profileImage } from './ens-profile.js';

export function installSlotUI({ profiles }) {
  const dialog = document.getElementById('slot-details');
  const content = document.getElementById('slot-details-content');
  const message = document.getElementById('slot-details-status');
  let generation = 0;
  const close = () => { generation++; dialog.close(); };
  dialog.querySelector('[data-close]').onclick = close;
  dialog.addEventListener('cancel', () => { generation++; });
  const picker = document.getElementById('event-asset');
  picker.replaceChildren(...ASSETS.map(asset => new Option(`${asset.symbol} - Base`, asset.id)));
  const rateIcon = document.getElementById('event-asset-icon');
  const updateAsset = () => {
    const asset = getAsset(picker.value);
    rateIcon.replaceChildren(assetImage(asset));
    document.getElementById('event-rate').step = asset.decimals === 6 ? '0.000001' : 'any';
  };
  picker.onchange = updateAsset;
  updateAsset();
  const label = (name, value) => {
    const line = document.createElement('p');
    const strong = document.createElement('strong');
    strong.textContent = `${name}: `;
    line.append(strong, document.createTextNode(value));
    content.append(line);
  };
  window.DCalAssets = { eventAsset, assetImage };
  window.openSlotDetails = async event => {
    const request = ++generation;
    content.replaceChildren();
    message.textContent = '';
    document.getElementById('slot-details-title').textContent = event.title;
    const asset = eventAsset(event);
    if (asset) content.append(assetImage(asset));
    label('Time', `${new Date(event.start).toLocaleString()} - ${new Date(event.end).toLocaleString()}`);
    label('Timezone', Intl.DateTimeFormat().resolvedOptions().timeZone);
    label('Description', event.description || 'No description');
    label('Record', event.readOnly ? 'Imported availability - read-only, not a verified booking' : 'Local draft - not a verified booking');
    label('Host wallet', event.creator || event.owner || 'Unavailable');
    if (asset) {
      try {
        const quote = slotQuote(event);
        label('Asset', `${asset.symbol} on Base (8453), ${asset.address || 'native ETH'}, ${asset.decimals} decimals`);
        label('Hourly rate', `${event.rateAmount} ${asset.symbol}`);
        label('Total preview', `${formatAmount(quote.gross, asset.decimals)} ${asset.symbol}`);
        label('Development (3%)', `${formatAmount(quote.fee, asset.decimals)} ${asset.symbol}`);
        label('Host (remainder)', `${formatAmount(quote.host, asset.decimals)} ${asset.symbol}`);
        label('Gas', 'Base network gas is separate; preview requests no transaction.');
      } catch (error) { message.textContent = error.message; }
    } else {
      label('Legacy asset', `${event.currency || 'Unspecified'} - symbol-only record; no token identity or checkout`);
    }
    if (event.buyer) label('Participant wallet (local claim only)', event.buyer);
    label('Hardline preference', event.hardline === true ? 'Fixed scheduled end, with final five-minute warning (meetings not live)' : 'No fixed-end hardline requested');
    if (!event.readOnly && event.isPublic && window.DCalBookings) {
      const publish = document.createElement('button');
      publish.type = 'button';
      publish.textContent = 'Review public on-chain offer';
      publish.onclick = () => { close(); window.DCalBookings.publish(event); };
      content.append(publish);
    }
    label('Launch status', 'Checkout and booking-bound meetings require deployed/reviewed contracts. This preview cannot take payment or grant meeting access.');
    dialog.showModal();
    const identities = document.createElement('section');
    identities.setAttribute('aria-label', 'ENS display identities');
    content.append(identities);
    const addresses = [...new Set([event.creator || event.owner, event.buyer].filter(value => /^0x[0-9a-f]{40}$/i.test(value || '')))];
    for (const address of addresses) {
      const card = document.createElement('div');
      identities.append(card);
      card.textContent = `Looking up ENS for ${address}...`;
      try {
        const profile = await profiles.lookup(address);
        if (request !== generation || !dialog.open) return;
        card.textContent = `${profile.name || address} - ${address === event.buyer ? 'participant (unverified local booking)' : 'host'}`;
        const imageFailed = () => { message.textContent = 'An ENS image could not be loaded. The wallet address is unchanged.'; };
        if (profile.banner) card.prepend(profileImage(profile.banner, 'ens-banner', 'ENS banner', imageFailed));
        if (profile.avatar) card.prepend(profileImage(profile.avatar, 'ens-avatar', 'ENS avatar', imageFailed));
        if (profile.warnings.length) message.textContent = profile.warnings.join(' ');
      } catch (error) {
        if (request !== generation) return;
        card.textContent = `${address} - ENS unavailable: ${error.message}`;
        console.warn('[DCal slot ENS]', error);
      }
    }
  };
  window.renderSlotContent = info => {
    const nodes = [];
    const props = info.event.extendedProps;
    const asset = eventAsset(props);
    if (asset) nodes.push(assetImage(asset));
    const title = document.createElement('span');
    title.textContent = `${info.timeText ? `${info.timeText} ` : ''}${info.event.title}`;
    nodes.push(title);
    const addresses = props.registrySnapshot
      ? [['Host', props.creator], ['Buyer', props.buyer]]
      : [['Host', props.creator || props.owner]];
    for (const [role, address] of addresses) if (/^0x[0-9a-f]{40}$/i.test(address || '')) {
      const identity = document.createElement('span');
      identity.className = 'slot-identity';
      identity.textContent = `${role}: ${address.slice(0, 6)}...`;
      nodes.push(identity);
      profiles.lookup(address).then(profile => {
        identity.textContent = `${role}: ${profile.name || `${address.slice(0, 6)}...`}`;
        if (profile.avatar) identity.prepend(profileImage(profile.avatar, 'slot-avatar', `${role} ENS avatar`));
      }, error => {
        identity.title = `ENS unavailable: ${error.message}`;
        console.warn('[DCal calendar ENS]', error);
      });
    }
    return { domNodes: nodes };
  };
}
