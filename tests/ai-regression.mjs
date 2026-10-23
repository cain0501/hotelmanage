import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = await readFile(resolve(root, 'supabase/functions/ai-accounting/index.ts'), 'utf8');

// These checks protect the routing and trust-boundary contracts that cannot be
// safely tested by asking a live model to produce a particular answer.
assert.match(source, /date_field === 'service_date' \? 'service_date' : 'order_date'/, 'date queries must select one explicit date field');
assert.match(source, /\['cancelled', 'refunded'\]/, 'failed orders must be excluded by default');
assert.match(source, /includeFailed/, 'queries must have an explicit include-failed override');
assert.match(source, /draft_data_change/, 'existing-order changes must use a preview tool');
assert.match(source, /pending_action/, 'high-risk changes must persist a pending action');
assert.match(source, /confirm_action/, 'high-risk changes must require confirmation');
assert.match(source, /profile\.account_status !== 'approved'/, 'AI must reject unapproved accounts');
assert.match(source, /required_feature: 'ai\.use'/, 'AI must enforce the assigned feature permission');
assert.match(source, /user_id: userId/, 'server-side AI records must use the authenticated user id');
assert.match(source, /settlement_mode: 'agency_pay \| guest_pay_commission \| no_funds'/, 'accounting drafts must expose settlement mode');
assert.match(source, /settlement_mode: \{ type: 'string', enum: \['agency_pay', 'guest_pay_commission', 'no_funds'\] \}/, 'draft tool must accept commission settlement mode');
assert.match(source, /commission_status: \{ type: 'string', enum: \['pending', 'partial', 'received', 'none'\] \}/, 'draft tool must expose commission status');

const dateInRange = (value, start, end) => {
  const date = String(value || '');
  if (!start && !end) return true;
  return Boolean(date) && (!start || date >= start) && (!end || date <= end);
};
const isFailed = order => ['cancelled', 'refunded'].includes(String(order.status || ''));
const matches = (order, args, includeFailed = false) => {
  const field = args.date_field === 'service_date' ? 'service_date' : 'order_date';
  if (!includeFailed && isFailed(order)) return false;
  if (!dateInRange(order[field], args.start || '', args.end || '')) return false;
  if (args.type !== 'all' && order.type !== args.type) return false;
  return true;
};

const fixture = {
  type: 'hotel',
  order_date: '2026-10-01',
  service_date: '2026-11-03',
  status: 'confirmed',
};
assert.equal(matches(fixture, { date_field: 'service_date', start: '2026-11-01', end: '2026-11-30', type: 'hotel' }), true, '入住日期筛选 should match service_date');
assert.equal(matches(fixture, { date_field: 'order_date', start: '2026-11-01', end: '2026-11-30', type: 'hotel' }), false, '下单日期筛选 should not use service_date');
assert.equal(matches({ ...fixture, status: 'refunded' }, { date_field: 'service_date', start: '', end: '', type: 'all' }), false, 'refunded orders excluded by default');
assert.equal(matches({ ...fixture, status: 'refunded' }, { date_field: 'service_date', start: '', end: '', type: 'all' }, true), true, 'include_failed explicitly includes refunded orders');

console.log('AI regression contract tests passed');
