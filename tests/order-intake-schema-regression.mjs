import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const [source, html, migration, schema] = await Promise.all([
  readFile(resolve(root, 'public/app.js'), 'utf8'),
  readFile(resolve(root, 'public/index.html'), 'utf8'),
  readFile(resolve(root, 'supabase/migrations/20261113090000_order_intake_fields_and_attachments.sql'), 'utf8'),
  readFile(resolve(root, 'supabase-schema.sql'), 'utf8'),
]);

for (const id of ['channel', 'platformOrderNo', 'guestNamesDifferent', 'guestNamesLabel', 'guestNames', 'guestCount', 'mealPlan', 'checkOutDate', 'paymentDeadline', 'cancelPolicy', 'freeCancelUntil']) {
  assert.match(html, new RegExp(`id="${id}"`), `order form must expose ${id}`);
}
assert.doesNotMatch(html, /id="upstreamName"/, 'upstream source should no longer be a manual order-form field');
assert.match(source, /guestNamesDifferent.*checked\?byId\('guestNames'\)\.value\.trim\(\):customerName/, 'same customer and guest should reuse the customer field by default');
assert.match(source, /function syncGuestNameFields\(\)/, 'different guest toggle must control the extra guest field');
assert.match(html, /id="nights"[^>]*placeholder="按入住 \/ 离店日期自动计算"/, 'new hotel orders should explain that nights can be auto-calculated');
assert.match(source, /function syncNightsFromDates\(\)/, 'hotel nights should be derived from stay dates when not manually entered');
assert.match(source, /checkOutDate.*syncNightsFromDates/, 'changing the checkout date should recalculate automatic nights');
assert.match(source, /order\.platformOrderNo/, 'keyword search must include platform order number');
assert.match(source, /function filteredOrders\(\)\{[\s\S]*?order\.platformOrderNo[\s\S]*?\}\nfunction dashboardOrders/, 'order ledger filtering must include platform order number');
for (const field of ['channel', 'platform_order_no', 'guest_names', 'guest_count', 'meal_plan', 'check_out_date', 'upstream_name', 'payment_deadline', 'cancel_policy', 'free_cancel_until']) {
  assert.match(source, new RegExp(field), `browser mapping must include ${field}`);
  assert.match(migration, new RegExp(`add column if not exists ${field}`), `migration must add ${field}`);
}
assert.match(migration, /orders_user_platform_order_no_unique_idx/, 'platform order numbers must be unique per user when present');
assert.match(migration, /btrim\(platform_order_no\) <> ''/, 'blank platform order numbers must not participate in uniqueness');
assert.match(migration, /create table if not exists public\.order_attachments/, 'attachment metadata table must exist');
assert.match(migration, /foreign key \(user_id, order_id\) references public\.orders\(user_id, id\) on delete cascade/, 'attachments must belong to an owner order');
assert.match(migration, /values \('order-attachments', 'order-attachments', false\)/, 'attachment bucket must be private');
assert.match(migration, /storage\.foldername\(name\)\)\[1\] = auth\.uid\(\)::text/, 'storage policies must scope paths to the current user');
assert.match(schema, /create unique index if not exists orders_user_platform_order_no_unique_idx/, 'base schema must include the platform order uniqueness index');

console.log('Order intake schema regression tests passed');
