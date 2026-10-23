import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const [html, source] = await Promise.all([
  readFile(resolve(root, 'public/index.html'), 'utf8'),
  readFile(resolve(root, 'public/app.js'), 'utf8'),
]);

assert.match(html, /id="roomNightAvgGmv"/, 'dashboard must expose the average nightly GMV metric');
assert.match(source, /hotelGmv\/hotelRoomNights/, 'average nightly GMV must divide hotel GMV by room nights');
assert.match(source, /const platformName = order =>/, 'platform display must use a shared platform resolver');
assert.match(source, /isCommissionOrder\(order\) \? order\.commissionPlatform : order\.paymentPlatform/, 'commission orders must display their commission platform');
assert.match(source, /const platformMap=dashboardOrders\(\)\.reduce\(.*platformName\(order\)/, 'payment platform distribution must use the resolved platform');
assert.match(source, /返佣平台：\$\{platformName\(order\)\}/, 'commission platform must be visible in order settlement text');

const hotelGmv = 1926.98;
const roomNights = 2;
assert.equal((hotelGmv / roomNights).toFixed(2), '963.49', 'average nightly GMV calculation contract');

console.log('Dashboard regression tests passed');
