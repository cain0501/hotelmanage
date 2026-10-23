(function attachHotelOperationsDomain(global) {
  const failedStatuses = new Set(['cancelled', 'refunded']);
  const numberValue = value => Number.isFinite(Number(value)) ? Number(value) : 0;
  const settlementMode = order => order?.settlementMode || order?.settlement_mode || 'agency_pay';
  const isCommissionOrder = order => settlementMode(order) === 'guest_pay_commission';
  const isFailedOrder = order => failedStatuses.has(String(order?.status || ''));
  const commissionReceived = order => numberValue(order?.commissionReceived ?? order?.commission_received);
  const commissionExpected = order => numberValue(order?.commissionExpected ?? order?.commission_expected);
  const directCost = order => numberValue(order?.directCost ?? order?.direct_cost);
  const commissionOutstanding = order => Math.max(0, commissionExpected(order) - commissionReceived(order));
  const customerPaymentStatus = order => {
    if (isCommissionOrder(order) || settlementMode(order) === 'no_funds') return 'not_applicable';
    return String(order?.customerPaymentStatus || order?.customer_payment_status || order?.paymentStatus || order?.payment_status || 'unknown');
  };
  const supplierPaymentStatus = order => {
    if (isCommissionOrder(order) || settlementMode(order) === 'no_funds') return 'not_required';
    return String(order?.supplierPaymentStatus || order?.supplier_payment_status || 'unknown');
  };
  const orderProfit = order => {
    if (isCommissionOrder(order)) return commissionReceived(order) - directCost(order);
    const override = order?.profitOverride ?? order?.profit_override;
    if (override !== null && override !== undefined && override !== '') return numberValue(override);
    return numberValue(order?.gmv) - numberValue(order?.cost);
  };
  const isReceivable = order => !isCommissionOrder(order) && !isFailedOrder(order) && ['unpaid', 'partial'].includes(customerPaymentStatus(order));
  const isPayable = order => !isCommissionOrder(order) && settlementMode(order) !== 'no_funds' && !isFailedOrder(order) && ['unpaid', 'partial'].includes(supplierPaymentStatus(order));
  const roomNights = order => order?.type === 'hotel' ? numberValue(order?.rooms || 1) * numberValue(order?.nights) : 0;
  const dateKeyInChina = (value = new Date()) => {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(value);
    const get = type => parts.find(part => part.type === type)?.value || '';
    return `${get('year')}-${get('month')}-${get('day')}`;
  };
  const localDateKey = value => value instanceof Date
    ? `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
    : String(value || '').slice(0, 10);
  global.HotelOperationsDomain = { numberValue, settlementMode, isCommissionOrder, isFailedOrder, commissionReceived, commissionExpected, directCost, commissionOutstanding, customerPaymentStatus, supplierPaymentStatus, orderProfit, isReceivable, isPayable, roomNights, dateKeyInChina, localDateKey };
})(globalThis);
