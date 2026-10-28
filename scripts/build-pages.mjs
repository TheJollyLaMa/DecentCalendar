import { cp, mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const app = resolve(root, 'decent-calendar-vanilla');
const runtime = [
  'index.html', 'decent.config.js',
  'css/app.css', 'css/calendar.css',
  'assets/usdc.svg', 'assets/SecretPyramid.gif',
  'js/main.js', 'js/head-session.js', 'js/calendar-data.js', 'js/calendar-storage.js',
  'js/contract.js', 'js/events.js', 'js/payments.js', 'js/meetingRoom.js',
  'js/calendar.js', 'js/components/Calendar.js',
  'js/assets.js', 'js/ens-profile.js', 'js/profile-ui.js', 'js/slot-ui.js', 'js/tutorial.js',
  'js/booking-client.js', 'js/booking-ui.js', 'js/timezones.js',
  'vendor/decent-head/2.0.0',
];

export async function buildPages(destination = resolve(root, '_site')) {
  // Fail rather than overwrite an existing directory or publish the repository root.
  await mkdir(destination);
  for (const relative of runtime) {
    const target = resolve(destination, relative);
    await mkdir(dirname(target), { recursive: true });
    await cp(resolve(app, relative), target, { recursive: true, errorOnExist: true, force: false });
  }
  for (const relative of ['LICENSE', 'NOTICE', 'LICENSES/CC-BY-4.0.txt', 'LICENSES/DecentBusking-NOTICE']) {
    const target = resolve(destination, relative);
    await mkdir(dirname(target), { recursive: true });
    await cp(resolve(root, relative), target);
  }
  await writeFile(resolve(destination, '.nojekyll'), '');
  console.log(`Assembled DecentCalendar prototype: ${destination}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await buildPages();
}
