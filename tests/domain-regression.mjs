import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import vm from 'node:vm';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = await readFile(resolve(root, 'public/shared/domain.js'), 'utf8');
const context = {};
vm.createContext(context);
vm.runInContext(source, context);
const domain = context.HotelOperationsDomain;
assert.ok(domain, 'shared domain must load in the browser runtime');

const commission = { settlement_mode: 'guest_pay_commission', commission_received: 132.21, direct_cost: 10, profit_override: 999 };
assert.equal(Number(domain.orderProfit(commission).toFixed(2)), 122.21, 'commission profit must use received commission minus direct cost');
assert.equal(domain.isReceivable({ gmv: 100, received: 99.99, customer_payment_status: 'paid' }), false, 'paid order with rounding difference is not receivable');
assert.equal(domain.isReceivable({ gmv: 100, received: 0, customer_payment_status: 'unknown' }), false, 'unknown customer receipt is a data-quality issue, not confirmed receivable');
assert.equal(domain.isReceivable({ gmv: 100, received: 0, customer_payment_status: 'unpaid' }), true);
assert.equal(domain.isReceivable({ gmv: 100, received: 0, customer_payment_status: 'unpaid', status: 'refunded' }), false);
assert.equal(domain.dateKeyInChina(new Date('2026-10-22T19:30:00.000Z')), '2026-10-23', 'China date must not use UTC calendar date');
assert.equal(domain.localDateKey(vm.runInContext('new Date(2026, 9, 11)', context)), '2026-10-11', 'Excel Date values must use local date parts');

console.log('Domain regression tests passed');
