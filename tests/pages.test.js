import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, access, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildPages } from '../scripts/build-pages.mjs';

test('Pages includes the active app and notices, not repository files or retired runtimes', async () => {
  const temporary = await mkdtemp(join(tmpdir(), 'dcal-pages-test-'));
  const destination = join(temporary, 'site');
  try {
    await buildPages(destination);
    const html = await readFile(join(destination, 'index.html'), 'utf8');
    assert.ok(html.includes('<decent-header>'));
    for (const file of [
      '.nojekyll', 'LICENSE', 'NOTICE', 'LICENSES/CC-BY-4.0.txt',
      'vendor/decent-head/2.0.0/NOTICE', 'vendor/decent-head/2.0.0/js/main.js',
      'vendor/decent-head/2.0.0/js/vendor/ethers.LICENSE.md', 'js/calendar-storage.js',
    ]) await access(join(destination, file));
    for (const file of [
      '.git', '.github', 'tests', 'contracts', 'decent-calendar-react-app', 'package.json',
      'js/components/WalletConnect.js', 'js/helpers/ipfs/w3upClient.js',
    ]) await assert.rejects(access(join(destination, file)), { code: 'ENOENT' });
    await assert.rejects(buildPages(destination), { code: 'EEXIST' });
  } finally {
    await rm(temporary, { recursive: true });
  }
});
