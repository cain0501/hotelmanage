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

console.log('Import regression tests passed');
