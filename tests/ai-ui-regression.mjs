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
const helpers = vm.runInNewContext(`${source.slice(helperStart, helperEnd)};({ aiSettlementMode, aiCommissionStatus, aiPaymentStatus, resolveMaterialOrderMatch })`);
assert.equal(helpers.aiSettlementMode({ settlement_mode: 'guest_pay_commission' }), 'guest_pay_commission');
assert.equal(helpers.aiSettlementMode({ commission_expected: 132.21, commission_platform: '游虾' }), 'guest_pay_commission', 'commission fields should imply guest-pay settlement');
assert.equal(helpers.aiSettlementMode({ gmv: 1926.98, cost: 1800 }), 'agency_pay');
assert.equal(helpers.aiCommissionStatus({ commission_expected: 132.21, commission_received: 0 }), 'pending');
assert.equal(helpers.aiCommissionStatus({ commission_expected: 132.21, commission_received: 132.21 }), 'received');
assert.equal(helpers.aiPaymentStatus('已付款'), 'paid');
assert.equal(helpers.aiPaymentStatus('已收款'), 'paid');
assert.equal(helpers.aiPaymentStatus('未付款'), 'unpaid');
assert.equal(helpers.aiPaymentStatus('部分收款'), 'partial');
assert.equal(helpers.aiPaymentStatus(''), 'unknown');
const existingOrders = [
  { id: 'order-platform', orderCode: 'ORD-001', type: 'hotel', platformOrderNo: 'S228007514940', confirmation: 'C-001', supplier: '厦门W酒店', serviceDate: '2026-11-10', guestNames: '谭作明', location: '厦门', upstreamName: '道旅' },
  { id: 'order-extension', orderCode: 'ORD-002', type: 'hotel', platformOrderNo: '', confirmation: 'C-001', supplier: '厦门W酒店', serviceDate: '2026-11-11', guestNames: '谭作明', location: '厦门' },
];
const platformMatch = helpers.resolveMaterialOrderMatch({ type: 'hotel', platform_order_no: 'S228007514940', service_date: '2026-11-10' }, existingOrders);
assert.equal(platformMatch.status, 'matched', 'material with an exact platform order number should update the existing order');
assert.equal(platformMatch.order.id, 'order-platform');
const extensionMatch = helpers.resolveMaterialOrderMatch({ type: 'hotel', confirmation: 'C-001', supplier: '厦门W酒店', service_date: '2026-11-12' }, existingOrders);
assert.equal(extensionMatch.status, 'ambiguous', 'same confirmation across different dates must not be auto-merged');
const roomCardMatch = helpers.resolveMaterialOrderMatch({ type: 'hotel', supplier: '厦门W酒店', location: '厦门', service_date: '2026-11-10', guest_names: '谭作明', upstream_name: '道旅' }, existingOrders);
assert.equal(roomCardMatch.status, 'matched', 'room-card material should use the hotel, date, guest and upstream fingerprint');
const newMatch = helpers.resolveMaterialOrderMatch({ type: 'hotel', platform_order_no: 'NEW-1', confirmation: 'NEW-C', service_date: '2026-12-01', supplier: '广州瑰丽' }, existingOrders);
assert.equal(newMatch.status, 'new', 'unmatched material should remain a new order');
const comparisonStart = source.indexOf('function normalizedOrderMatchValue');
const comparisonEnd = source.indexOf('function renderAiDraftMatchTable', comparisonStart);
assert.notEqual(comparisonStart, -1, 'material comparison helpers must exist');
assert.notEqual(comparisonEnd, -1, 'material comparison helper boundary must remain discoverable');
const comparisonHelpers = vm.runInNewContext(`${source.slice(comparisonStart, comparisonEnd)};({ materialComparison })`);
const comparison = comparisonHelpers.materialComparison(existingOrders[0], { platform_order_no: 'S228007514940', supplier: '新酒店名', service_date: '2026-11-10' });
assert.equal(comparison.find(item => item.key === 'supplier')?.changed, true, 'changed material fields must be marked for review');
assert.equal(comparison.find(item => item.key === 'platform_order_no')?.changed, false, 'unchanged material fields must not be selected as changes');
assert.match(source, /data-ai-material-field/, 'matched material must render field-level update checkboxes');
assert.match(source, /填入选中字段/, 'matched material must use an explicit selected-fields action');
assert.match(source, /byId\('settlementMode'\)\.value=mode/, 'AI fill must apply settlement mode');
assert.match(source, /byId\('commissionExpected'\)\.value=mode==='guest_pay_commission'/, 'AI fill must apply expected commission');
assert.match(source, /byId\('commissionStatus'\)\.value=mode==='guest_pay_commission'/, 'AI fill must apply commission status');
assert.match(source, /byId\('received'\)\.value=/, 'AI fill must apply customer received amount');
assert.match(source, /customer_payment_status/, 'AI fill must prefer explicit customer payment status');
assert.match(source, /byId\('supplierPaymentStatus'\)\.value=/, 'AI fill must apply supplier payment status');
assert.match(source, /supplierPaidValue>=supplierCost\?'paid':'partial'/, 'AI fill must infer supplier status from paid amount when the draft omits it');
assert.match(source, /byId\('platformOrderNo'\)\.value=aiValue\(order\.platform_order_no\)/, 'AI fill must apply platform order number separately');
assert.match(source, /byId\('guestCount'\)\.value=order\.guest_count/, 'AI fill must apply guest count');
assert.match(source, /byId\('mealPlan'\)\.value=aiValue\(order\.meal_plan\)/, 'AI fill must apply meal plan');
assert.match(source, /byId\('checkOutDate'\)\.value=aiValue\(order\.check_out_date\)/, 'AI fill must apply checkout date');
assert.match(source, /fillMatchedMaterialDraft\(aiDraftMatch\.order,data\.order\|\|\{\}\)/, 'matched material must open the existing order instead of creating a duplicate');
assert.match(source, /aiDraftExistingOrder/, 'ambiguous material matches must require an explicit order choice');
assert.match(source, /function cleanMaterialText\(value\)/, 'browser must clean sensitive text before sending PDF material');
assert.match(source, /function extractPdfMaterial\(file\)/, 'browser must extract PDF text locally');
assert.match(source, /vendor\/pdfjs\/pdf\.min\.mjs/, 'PDF.js must be self-hosted');
const materialStart = source.indexOf('const materialEmailPattern');
const materialEnd = source.indexOf('function renderAssistantMaterials', materialStart);
assert.notEqual(materialStart, -1, 'material privacy helpers must exist');
const materialHelpers = vm.runInNewContext(`${source.slice(materialStart, materialEnd)};({ cleanMaterialText })`);
const cleanedMaterial = materialHelpers.cleanMaterialText('酒店电话 020-88888888，手机 13812345678，邮箱 test@example.com');
assert.equal(cleanedMaterial.text.includes('020-88888888'), false, 'PDF text must remove landline numbers');
assert.equal(cleanedMaterial.text.includes('13812345678'), false, 'PDF text must remove mobile numbers');
assert.equal(cleanedMaterial.text.includes('test@example.com'), false, 'PDF text must remove email addresses');

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
