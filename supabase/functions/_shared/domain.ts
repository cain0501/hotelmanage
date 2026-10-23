export const numberValue = (value: unknown) => Number.isFinite(Number(value)) ? Number(value) : 0;
export const settlementMode = (order: Record<string, unknown>) => order.settlement_mode || order.settlementMode || 'agency_pay';
export const isCommissionOrder = (order: Record<string, unknown>) => settlementMode(order) === 'guest_pay_commission';
export const isFailedOrder = (order: Record<string, unknown>) => ['cancelled', 'refunded'].includes(String(order.status || ''));
export const commissionReceived = (order: Record<string, unknown>) => numberValue(order.commission_received ?? order.commissionReceived);
export const commissionExpected = (order: Record<string, unknown>) => numberValue(order.commission_expected ?? order.commissionExpected);
export const directCost = (order: Record<string, unknown>) => numberValue(order.direct_cost ?? order.directCost);
export const commissionOutstanding = (order: Record<string, unknown>) => Math.max(0, commissionExpected(order) - commissionReceived(order));
export const customerPaymentStatus = (order: Record<string, unknown>) => {
  if (isCommissionOrder(order) || settlementMode(order) === 'no_funds') return 'not_applicable';
  return String(order.customer_payment_status || order.customerPaymentStatus || order.payment_status || order.paymentStatus || 'unknown');
};
export const supplierPaymentStatus = (order: Record<string, unknown>) => {
  if (isCommissionOrder(order) || settlementMode(order) === 'no_funds') return 'not_required';
  return String(order.supplier_payment_status || order.supplierPaymentStatus || 'unknown');
};
export const orderProfit = (order: Record<string, unknown>) => {
  if (isCommissionOrder(order)) return commissionReceived(order) - directCost(order);
  const override = order.profit_override ?? order.profitOverride;
  if (override !== null && override !== undefined && override !== '') return numberValue(override);
  return numberValue(order.gmv) - numberValue(order.cost);
};
export const isReceivable = (order: Record<string, unknown>) => !isCommissionOrder(order) && !isFailedOrder(order) && ['unpaid', 'partial'].includes(customerPaymentStatus(order));
export const isPayable = (order: Record<string, unknown>) => !isCommissionOrder(order) && settlementMode(order) !== 'no_funds' && !isFailedOrder(order) && ['unpaid', 'partial'].includes(supplierPaymentStatus(order));
export const roomNights = (order: Record<string, unknown>) => order.type === 'hotel' ? numberValue(order.rooms || 1) * numberValue(order.nights) : 0;
export const dateKeyInChina = (value = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(value);
  const get = (type: string) => parts.find(part => part.type === type)?.value || '';
  return `${get('year')}-${get('month')}-${get('day')}`;
};
export const localDateKey = (value: unknown) => value instanceof Date
  ? `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
  : String(value || '').slice(0, 10);
