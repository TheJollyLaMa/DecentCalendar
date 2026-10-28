import { createProfileResolver, profileImage } from './ens-profile.js';

export function installProfiles(head) {
  let provider, generation = 0;
  const profiles = createProfileResolver(async () => {
    if (!window.DECENT_CONFIG.ens.enabled) throw new Error('ENS lookups are disabled in this session.');
    if (!provider) {
      const { loadEthers } = await import('../vendor/decent-head/2.0.0/js/wallet.js');
      const { FetchRequest, JsonRpcProvider } = await loadEthers();
      const request = new FetchRequest(window.DECENT_CONFIG.ens.rpcUrl);
      request.timeout = 8000;
      provider = new JsonRpcProvider(request, 1, { staticNetwork: true });
    }
    return provider;
  });
  const dialog = document.getElementById('ens-profile-dialog');
  const content = document.getElementById('ens-profile-content');
  const message = document.getElementById('ens-profile-status');
  const backdrop = document.getElementById('calendar-identity');
  dialog.querySelector('[data-close]').onclick = () => dialog.close();
  const clear = () => {
    generation++;
    content.replaceChildren();
    backdrop.replaceChildren();
    dialog.close();
  };
  const render = (container, profile) => {
    container.replaceChildren();
    const note = document.createElement('p');
    note.className = 'quiet';
    note.setAttribute('role', 'status');
    note.textContent = profile.warnings?.join(' ') || '';
    const imageFailed = () => { note.textContent = 'ENS artwork unavailable. The wallet address is unchanged.'; };
    if (profile.banner) container.append(profileImage(profile.banner, 'ens-banner', 'ENS banner', imageFailed));
    const card = document.createElement('div');
    card.className = 'ens-identity';
    if (profile.avatar) card.append(profileImage(profile.avatar, 'ens-avatar', 'ENS avatar', imageFailed));
    const copy = document.createElement('div');
    const name = document.createElement('strong');
    name.textContent = profile.name || `${profile.address.slice(0, 6)}...${profile.address.slice(-4)}`;
    const address = document.createElement('p');
    address.textContent = profile.address;
    copy.append(name, address);
    card.append(copy);
    container.append(card, note);
  };
  const show = async ({ refresh = false } = {}) => {
    if (!dialog.open) dialog.showModal();
    const state = head.getWallet().snapshot();
    const request = ++generation;
    content.replaceChildren();
    if (!state.connected) {
      message.textContent = 'Connect using the wallet orbit when you choose. This profile never requests access or a signature.';
      return;
    }
    message.textContent = 'Looking up verified ENS records on Ethereum mainnet...';
    try {
      const profile = await profiles.lookup(state.address, { refresh });
      if (request !== generation || head.getWallet().snapshot().address !== state.address) return;
      render(content, profile);
      render(backdrop, profile);
      message.textContent = profile.name
        ? `Forward-verified ENS name. ${profile.warnings.join(' ')} Artwork is mutable display data, not booking or payment proof.`
        : 'No forward-verified primary ENS name. Your wallet address remains your identity.';
    } catch (error) {
      if (request !== generation) return;
      console.warn('[DCal ENS]', error);
      render(content, { address: state.address });
      message.textContent = `ENS unavailable: ${error.message}. Your wallet address is unchanged.`;
    }
  };
  document.getElementById('refresh-ens-profile').onclick = () => show({ refresh: true });
  head.on('wallet', state => {
    const address = state.connected ? state.address : null;
    if (backdrop.dataset.address === (address || '')) return;
    clear();
    backdrop.dataset.address = address || '';
    if (address) {
      render(backdrop, { address });
      const request = generation;
      profiles.lookup(address).then(profile => {
        if (request === generation) render(backdrop, profile);
      }, error => {
        if (request === generation) {
          message.textContent = `ENS unavailable: ${error.message}`;
          backdrop.querySelector('[role="status"]').textContent = `ENS unavailable: ${error.message}. Showing wallet address.`;
        }
        console.warn('[DCal ENS]', error);
      });
    }
  });
  const menu = document.querySelector('decent-header').shadowRoot.querySelector('ankh-menu[side="right"]');
  const root = menu.shadowRoot;
  const button = root.querySelector('button');
  button.textContent = 'My ENS profile';
  button.style.cursor = 'pointer';
  button.onclick = () => {
    root.querySelector('details').open = false;
    void show();
  };
  return { profiles, show, render };
}
