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

for (const id of ['channel', 'platformOrderNo', 'guestNames', 'guestCount', 'mealPlan', 'checkOutDate', 'upstreamName', 'paymentDeadline', 'cancelPolicy', 'freeCancelUntil']) {
  assert.match(html, new RegExp(`id="${id}"`), `order form must expose ${id}`);
}
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
