import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = await readFile(resolve(root, 'public/app.js'), 'utf8');

assert.match(source, /importBatchId: row\.import_batch_id \|\| ''/, 'cloud rows must retain the import batch id');
assert.match(source, /sourceRow: row\.source_row \|\| null/, 'cloud rows must retain the source row');
assert.match(source, /existing\.data\?\.status==='active'/, 'active import batches must block duplicate imports');
assert.match(source, /existing\.data\?\.status==='reverted'/, 'reverted import batches must be reusable');
assert.match(source, /status:'active',reverted_at:null/, 're-importing a reverted batch must reactivate it');
assert.match(source, /supplierPaymentFilter='all'.{0,240}byId\('supplierPaymentFilter'\)\.value='all'/s, 'import completion must clear all order filters');
assert.match(source, /ledgerTransactions=ledgerTransactions\.map\(item=>\(\{\.\.\.item,kind:escapeHtml/, 'order detail ledger text must be escaped before HTML insertion');
assert.match(source, /orders=\[\.\.\.prepared,\.\.\.orders\.filter\(order=>!preparedIds\.has\(String\(order\.id\)\)\)\]/, 'import completion must merge prepared orders with existing orders');
assert.match(source, /await loadCloudData\(\{allowMigration:false,silent:true\}\)/, 'import completion must reload the final cloud dataset');
assert.match(source, /const importFingerprint = async file =>/, 'import duplicate detection must hash file content');
assert.match(source, /import_key: source === 'import'/, 'import ledger writes must carry an idempotency key');
assert.match(source, /ledgerTransactions=ledgerTransactions\.filter\(item=>item\.orderId!==id\)/, 'deleting an order must clear its local ledger rows');

const realtimeMigration = await readFile(resolve(root, 'supabase/migrations/20261023130000_enable_realtime_sync.sql'), 'utf8');
assert.match(realtimeMigration, /pg_publication_tables/, 'Realtime migration must be idempotent');
assert.match(realtimeMigration, /ledger_transactions/, 'Realtime migration must include ledger transactions');

console.log('Import regression tests passed');
