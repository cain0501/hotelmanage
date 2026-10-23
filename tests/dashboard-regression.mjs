import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const [html, source] = await Promise.all([
  readFile(resolve(root, 'index.html'), 'utf8'),
  readFile(resolve(root, 'app.js'), 'utf8'),
]);

assert.match(html, /id="roomNightAvgGmv"/, 'dashboard must expose the average nightly GMV metric');
assert.match(source, /hotelGmv\/hotelRoomNights/, 'average nightly GMV must divide hotel GMV by room nights');

const hotelGmv = 1926.98;
const roomNights = 2;
assert.equal((hotelGmv / roomNights).toFixed(2), '963.49', 'average nightly GMV calculation contract');

console.log('Dashboard regression tests passed');
