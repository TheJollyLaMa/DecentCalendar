export function safeImageURL(value) {
  if (typeof value !== 'string' || value.length > 2000) return '';
  if (/^ipfs:\/\/[a-zA-Z0-9]+(?:\/[^\s]*)?$/.test(value)) value = `https://ipfs.io/ipfs/${value.slice(7)}`;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password) return '';
    return url.href;
  } catch { return ''; }
}

export async function resolveProfile(address, provider) {
  if (!/^0x[0-9a-f]{40}$/i.test(address)) throw new Error('Enter a wallet address or ENS name.');
  const name = await provider.lookupAddress(address);
  if (!name || (await provider.resolveName(name))?.toLowerCase() !== address.toLowerCase()) {
    return { address, name: null, avatar: '', banner: '', status: 'no-verified-name', warnings: [] };
  }
  const resolver = await provider.getResolver(name);
  if (!resolver) return { address, name, avatar: '', banner: '', status: 'verified', warnings: ['ENS resolver has no image records.'] };
  const records = await Promise.allSettled([resolver.getAvatar(), resolver.getText('banner'), resolver.getText('header')]);
  const warnings = records.filter(record => record.status === 'rejected').map(() => 'An ENS image record could not be read.');
  const values = records.map(record => record.status === 'fulfilled' ? record.value : '');
  const avatarRecord = typeof values[0] === 'string' ? values[0] : values[0]?.url;
  const bannerRecord = values[1] || values[2];
  const avatar = safeImageURL(avatarRecord), banner = safeImageURL(bannerRecord);
  if ((avatarRecord && !avatar) || (bannerRecord && !banner)) warnings.push('An ENS image uses an unsupported URL and was not loaded.');
  return { address, name, avatar, banner, status: 'verified', warnings };
}

export function createProfileResolver(getProvider, { now = Date.now, ttl = 300000 } = {}) {
  const cache = new Map();
  return {
    async lookup(address, { refresh = false } = {}) {
      const key = address.toLowerCase(), existing = cache.get(key);
      if (!refresh && existing && existing.expires > now()) return existing.value;
      const value = Promise.resolve().then(getProvider).then(provider => resolveProfile(address, provider));
      const entry = { expires: now() + ttl, value };
      cache.set(key, entry);
      try { return await value; }
      catch (error) { if (cache.get(key) === entry) cache.delete(key); throw error; }
    },
    async address(value) {
      const input = value.trim();
      if (/^0x[0-9a-f]{40}$/i.test(input)) return input;
      if (!input.includes('.') || input.length > 255) throw new Error('Enter a wallet address or ENS name.');
      const resolved = await (await getProvider()).resolveName(input);
      if (!resolved) throw new Error('ENS name does not resolve to a wallet address.');
      return resolved;
    },
  };
}

export function profileImage(url, className, label, onFailure = () => {}) {
  const image = document.createElement('img');
  image.src = url;
  image.alt = label;
  image.className = className;
  image.referrerPolicy = 'no-referrer';
  image.loading = 'lazy';
  image.addEventListener('error', () => { image.remove(); onFailure(); }, { once: true });
  return image;
}
