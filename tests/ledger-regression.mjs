import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = await readFile(resolve(root, 'public/app.js'), 'utf8');
const migration = await readFile(resolve(root, 'supabase/migrations/20261026120000_order_save_ledger_idempotency.sql'), 'utf8');

assert.match(source, /saveLedgerTransaction = async \(\{ orderId, kind, amount, date, note, source='manual', mutationKey='' \}\)/, 'ledger writes must accept a retry-safe mutation key');
assert.match(source, /transaction_key: mutationKey \|\| null/, 'manual save ledger rows must persist the mutation key');
assert.match(source, /if \(source === 'import' && error\.code === '23505'\) return/, 'import ledger duplicates must remain idempotent');
assert.match(source, /form\.dataset\.saveMutationId/, 'order form must reuse its mutation key after a failed save');
assert.match(source, /draftId=editId\|\|form\.dataset\.draftId\|\|newOrderId\(type\)/, 'new orders must reuse their id across a retry');
assert.match(source, /mutationKey:`\$\{mutationKey\}:\$\{kind\}`/, 'each ledger fact must derive a stable key from the save attempt');
assert.match(source, /if\(cloudReady&&currentUser\)await loadCloudData\(\{allowMigration:false,silent:true\}\)/, 'a successful retry must refresh the ledger from the server');
assert.match(source, /const mergeLedgerTransaction = row =>/, 'Realtime and save responses must share one ledger merge path');
assert.match(source, /mergeLedgerTransaction\(data\)/, 'save responses must not append a duplicate ledger row');
assert.match(source, /else mergeLedgerTransaction\(row\)/, 'Realtime ledger inserts must be deduplicated by row id');
assert.match(source, /function orderLedgerSnapshot\(order\)/, 'ledger display must derive current cash facts from order state');
assert.match(source, /const pendingSupplier=dashboardOrders\(\)\.reduce/, 'unpaid supplier cost must be shown separately from cash outflow');
assert.match(source, /!ledgerSnapshotKinds\.has\(item\.kind\)/, 'historical aggregate receipt and payment rows must not be double-counted');
assert.match(source, /const removeLedgerTransactionsForOrder = async orderId/, 'cancelled orders must remove their cloud ledger rows');
assert.match(source, /const purgeFailedOrderLedgers = async orderIds/, 'existing cancelled orders must be cleaned on cloud load');
assert.match(source, /await purgeFailedOrderLedgers\(orders\.filter\(isFailedOrder\)\.map\(order => order\.id\)\)/, 'cloud load must purge legacy failed-order ledger rows');
assert.match(source, /if\(isFailedOrder\(order\)\)await removeLedgerTransactionsForOrder\(order\.id\)/, 'saving a cancelled order must clear its ledger rows');
assert.match(source, /const oldLedgerState=isFailedOrder\(old\)/, 'reactivating an order must rebuild ledger deltas from zero');
assert.match(migration, /add column if not exists transaction_key/, 'database must persist order-save mutation keys');
assert.match(migration, /ledger_transactions_transaction_key_unique_idx/, 'database must enforce mutation-key uniqueness per user');

console.log('Ledger retry regression tests passed');
