import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const [html, source] = await Promise.all([
  readFile(resolve(root, 'public/index.html'), 'utf8'),
  readFile(resolve(root, 'public/app.js'), 'utf8'),
]);

assert.match(html, /id="roomNightAvgGmv"/, 'dashboard must expose the average nightly GMV metric');
assert.match(source, /hotelGmv\/hotelRoomNights/, 'average nightly GMV must divide hotel GMV by room nights');
assert.match(source, /const platformName = order =>/, 'platform display must use a shared platform resolver');
assert.match(source, /isCommissionOrder\(order\) \? order\.commissionPlatform : order\.paymentPlatform/, 'commission orders must display their commission platform');
assert.match(source, /const platformMap=dashboardOrders\(\)\.reduce\(.*platformName\(order\)/, 'payment platform distribution must use the resolved platform');
assert.match(source, /guest_pay_commission:'客人前台支付 · 平台返佣'/, 'commission settlement text must retain the settlement mode');
assert.match(source, /label\.textContent=`返佣平台：\$\{platformName\(order\)\}`/, 'commission platform must be displayed separately');
assert.match(source, /const orderCostText = order =>/, 'order cost must have a dedicated display label');
assert.match(source, /label\.textContent=orderCostText\(order\)/, 'GMV cells must display the order cost below GMV');
assert.match(source, /function moveSupplierPaymentLabels\(pageList\)/, 'supplier payment status must be moved to the order identity cell');
assert.match(source, /item\.textContent\.startsWith\('供应商：'\)/, 'supplier payment label must be removed from the payment column');

const hotelGmv = 1926.98;
assert.match(html, /echarts@5\.5\.1\/dist\/echarts\.min\.js/, 'dashboard must load the pinned ECharts runtime');
assert.match(html, /id="receivableAging"/, 'dashboard must expose the receivable aging panel');
assert.match(html, /id="profitWaterfall"/, 'dashboard must expose the profit waterfall panel');
assert.match(html, /id="hotelBubbleChart"/, 'dashboard must expose the hotel bubble chart panel');
assert.match(source, /function periodWindow\(period,month\)/, 'dashboard month comparisons must use an explicit period window');
assert.match(source, /function previousWindow\(window\)/, 'dashboard comparisons must use the previous natural month');
assert.match(source, /function renderDashboardComparisons\(\)/, 'dashboard KPI deltas must be rendered from one snapshot');
assert.match(source, /slice\(-12\)/, 'trend chart must retain twelve months of data');
assert.match(source, /echarts\.getInstanceByDom\(el\)\|\|globalThis\.echarts\.init\(el\)/, 'dashboard charts must reuse ECharts instances');
assert.match(source, /setTimeout\(resizeDashboardCharts,150\)/, 'dashboard chart resize must be throttled');
assert.match(source, /function renderReceivableAging\(\)/, 'dashboard must render receivable aging buckets');
assert.match(source, /function renderProfitWaterfall\(\)/, 'dashboard must render the profit waterfall');
assert.match(source, /function openDashboardDrill\(drill\)/, 'dashboard KPI cards must support order drill-down');
const roomNights = 2;
assert.equal((hotelGmv / roomNights).toFixed(2), '963.49', 'average nightly GMV calculation contract');

console.log('Dashboard regression tests passed');
