import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, access, rm, readdir } from 'node:fs/promises';
import { join, resolve, dirname } from 'node:path';
import { buildPages } from '../scripts/build-pages.mjs';

test('Pages includes the active app and notices, not repository files or retired runtimes', async () => {
  const temporary = await mkdtemp(new URL('../.pages-test-', import.meta.url));
  const destination = join(temporary, 'site');
  try {
    await buildPages(destination);
    const html = await readFile(join(destination, 'index.html'), 'utf8');
    assert.ok(html.includes('<decent-header>'));
    for (const file of [
      '.nojekyll', 'LICENSE', 'NOTICE', 'LICENSES/CC-BY-4.0.txt',
      'vendor/decent-head/2.0.0/NOTICE', 'vendor/decent-head/2.0.0/js/main.js',
      'vendor/decent-head/2.0.0/js/vendor/ethers.LICENSE.md', 'js/calendar-storage.js',
      'js/booking-client.js', 'js/booking-ui.js',
      'js/supporter.js', 'js/supporter-release.js',
      'css/booking-gift.css', 'js/appointments.js', 'js/appointment-client.js',
      'js/appointment-ui.js', 'js/calendar-layers.js', 'js/calendar-layer-ui.js',
      'js/ui-info.js', 'js/booking-rewards.js', 'js/booking-reward-ui.js', 'js/supporter-art.js',
    ]) await access(join(destination, file));
    for (const file of [
      '.git', '.github', 'tests', 'contracts', 'decent-calendar-react-app', 'package.json',
      'js/components/WalletConnect.js', 'js/helpers/ipfs/w3upClient.js',
      'assets/Ommm_Token_Logo.png', 'assets/DecentSmartHome_Logo.png',
    ]) await assert.rejects(access(join(destination, file)), { code: 'ENOENT' });
    async function checkImports(directory) {
      for (const entry of await readdir(directory, { withFileTypes: true })) {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) {
          await checkImports(path);
        } else if (entry.name.endsWith('.js')) {
          const source = await readFile(path, 'utf8');
          for (const match of source.matchAll(/(?:from\s*|import\s*\(?\s*)['"](\.[^'"]+)['"]/g)) {
            await access(resolve(dirname(path), match[1]));
          }
        }
      }
    }
    await checkImports(destination);
    await assert.rejects(buildPages(destination), { code: 'EEXIST' });
  } finally {
    await rm(temporary, { recursive: true });
  }
});
