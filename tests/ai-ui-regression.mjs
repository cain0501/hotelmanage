import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import vm from 'node:vm';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = await readFile(resolve(root, 'public/app.js'), 'utf8');
const helperStart = source.indexOf('function aiValue');
const helperEnd = source.indexOf('function renderAiDraft', helperStart);
assert.notEqual(helperStart, -1, 'AI draft normalization helpers must exist');
assert.notEqual(helperEnd, -1, 'AI draft normalization helper boundary must remain discoverable');
const helpers = vm.runInNewContext(`${source.slice(helperStart, helperEnd)};({ aiSettlementMode, aiCommissionStatus })`);
assert.equal(helpers.aiSettlementMode({ settlement_mode: 'guest_pay_commission' }), 'guest_pay_commission');
assert.equal(helpers.aiSettlementMode({ commission_expected: 132.21, commission_platform: '游虾' }), 'guest_pay_commission', 'commission fields should imply guest-pay settlement');
assert.equal(helpers.aiSettlementMode({ gmv: 1926.98, cost: 1800 }), 'agency_pay');
assert.equal(helpers.aiCommissionStatus({ commission_expected: 132.21, commission_received: 0 }), 'pending');
assert.equal(helpers.aiCommissionStatus({ commission_expected: 132.21, commission_received: 132.21 }), 'received');
assert.match(source, /byId\('settlementMode'\)\.value=mode/, 'AI fill must apply settlement mode');
assert.match(source, /byId\('commissionExpected'\)\.value=mode==='guest_pay_commission'/, 'AI fill must apply expected commission');
assert.match(source, /byId\('commissionStatus'\)\.value=mode==='guest_pay_commission'/, 'AI fill must apply commission status');

const start = source.indexOf('function clearAiDraftPreview');
const end = source.indexOf('\nfunction fillFromAiDraft', start);
assert.notEqual(start, -1, 'clearAiDraftPreview must exist');
assert.notEqual(end, -1, 'clearAiDraftPreview boundary must remain discoverable');

const elements = {
  aiDraftPanel: { hidden: false, innerHTML: '<static-draft-controls />' },
  analysisResult: { hidden: false },
  aiAccountingStatus: { textContent: '', className: '' },
};
const context = {
  aiDraft: { data: { intent: 'order' } },
  byId: id => elements[id] || null,
  clearPendingAction: () => {},
};
vm.runInNewContext(`${source.slice(start, end)};clearAiDraftPreview`, context);

context.clearAiDraftPreview('已填入表单，请核对后保存。');
assert.equal(elements.aiDraftPanel.hidden, true, 'draft panel should be hidden after filling');
assert.equal(elements.aiDraftPanel.innerHTML, '<static-draft-controls />', 'draft controls must remain mounted for the next AI draft');
assert.equal(elements.analysisResult.hidden, true, 'analysis result should be hidden');
assert.equal(elements.aiAccountingStatus.className, 'ai-status success', 'status should report a successful fill');

console.log('AI UI regression tests passed');
