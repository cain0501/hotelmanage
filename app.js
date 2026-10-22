const currency = new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY', maximumFractionDigits: 0 });
const compactCurrency = value => `¥${Math.round(value).toLocaleString('zh-CN')}`;
const dateFmt = date => date ? new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit' }).format(new Date(`${date}T00:00:00`)).replace('/', '-') : '—';
const today = new Date().toISOString().slice(0, 10);

const seedOrders = [
  { id:'HT-20261010-001', type:'hotel', customer:'于深', booker:'小李', orderDate:'2026-10-10', serviceDate:'2026-10-11', location:'广州', supplier:'广州瑰丽', product:'豪华大床', rooms:1, nights:1, tickets:0, confirmation:'9715880', gmv:1680, cost:1516, received:1000, status:'confirmed' },
  { id:'HT-20261009-002', type:'hotel', customer:'陈泽标', booker:'小李', serviceDate:'2026-10-12', location:'广州', supplier:'广州瑰丽', product:'豪华大床', rooms:1, nights:1, tickets:0, confirmation:'9715585', gmv:1680, cost:1516, received:1680, status:'confirmed' },
  { id:'HT-20261009-003', type:'hotel', customer:'姚佳怡', booker:'小李', serviceDate:'2026-10-13', location:'广州', supplier:'广州瑰丽', product:'塔景大床双早', rooms:1, nights:1, tickets:0, confirmation:'9715494', gmv:2900, cost:2332, received:2900, status:'confirmed' },
  { id:'HT-20261008-004', type:'hotel', customer:'何女士', booker:'域见', serviceDate:'2026-10-20', location:'澳门', supplier:'伦敦人名汇', product:'豪华套房', rooms:2, nights:2, tickets:0, confirmation:'LDN2039', gmv:11300, cost:10450, received:5000, status:'booked' },
  { id:'HT-20261007-005', type:'hotel', customer:'张先生', booker:'丽仪', serviceDate:'2026-10-18', location:'三亚', supplier:'艾迪逊酒店', product:'海景大床', rooms:1, nights:3, tickets:0, confirmation:'SY5572', gmv:9800, cost:9030, received:9800, status:'confirmed' },
  { id:'FL-20261009-001', type:'flight', customer:'李然', booker:'B哥', serviceDate:'2026-10-18', location:'广州 → 东京', supplier:'全日空 ANA', product:'NH934 · 经济舱', rooms:0, nights:0, tickets:2, confirmation:'784-2310', gmv:12800, cost:11920, received:12800, status:'ticketed' },
  { id:'FL-20261008-002', type:'flight', customer:'陈先生', booker:'域见', serviceDate:'2026-10-22', location:'香港 → 巴黎', supplier:'国泰航空', product:'CX261 · 商务舱', rooms:0, nights:0, tickets:1, confirmation:'160-9931', gmv:21600, cost:20400, received:0, status:'pending' },
  { id:'HT-20261005-006', type:'hotel', customer:'林小姐', booker:'至诚', serviceDate:'2026-10-26', location:'广州', supplier:'卓美亚酒店', product:'豪华江景房', rooms:1, nights:2, tickets:0, confirmation:'JM7764', gmv:7200, cost:6580, received:7200, status:'confirmed' },
  { id:'HT-20260929-007', type:'hotel', customer:'吴先生', booker:'H哥', serviceDate:'2026-10-06', location:'巴黎', supplier:'宝格丽酒店', product:'城市景观套房', rooms:1, nights:3, tickets:0, confirmation:'PB2093', gmv:43950, cost:42483, received:43950, status:'confirmed' },
  { id:'FL-20260926-003', type:'flight', customer:'周女士', booker:'小李', serviceDate:'2026-10-13', location:'上海 → 新加坡', supplier:'新加坡航空', product:'SQ833 · 经济舱', rooms:0, nights:0, tickets:1, confirmation:'618-3241', gmv:4680, cost:4390, received:4680, status:'ticketed', issues:['缺少出票备注'] },
  { id:'HT-20260921-008', type:'hotel', customer:'沈先生', booker:'域见', serviceDate:'2026-10-15', location:'深圳', supplier:'罗湖木棉花酒店', product:'行政套房', rooms:1, nights:1, tickets:0, confirmation:'SZ1145', gmv:830, cost:0, received:830, status:'confirmed', issues:['成本金额为 0'] }
];

const looksLikeBrokenImport = rows => Array.isArray(rows) && rows.length >= 3 && rows.filter(row => row && row.customer === '待补客户' && row.supplier === '待确认' && Number(row.gmv) === 0).length >= 3;
const storedOrders = JSON.parse(localStorage.getItem('qizhang-orders-guest') || 'null');
const localOrders = Array.isArray(storedOrders) && !looksLikeBrokenImport(storedOrders) ? storedOrders : [];
localOrders.forEach((order,index)=>{if(!order.orderCode)order.orderCode=`ORD-${String(index+1).padStart(5,'0')}`;});
let orders = [];
let activeType = 'all';
const ORDER_PAGE_SIZE = 50;
let orderPage = 1;
let activeView = 'dashboard';
let lastHandledSessionKey = null;
let searchTerm = '';
let selectedOrderId = null;
let calculatorTarget = null;
let dateField = 'orderDate';
let dateStart = '';
let dateEnd = '';
let dashboardDateField = 'orderDate';
let statusFilter = 'all';
let paymentFilter = 'all';
let supplierPaymentFilter = 'all';
let invoiceFilter = 'all';
let locationFilter = '';
let supplierFilter = '';
let qualityIssueFilter = 'all';
let qualityTypeFilter = 'all';
let qualitySearch = '';
let qualityStatusFilter = 'open';
let AI_SETTINGS_STORAGE_KEY='qizhang-ai-settings-draft-guest';
let aiSettings = { provider:'openai-compatible', baseUrl:'https://api.openai.com/v1', model:'gpt-4o-mini', temperature:0.1, enabled:false };
let aiDraft = null;
let assistantPendingAction = null;
let analysisResult = null;
let assistantConversationId = null;
let assistantConversations = [];
let assistantHistoryOpen = false;
let assistantConversationStatusSupported = true;
let assistantMessages = [];
let assistantContext = {};
let assistantKnowledge = [];
let assistantMemories = [];
let assistantMemoryDraft = null;
let assistantWorkspaceAvailable = false;
let cleanupPreviewOrders = [];
let cleanupPreviewField = '';
let cleanupPreviewFrom = '';
let cleanupPreviewTo = '';
const localOtherIncomes = JSON.parse(localStorage.getItem('qizhang-other-income-guest') || '[]');
let otherIncomes = [];

const byId = id => document.getElementById(id);
document.addEventListener('click', event=>{
  const deleteTrigger=event.target.closest('[data-delete-order]');
  if(deleteTrigger){event.preventDefault();event.stopImmediatePropagation();deleteOrder(deleteTrigger.dataset.deleteOrder);return;}
  const openTrigger=event.target.closest('[data-open-order]');
  if(openTrigger){event.preventDefault();event.stopImmediatePropagation();openDetails(openTrigger.dataset.openOrder);}
});
const SUPABASE_URL = 'https://onomizgpzhqrmiuqeikf.supabase.co';
// Publishable key 只能用于浏览器端，RLS 才是数据安全边界；不要替换成 service_role key。
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_PfLkfwLJTSGCIchlm3_xiQ_LuLj_JOC';
const supabaseClient = window.supabase?.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
let currentUser = null;
let accountStatusTimer = null;
const userStorageKey = base => currentUser?.id ? `${base}-${currentUser.id}` : `${base}-guest`;
const aiSettingsStorageKey = () => userStorageKey('qizhang-ai-settings-draft');
let realtimeChannel = null;
let cloudReady = false;
let cloudBusy = false;
let qualityActions = {};
let qualityActionsCloudAvailable = false;
const saveLocalOrders = () => localStorage.setItem(userStorageKey('qizhang-orders'), JSON.stringify(orders));
const saveLocalOtherIncomes = () => localStorage.setItem(userStorageKey('qizhang-other-income'), JSON.stringify(otherIncomes));
const qualityActionsStorageKey = () => `qizhang-quality-actions-${currentUser?.id || 'guest'}`;
const saveLocalQualityActions = () => localStorage.setItem(qualityActionsStorageKey(), JSON.stringify(qualityActions));
const readLocalQualityActions = () => { try { const value=JSON.parse(localStorage.getItem(qualityActionsStorageKey()) || '{}'); return value && typeof value==='object' ? value : {}; } catch { return {}; } };
const isMissingQualityActionsTable = error => ['42P01','PGRST205'].includes(error?.code) || error?.status===404;
const qualityActionKey = (order,kind) => `${order.id}::${kind}`;
async function loadQualityActions(){
  qualityActions=readLocalQualityActions();qualityActionsCloudAvailable=false;
  if(!cloudReady||!currentUser||!supabaseClient){renderQuality();return;}
  const {data,error}=await supabaseClient.from('quality_issue_actions').select('id,order_id,issue_kind,status,updated_at').order('updated_at',{ascending:false});
  if(error){if(!isMissingQualityActionsTable(error))console.warn('Quality actions unavailable',error.message);renderQuality();return;}
  qualityActionsCloudAvailable=true;
  if(data?.length){qualityActions=Object.fromEntries(data.map(row=>[row.id,{status:row.status,updatedAt:row.updated_at||''}]));saveLocalQualityActions();}
  else if(Object.keys(qualityActions).length){const rows=Object.entries(qualityActions).map(([id,action])=>{const [orderId,...kindParts]=id.split('::');return {id,user_id:currentUser.id,order_id:orderId,issue_kind:kindParts.join('::'),status:action.status,updated_at:action.updatedAt||new Date().toISOString()};});const result=await supabaseClient.from('quality_issue_actions').upsert(rows,{onConflict:'user_id,id'});if(result.error)console.warn('Quality actions migration unavailable',result.error.message);}
  renderQuality();
}
async function saveQualityActionToCloud(id,orderId,kind,status,updatedAt){
  if(!qualityActionsCloudAvailable||!cloudReady||!currentUser)return;
  const {error}=await supabaseClient.from('quality_issue_actions').upsert({id,user_id:currentUser.id,order_id:orderId,issue_kind:kind,status,updated_at:updatedAt},{onConflict:'user_id,id'});
  if(error)throw error;
}
const saveOrdersBatch = async () => {
  saveLocalOrders();
  if (!cloudReady || !currentUser) return;
  setSyncStatus('正在同步订单…', 'syncing');
  const { error } = await supabaseClient.from('orders').upsert(orders.map(orderToRow), { onConflict: 'user_id,id' });
  if (error) { setSyncStatus(`同步失败：${error.message}`, 'sync-error'); throw error; }
  setSyncStatus('已同步到云端', 'synced');
};
const saveOrder = async order => {
  if (!cloudReady || !currentUser) { saveLocalOrders(); return; }
  setSyncStatus('正在同步订单…', 'syncing');
  const { error } = await supabaseClient.from('orders').upsert([orderToRow(order)], { onConflict: 'user_id,id' });
  if (error) { setSyncStatus(`同步失败：${error.message}`, 'sync-error'); throw error; }
  setSyncStatus('已同步到云端', 'synced');
};
const saveOtherIncomesBatch = async () => {
  saveLocalOtherIncomes();
  if (!cloudReady || !currentUser) return;
  setSyncStatus('正在同步其它收入…', 'syncing');
  const { error } = await supabaseClient.from('other_income').upsert(otherIncomes.map(otherIncomeToRow), { onConflict: 'user_id,id' });
  if (error) { setSyncStatus(`同步失败：${error.message}`, 'sync-error'); throw error; }
  setSyncStatus('已同步到云端', 'synced');
};
const saveOtherIncome = async item => {
  saveLocalOtherIncomes();
  if (!cloudReady || !currentUser) return;
  setSyncStatus('正在同步其它收入…', 'syncing');
  const { error } = await supabaseClient.from('other_income').upsert([otherIncomeToRow(item)], { onConflict: 'user_id,id' });
  if (error) { setSyncStatus(`同步失败：${error.message}`, 'sync-error'); throw error; }
  setSyncStatus('已同步到云端', 'synced');
};
const orderCode = order => order.orderCode || order.id;
const nextOrderCode = () => {
  const usedCodes = new Set(orders.map(orderCode));
  const numericCodes = [...usedCodes].map(code => /^ORD-(\d+)$/.exec(code)).filter(Boolean).map(match => Number(match[1]));
  let next = Math.max(0, ...numericCodes) + 1;
  let candidate = `ORD-${String(next).padStart(5, '0')}`;
  while (usedCodes.has(candidate)) candidate = `ORD-${String(++next).padStart(5, '0')}`;
  return candidate;
};
const newOrderId = type => `${type === 'hotel' ? 'HT' : 'FL'}-${today.replaceAll('-', '')}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
const settlementMode = order => order.settlementMode || 'agency_pay';
const isCommissionOrder = order => settlementMode(order) === 'guest_pay_commission';
const commissionReceived = order => asNumber(order.commissionReceived);
const commissionExpected = order => asNumber(order.commissionExpected);
const commissionOutstanding = order => Math.max(0, commissionExpected(order) - commissionReceived(order));
const directCost = order => asNumber(order.directCost);
const commissionStatus = order => order.commissionStatus || (commissionReceived(order)>=commissionExpected(order)&&commissionExpected(order)>0?'received':commissionReceived(order)>0?'partial':commissionExpected(order)>0?'pending':'none');
const commissionStatusText = order => ({ pending:'待返佣', partial:'部分返佣', received:'已返佣', none:'无佣金' })[commissionStatus(order)] || '待返佣';
const expectedProfit = order => isCommissionOrder(order) ? commissionExpected(order) - directCost(order) : Number(order.gmv) - Number(order.cost);
const profit = order => order.profitOverride !== null && order.profitOverride !== undefined && !isCommissionOrder(order) ? Number(order.profitOverride) : isCommissionOrder(order) ? commissionReceived(order) - directCost(order) : Number(order.gmv) - Number(order.cost);
const roomNights = order => order.type === 'hotel' ? Number(order.rooms || 1) * Number(order.nights || 0) : 0;
const customerPaymentStatus = order => isCommissionOrder(order)||settlementMode(order)==='no_funds' ? 'not_applicable' : order.customerPaymentStatus || order.paymentStatus || (order.received >= order.gmv ? 'paid' : order.received > 0 ? 'partial' : 'unpaid');
const supplierPaid = order => isCommissionOrder(order)||settlementMode(order)==='no_funds' ? 0 : asNumber(order.supplierPaid);
const supplierPaymentStatus = order => isCommissionOrder(order)||settlementMode(order)==='no_funds' ? 'not_required' : order.supplierPaymentStatus || 'unknown';
const supplierPaymentText = order => ({ paid:'已付款', partial:'部分付款', unpaid:'未付款', unknown:'待核对', not_required:'无需付款' })[supplierPaymentStatus(order)] || '待核对';
const payment = order => isCommissionOrder(order) ? (commissionStatus(order)==='pending'?'unpaid':commissionStatus(order)==='partial'?'partial':'paid') : customerPaymentStatus(order);
const paymentText = order => isCommissionOrder(order) ? commissionStatusText(order) : ({ paid:'已收款', partial:'部分收款', unpaid:'未收款', refunded:'已退款', unknown:'待核对', not_applicable:'无需收款' })[customerPaymentStatus(order)];
const settlementText = order => ({ agency_pay:'我方代付', guest_pay_commission:'客人前台支付 · 平台返佣', no_funds:'无资金往来' })[settlementMode(order)] || '我方代付';
const customerReceivable = order => !isCommissionOrder(order) && ['unpaid','partial'].includes(customerPaymentStatus(order));
const supplierPayable = order => !isCommissionOrder(order) && settlementMode(order)!=='no_funds' && ['unpaid','partial'].includes(supplierPaymentStatus(order));
const paymentIssue = order => isCommissionOrder(order) ? commissionOutstanding(order)>0 : customerReceivable(order)||supplierPayable(order);
const invoiceStatus = order => order.invoiceStatus === 'issued' && /无发票/.test(order.invoiceCompany || '') ? 'no_invoice' : order.invoiceStatus || (order.invoiceCompany ? 'issued' : 'unissued');
const invoiceText = order => ({ issued:'已开票', unissued:'未开票', no_invoice:'无发票' })[invoiceStatus(order)] || '未开票';
const statusText = order => ({ booked:'预订中', confirming:'确认中', confirmed:'已确认', cancelled:'已取消', pending:'待出票', ticketed:'已出票', refunded:'已退票' })[order.status] || '待确认';
const typeName = order => order.type === 'hotel' ? '酒店' : '机票';
const emptyToNull = value => value === '' || value === undefined ? null : value;
const asNumber = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const orderToRow = order => ({
  id: order.id, user_id: currentUser?.id, order_code: orderCode(order), type: order.type,
  customer: order.customer || '', booker: order.booker || '', order_date: emptyToNull(order.orderDate), service_date: emptyToNull(order.serviceDate),
  location: order.location || '', supplier: order.supplier || '', product: order.product || '', rooms: asNumber(order.rooms), nights: asNumber(order.nights), tickets: asNumber(order.tickets),
  confirmation: order.confirmation || '', gmv: asNumber(order.gmv), cost: asNumber(order.cost), received: asNumber(order.received), payment_status: customerPaymentStatus(order), customer_payment_status: customerPaymentStatus(order), supplier_paid: supplierPaid(order), supplier_payment_status: supplierPaymentStatus(order),
  payment_platform: order.paymentPlatform || '', settlement_mode: settlementMode(order), guest_payment_to: order.guestPaymentTo || '', commission_platform: order.commissionPlatform || '', commission_expected: commissionExpected(order), commission_received: commissionReceived(order), commission_status: commissionStatus(order), direct_cost: directCost(order), commission_received_date: emptyToNull(order.commissionReceivedDate), invoice_status: invoiceStatus(order), invoice_company: order.invoiceCompany || '', profit_override: emptyToNull(order.profitOverride),
  status: order.status || 'booked', issues: Array.isArray(order.issues) ? order.issues : []
});
const rowToOrder = row => ({
  id: row.id, orderCode: row.order_code || row.id, type: row.type || 'hotel', customer: row.customer || '', booker: row.booker || '', orderDate: row.order_date || '', serviceDate: row.service_date || '',
  location: row.location || '', supplier: row.supplier || '', product: row.product || '', rooms: asNumber(row.rooms), nights: asNumber(row.nights), tickets: asNumber(row.tickets), confirmation: row.confirmation || '',
  gmv: asNumber(row.gmv), cost: asNumber(row.cost), received: asNumber(row.received), paymentStatus: row.payment_status || 'paid', customerPaymentStatus: row.customer_payment_status || row.payment_status || 'paid', supplierPaid: asNumber(row.supplier_paid), supplierPaymentStatus: row.supplier_payment_status || 'unknown', paymentPlatform: row.payment_platform || '',
  invoiceStatus: row.invoice_status || 'unissued', invoiceCompany: row.invoice_company || '', settlementMode: row.settlement_mode || 'agency_pay', guestPaymentTo: row.guest_payment_to || '', commissionPlatform: row.commission_platform || '', commissionExpected: asNumber(row.commission_expected), commissionReceived: asNumber(row.commission_received), commissionStatus: row.commission_status || 'none', directCost: asNumber(row.direct_cost), commissionReceivedDate: row.commission_received_date || '', profitOverride: row.profit_override === null || row.profit_override === undefined ? null : asNumber(row.profit_override),
  status: row.status || 'booked', issues: Array.isArray(row.issues) ? row.issues : []
});
const incomeOrderIds = item => Array.isArray(item.orderIds) ? item.orderIds : item.orderId ? [item.orderId] : [];
const otherIncomeToRow = item => ({ id: item.id, user_id: currentUser?.id, income_date: emptyToNull(item.date) || today, name: item.name || '', payer: item.payer || '', payee: item.payee || '', order_id: incomeOrderIds(item).join(','), amount: asNumber(item.amount), expense: asNumber(item.expense) });
const rowToOtherIncome = row => ({ id: row.id, date: row.income_date || '', name: row.name || '', payer: row.payer || '', payee: row.payee || '', orderId: row.order_id || '', orderIds: String(row.order_id || '').split(',').map(id=>id.trim()).filter(Boolean), amount: asNumber(row.amount), expense: asNumber(row.expense) });
function syncAiSettingsForm(){
  if(!byId('aiProvider'))return;
  byId('aiProvider').value=aiSettings.provider||'openai-compatible';byId('aiBaseUrl').value=aiSettings.baseUrl||'';byId('aiModel').value=aiSettings.model||'';byId('aiTemperature').value=aiSettings.temperature??0.1;byId('aiEnabled').checked=Boolean(aiSettings.enabled);byId('aiConfigStatus').textContent=aiSettings.enabled?'已启用':'未启用';
}
async function loadAiSettings(){
  if(!currentUser||!supabaseClient)return;
  try{const {data,error}=await supabaseClient.from('ai_settings').select('provider,base_url,model,temperature,enabled').eq('user_id',currentUser.id).maybeSingle();if(error)throw error;if(data)aiSettings={provider:data.provider||'openai-compatible',baseUrl:data.base_url||'https://api.openai.com/v1',model:data.model||'gpt-4o-mini',temperature:Number(data.temperature??0.1),enabled:Boolean(data.enabled)};syncAiSettingsForm();}catch(error){byId('aiConfigStatus').textContent='需执行 AI 数据库迁移';console.warn('AI settings unavailable',error.message);}
}
async function saveAiSettings(){
  const status=byId('aiSettingsStatus');const button=byId('aiSettingsForm').querySelector('button[type="submit"]');button.disabled=true;status.textContent='正在保存…';status.className='ai-status';
  aiSettings={provider:byId('aiProvider').value,baseUrl:byId('aiBaseUrl').value.trim()||'https://api.openai.com/v1',model:byId('aiModel').value.trim()||'gpt-4o-mini',temperature:Math.min(.5,Math.max(0,Number(byId('aiTemperature').value||.1))),enabled:byId('aiEnabled').checked};
  try{if(!cloudReady||!currentUser)throw new Error('请先登录云端账户');const {error}=await supabaseClient.from('ai_settings').upsert({user_id:currentUser.id,provider:aiSettings.provider,base_url:aiSettings.baseUrl,model:aiSettings.model,temperature:aiSettings.temperature,enabled:aiSettings.enabled},{onConflict:'user_id'});if(error)throw error;syncAiSettingsForm();status.textContent='配置已保存';status.className='ai-status success';}catch(error){status.textContent=error.message;status.className='ai-status error';}finally{button.disabled=false;}
}
const aiIntentText=intent=>({order:'新增订单',other_income:'其它收入',other_expense:'其它支出',payment:'登记收款',commission:'登记返佣',unknown:'待确认'})[intent]||'待确认';
async function loadAiSettings(){
  if(!currentUser||!supabaseClient)return;
  try{const {data,error}=await supabaseClient.from('ai_settings').select('provider,base_url,model,temperature,enabled').eq('user_id',currentUser.id).maybeSingle();if(error)throw error;if(data){aiSettings={provider:data.provider||'openai-compatible',baseUrl:data.base_url||'https://api.openai.com/v1',model:data.model||'gpt-4o-mini',temperature:Number(data.temperature??0.1),enabled:Boolean(data.enabled)};localStorage.removeItem(AI_SETTINGS_STORAGE_KEY);}else{const draft=JSON.parse(localStorage.getItem(AI_SETTINGS_STORAGE_KEY)||'null');if(draft)aiSettings={...aiSettings,...draft};}syncAiSettingsForm();}catch(error){byId('aiConfigStatus').textContent='AI配置读取失败';console.warn('AI settings unavailable',error.message);}
}
async function saveAiSettings(){
  const status=byId('aiSettingsStatus'),button=byId('aiSettingsForm').querySelector('button[type="submit"]');button.disabled=true;status.textContent='正在保存…';status.className='ai-status';
  aiSettings={provider:byId('aiProvider').value,baseUrl:byId('aiBaseUrl').value.trim()||'https://api.openai.com/v1',model:byId('aiModel').value.trim()||'gpt-4o-mini',temperature:Math.min(.5,Math.max(0,Number(byId('aiTemperature').value||.1))),enabled:byId('aiEnabled').checked};localStorage.setItem(AI_SETTINGS_STORAGE_KEY,JSON.stringify(aiSettings));
  try{if(!cloudReady||!currentUser)throw new Error('请先登录云端账户');const {data,error}=await supabaseClient.from('ai_settings').upsert({user_id:currentUser.id,provider:aiSettings.provider,base_url:aiSettings.baseUrl,model:aiSettings.model,temperature:aiSettings.temperature,enabled:aiSettings.enabled},{onConflict:'user_id'}).select('provider,base_url,model,temperature,enabled').single();if(error)throw error;aiSettings={provider:data.provider,baseUrl:data.base_url,model:data.model,temperature:Number(data.temperature),enabled:Boolean(data.enabled)};syncAiSettingsForm();status.textContent='配置已保存并同步到云端';status.className='ai-status success';}catch(error){status.textContent=`云端保存失败：${error.message}，已保留本机草稿`;status.className='ai-status error';}finally{button.disabled=false;}
}
const assistantConversationStorageKey=()=>`qizhang-assistant-conversation-${currentUser?.id||'guest'}`;
const assistantStatusText=status=>({draft:'草稿',published:'已发布',expired:'已过期',archived:'已废弃'})[status]||status||'草稿';
const assistantKnowledgeCategoryText=category=>({hotel_product:'酒店产品',hotel_policy:'酒店政策',supplier_rule:'供应商规则',operation_rule:'运营操作',destination:'目的地经验',case_learning:'历史案例',user_preference:'个人偏好'})[category]||'专业知识';
function renderAssistantConversation(){
  const panel=byId('assistantConversation');if(!panel)return;
  const messages=assistantMessages.slice(-12);panel.innerHTML=messages.length?messages.map(message=>`<div class="assistant-message ${message.role==='user'?'user':'assistant'}"><small>${message.role==='user'?'你':'AI'} · ${escapeHtml(String(message.created_at||'').slice(0,16).replace('T',' '))}</small><span>${escapeHtml(message.content||'')}</span></div>`).join(''):'<div class="assistant-message empty">当前会话会记住日期口径、筛选条件和已确认的业务规则。</div>';
  panel.scrollTop=panel.scrollHeight;
}
async function ensureAssistantConversation(){
  if(!cloudReady||!currentUser||!supabaseClient)return false;
  const savedId=localStorage.getItem(assistantConversationStorageKey());let data=null,error=null;
  if(savedId){({data,error}=await supabaseClient.from('assistant_conversations').select('id').eq('id',savedId).eq('user_id',currentUser.id).maybeSingle());}
  if(error)throw error;
  if(!data){({data,error}=await supabaseClient.from('assistant_conversations').select('id').eq('user_id',currentUser.id).order('updated_at',{ascending:false}).limit(1).maybeSingle());if(error)throw error;}
  if(!data){({data,error}=await supabaseClient.from('assistant_conversations').insert({user_id:currentUser.id,title:'AI 工作台'}).select('id').single());if(error)throw error;}
  assistantConversationId=data.id;localStorage.setItem(assistantConversationStorageKey(),assistantConversationId);return true;
}
async function loadAssistantWorkspace(){
  assistantWorkspaceAvailable=false;assistantMessages=[];assistantContext={};assistantKnowledge=[];renderAssistantConversation();renderKnowledgeList();
  if(!cloudReady||!currentUser||!supabaseClient)return;
  try{
    await ensureAssistantConversation();
    const [messagesResult,contextResult,knowledgeResult]=await Promise.all([
      supabaseClient.from('assistant_messages').select('id,role,content,metadata,created_at').eq('conversation_id',assistantConversationId).order('created_at',{ascending:false}).limit(30),
      supabaseClient.from('assistant_context').select('*').eq('conversation_id',assistantConversationId).maybeSingle(),
      supabaseClient.from('assistant_knowledge').select('id,title,category,scope,content,source,status,version,updated_at').order('updated_at',{ascending:false}).limit(50)
    ]);
    if(messagesResult.error)throw messagesResult.error;if(contextResult.error)throw contextResult.error;if(knowledgeResult.error)throw knowledgeResult.error;
    assistantMessages=(messagesResult.data||[]).reverse();assistantContext={...(contextResult.data||{}),...(contextResult.data?.context||{})};assistantKnowledge=knowledgeResult.data||[];assistantWorkspaceAvailable=true;renderAssistantConversation();renderKnowledgeList();
  }catch(error){if(!['42P01','PGRST205'].includes(error?.code)&&error?.status!==404)console.warn('AI工作台扩展数据暂不可用',error.message);renderAssistantConversation();renderKnowledgeList();}
}
async function saveAssistantMessage(role,content,metadata={}){
  if(!content)return;const record={role,content:String(content),metadata,created_at:new Date().toISOString()};assistantMessages=[...assistantMessages.slice(-29),record];renderAssistantConversation();
  if(!assistantWorkspaceAvailable||!assistantConversationId||!currentUser||!supabaseClient)return;
  const {error}=await supabaseClient.from('assistant_messages').insert({user_id:currentUser.id,conversation_id:assistantConversationId,role,content:String(content),metadata});if(error)console.warn('AI会话消息保存失败',error.message);
}
async function saveAssistantContext(next={}){
  assistantContext={...assistantContext,...next};
  if(!assistantWorkspaceAvailable||!assistantConversationId||!currentUser||!supabaseClient)return;
  const {error}=await supabaseClient.from('assistant_context').upsert({conversation_id:assistantConversationId,user_id:currentUser.id,...assistantContext,context:assistantContext},{onConflict:'conversation_id'});if(error)console.warn('AI上下文保存失败',error.message);
}
function assistantModelContext(){const conversation=assistantConversations.find(item=>item.id===assistantConversationId);return {context_state:assistantContext,conversation_summary:conversation?.summary||'',message_count:assistantMessages.length,history:assistantMessages.slice(-8).map(message=>({role:message.role,content:message.content}))};}
function renderKnowledgeList(){
  const panel=byId('knowledgeList');if(!panel)return;
  if(!assistantKnowledge.length){panel.innerHTML='<span class="ai-status">暂无知识。保存后会先进入草稿，发布后 AI 才会检索使用。</span>';return;}
  panel.innerHTML=assistantKnowledge.map(item=>`<article class="knowledge-card"><div class="knowledge-card-head"><span class="knowledge-card-title">${escapeHtml(item.title||'未命名知识')}</span><span class="knowledge-status ${escapeHtml(item.status||'draft')}">${assistantStatusText(item.status)}</span></div><small>${assistantKnowledgeCategoryText(item.category)} · ${escapeHtml(item.scope||'personal')} · ${escapeHtml(item.source||'用户提供')}</small><p>${escapeHtml(item.content||'')}</p><div class="knowledge-card-actions">${item.status==='draft'?`<button class="button quiet" data-knowledge-action="publish" data-knowledge-id="${escapeHtml(item.id)}">发布使用</button>`:''}${item.status==='published'?`<button class="button quiet" data-knowledge-action="archive" data-knowledge-id="${escapeHtml(item.id)}">标记废弃</button>`:''}</div></article>`).join('');
}
async function saveKnowledgeDraft(event){
  event.preventDefault();const status=byId('knowledgeStatus');if(!currentUser||!supabaseClient){status.textContent='请先登录云端账户';status.className='ai-status error';return;}
  const title=byId('knowledgeTitle').value.trim(),content=byId('knowledgeContent').value.trim();if(!title||!content){status.textContent='请填写标题和专业内容';status.className='ai-status error';return;}
  const scopeText=byId('knowledgeScopeText').value.trim();const record={user_id:currentUser.id,title,category:byId('knowledgeCategory').value,scope:'personal',content,keywords:scopeText?scopeText.split(/[\s,，/]+/).filter(Boolean):[],source:byId('knowledgeSource').value.trim()||'用户提供',source_type:'manual',status:'draft',created_by:currentUser.id};
  status.textContent='正在保存草稿…';status.className='ai-status';const {data,error}=await supabaseClient.from('assistant_knowledge').insert(record).select('id,title,category,scope,content,source,status,version,updated_at').single();if(error){status.textContent=`保存失败：${error.message}`;status.className='ai-status error';return;}
  assistantKnowledge=[data,...assistantKnowledge];renderKnowledgeList();byId('knowledgeForm').reset();status.textContent='已保存为草稿，发布后 AI 才会使用';status.className='ai-status success';
}
async function updateKnowledgeStatus(id,statusValue){
  if(!currentUser||!supabaseClient)return;const payload={status:statusValue,reviewed_at:statusValue==='published'?new Date().toISOString():null};const {error}=await supabaseClient.from('assistant_knowledge').update(payload).eq('id',id).eq('user_id',currentUser.id);if(error){window.alert(`知识状态更新失败：${error.message}`);return;}assistantKnowledge=assistantKnowledge.map(item=>item.id===id?{...item,...payload}:item);renderKnowledgeList();
}
 function aiValue(value){return value===null||value===undefined?'':String(value);}
const escapeHtml=value=>aiValue(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
function renderAiDraft(){
  const panel=byId('aiDraftPanel');if(!panel||!aiDraft)return;const data=aiDraft.data||aiDraft;const order=data.order||{};const income=data.income||{};const items=[];if(data.intent==='order'){items.push(['业务类型',order.type==='flight'?'机票订单':'酒店订单'],['客户',order.customer],['预订人',order.booker],['下单日期',order.order_date],['入住/出发',order.service_date],['供应商',order.supplier],['房型/航班',order.product],['GMV',order.gmv?compactCurrency(order.gmv):'未识别'],['成本',order.cost?compactCurrency(order.cost):'未识别'],['付款状态',order.payment_status]);}else{items.push(['日期',income.date],['名称',income.name],['收款方',income.payer],['付款方',income.payee],['收入',income.amount?compactCurrency(income.amount):'¥0'],['支出',income.expense?compactCurrency(income.expense):'¥0'],['关联线索',income.search_text]);}byId('aiDraftIntent').textContent=aiIntentText(data.intent);byId('aiDraftSummary').innerHTML=items.map(([label,value])=>`<div><span>${label}</span><b>${value||'未识别'}</b></div>`).join('');byId('aiDraftJson').textContent=JSON.stringify(data,null,2);panel.hidden=false;}
const aiDraftIntents=new Set(['order','other_income','other_expense','payment','commission']);
const aiChangeTargetFields={supplier:'supplier',product:'product',location:'location',booker:'booker',customer:'customer',payment_platform:'paymentPlatform',confirmation:'confirmation',status:'status'};
const aiChangeTargetLabels={supplier:'酒店 / 航司',product:'房型 / 航班',location:'城市 / 航线',booker:'预订人',customer:'客户',payment_platform:'付款平台',confirmation:'确认号 / 票号',status:'订单状态'};
const aiChangeValue=action=>String(action?.from_value??action?.fromValue??'').trim();
const aiChangeNextValue=action=>String(action?.to_value??action?.toValue??'').trim();
function renderPendingActionPreview(action){
  const panel=byId('aiPendingActionPanel');if(!panel)return;
  assistantPendingAction=action||null;
  const target=String(action?.target||'');const targetLabel=action?.target_label||aiChangeTargetLabels[target]||target||'订单字段';
  const fromValue=aiChangeValue(action),toValue=aiChangeNextValue(action),fromLabel=String(action?.from_value_label||fromValue),toLabel=String(action?.to_value_label||toValue),count=Number(action?.matched_count??action?.matchedCount??0);const samples=Array.isArray(action?.sample_records)?action.sample_records:[];
  const rows=samples.map(item=>`<div class="pending-action-row"><div><b>${escapeHtml(item.order_code||item.id||'订单')}</b><span>${escapeHtml(item.customer||'未填写客户')} · ${escapeHtml(item.booker||'未填写预订人')}</span></div><small>${escapeHtml(item.service_date||'未填写入住/出发日期')}</small></div>`).join('');
  panel.innerHTML=`<div class="ai-draft-head"><div><p class="eyebrow">BATCH CHANGE PREVIEW</p><h3>批量修改预览</h3></div><span class="status pending">待确认</span></div><div class="ai-draft-summary"><div><span>修改字段</span><b>${escapeHtml(targetLabel)}</b></div><div><span>预计影响</span><b>${count} 条订单</b></div><div><span>原值</span><b class="pending-old-value">${escapeHtml(fromLabel||'未识别')}</b></div><div><span>新值</span><b class="pending-new-value">${escapeHtml(toLabel||'未识别')}</b></div></div>${count?`<div class="pending-action-list"><p class="ai-status">匹配到的订单${samples.length<count?`（展示前 ${samples.length} 条）`:''}</p>${rows}</div>`:'<div class="ai-clean-empty">没有找到符合条件的订单，未执行任何修改。</div>'}<div class="ai-entry-actions"><span class="ai-status">AI 只生成预览，点击确认后才会修改订单。</span><div class="pending-action-buttons"><button class="button quiet" type="button" data-cancel-ai-change>取消</button><button class="button primary" type="button" data-confirm-ai-change ${count?'':'disabled'}>确认修改${count?` ${count} 条`:''}</button></div></div>`;
  panel.hidden=false;byId('aiDraftPanel').hidden=true;
}
function clearPendingAction(){assistantPendingAction=null;const panel=byId('aiPendingActionPanel');if(panel){panel.hidden=true;panel.innerHTML='';}}
async function confirmAssistantPendingAction(){
  const action=assistantPendingAction;if(!action)return;const button=byId('aiPendingActionPanel')?.querySelector('[data-confirm-ai-change]');if(button?.disabled)return;
  if(button){button.disabled=true;button.textContent='校验并保存中…';}
  try{
    if(cloudReady&&currentUser)await loadCloudData({allowMigration:false,silent:true});
    const field=aiChangeTargetFields[action.target],fromValue=aiChangeValue(action),toValue=aiChangeNextValue(action),ids=new Set((action.affected_record_ids||action.affectedRecordIds||[]).map(String));
    if(!field||!fromValue||!toValue||!ids.size)throw new Error('批量修改预览已失效，请重新提交问题');
    const matched=orders.filter(order=>ids.has(String(order.id))&&String(order[field]??'').trim().toLocaleLowerCase()===fromValue.toLocaleLowerCase());
    if(matched.length!==ids.size)throw new Error('订单数据在确认前发生变化，已取消修改，请重新生成预览');
    const before=orders.map(order=>({...order}));orders=orders.map(order=>ids.has(String(order.id))?{...order,[field]:toValue}:order);
    try{await saveOrdersBatch();}catch(error){orders=before;saveLocalOrders();throw error;}
    clearPendingAction();renderAll();const status=byId('aiAccountingStatus');status.textContent=`已完成：${matched.length} 条订单的${aiChangeTargetLabels[action.target]||action.target}已修改为“${toValue}”`;status.className='ai-status success';
  }catch(error){const status=byId('aiAccountingStatus');status.textContent=error.message||'批量修改失败';status.className='ai-status error';if(button){button.disabled=false;button.textContent='确认修改';}}
}
async function parseAiAccounting(){
  const text=byId('aiAccountingText').value.trim(),button=byId('aiParseButton'),status=byId('aiAccountingStatus');if(!text){status.textContent='请先输入一句话';status.className='ai-status error';return;}if(!aiSettings.enabled){status.textContent='请先在右侧启用模型配置';status.className='ai-status error';return;}button.disabled=true;button.textContent='识别中…';status.textContent='正在让模型整理字段…';status.className='ai-status';
  try{const {data:sessionData}=await supabaseClient.auth.getSession();const response=await fetch(`${SUPABASE_URL}/functions/v1/ai-accounting`,{method:'POST',headers:{Authorization:`Bearer ${sessionData.session?.access_token||''}`,'Content-Type':'application/json'},body:JSON.stringify({text,conversation_id:assistantConversationId,...assistantModelContext()})});const result=await response.json();if(!response.ok)throw new Error(result.error||'AI识别失败');aiDraft=result;renderAiDraft();status.textContent=`已生成草稿 · ${aiIntentText(result.data?.intent)} · 请确认后填入表单`;status.className='ai-status success';await saveAssistantMessage('assistant',`已生成${aiIntentText(result.data?.intent)}草稿，请确认后再填入表单。`,{intent:result.data?.intent||'unknown'});}catch(error){status.textContent=error.message;status.className='ai-status error';}finally{button.disabled=false;button.textContent='交给 AI 处理';}
}
function renderGeneralAssistant(result,model='模型回答'){
  const panel=byId('analysisResult');if(!panel)return;const data=result?.data||result||{};const sources=Array.isArray(data.knowledge_sources)?data.knowledge_sources:[];panel.className='analysis-result';panel.hidden=false;panel.innerHTML=`<div class="analysis-answer"><span class="quality-smart-tag">${escapeHtml(model)}</span><p>${escapeHtml(data.answer||'暂时没有可回答的内容。')}</p></div>${sources.length?`<div class="analysis-scope"><strong>参考知识：</strong>${sources.map(source=>escapeHtml(source.title||'未命名知识')).join('、')}</div>`:''}${data.unsupported?'<div class="analysis-scope"><strong>能力边界：</strong>当前没有对应的实时工具，以上不是实时查询结果。</div>':''}`;
}
async function runGeneralAssistant(question){
  const button=byId('aiParseButton'),status=byId('aiAccountingStatus');if(!aiSettings.enabled){status.textContent='请先在右侧启用模型配置';status.className='ai-status error';return;}button.disabled=true;button.textContent='思考中…';status.textContent='正在结合已发布知识和当前对话整理…';status.className='ai-status';
  try{const {data:sessionData}=await supabaseClient.auth.getSession();const response=await fetch(`${SUPABASE_URL}/functions/v1/ai-accounting`,{method:'POST',headers:{Authorization:`Bearer ${sessionData.session?.access_token||''}`,'Content-Type':'application/json'},body:JSON.stringify({mode:'assistant',text:question,conversation_id:assistantConversationId,context_state:assistantContext,history:assistantMessages.slice(-8).map(message=>({role:message.role,content:message.content}))})});const result=await response.json();if(!response.ok)throw new Error(result.error||'AI回答失败');renderGeneralAssistant(result,`AI回答 · ${result.model||'模型'}`);await saveAssistantMessage('assistant',result.data?.answer||'暂时没有可回答的内容。',{intent:'general_assistance',knowledge_sources:result.data?.knowledge_sources||[]});status.textContent='回答完成；涉及实时数据时仍需接入对应工具。';status.className='ai-status success';}catch(error){status.textContent=error.message;status.className='ai-status error';}finally{button.disabled=false;button.textContent='交给 AI 处理';}
}
async function runAssistantChatLegacy(question){
  const button=byId('aiParseButton'),status=byId('aiAccountingStatus');if(!aiSettings.enabled){status.textContent='请先在右侧启用模型配置';status.className='ai-status error';return;}button.disabled=true;button.textContent='处理中…';status.textContent='AI 正在判断任务并调用必要工具…';status.className='ai-status';
  try{const {data:sessionData}=await supabaseClient.auth.getSession();const response=await fetch(`${SUPABASE_URL}/functions/v1/ai-accounting`,{method:'POST',headers:{Authorization:`Bearer ${sessionData.session?.access_token||''}`,'Content-Type':'application/json'},body:JSON.stringify({mode:'chat',text:question,conversation_id:assistantConversationId,...assistantModelContext()})});const result=await response.json();if(!response.ok)throw new Error(result.error||'AI处理失败');const data=result.data||{};if(data.draft){aiDraft={data:data.draft};renderAiDraft();}if(data.analysis){analysisResult=data.analysis;renderAnalysisResult(data.analysis,`确定性工具 · ${result.model||'模型'}`);const summaryCall=(result.tool_calls||[]).find(call=>call.name==='summarize_business');if(summaryCall?.arguments)await saveAssistantContext({date_field:summaryCall.arguments.date_field,period_start:summaryCall.arguments.start||null,period_end:summaryCall.arguments.end||null,order_type:summaryCall.arguments.type||'all',city:summaryCall.arguments.location||'',supplier:summaryCall.arguments.supplier||'',booker:summaryCall.arguments.booker||''});}if(!data.analysis&&!data.draft)renderGeneralAssistant(result,`AI回答 · ${result.model||'模型'}`);const answer=data.analysis?.answer||data.answer||(data.draft?`已生成${aiIntentText(data.draft.intent)}草稿，请确认后再填入表单。`:'当前没有可回答的内容。');await saveAssistantMessage('assistant',answer,{intent:data.analysis?'business_query':data.draft?'accounting_draft':'general_assistance',tool_calls:result.tool_calls||[]});status.textContent=data.analysis?'统计完成，金额和口径来自确定性工具。':data.draft?'已生成草稿，请确认后再填入表单。':'回答完成；涉及实时信息时仍需接入对应工具。';status.className='ai-status success';}catch(error){status.textContent=error.message;status.className='ai-status error';}finally{button.disabled=false;button.textContent='交给 AI 处理';}
}
function clearAiDraftPreview(message='已填入表单，请核对后保存。'){
  aiDraft=null;
  // Keep the static draft controls in the DOM. Clearing innerHTML here removes
  // aiDraftIntent/aiDraftSummary/aiDraftJson, so the next AI draft crashes
  // when renderAiDraft() tries to update those nodes.
  const panel=byId('aiDraftPanel');if(panel)panel.hidden=true;
  const analysis=byId('analysisResult');if(analysis)analysis.hidden=true;
  clearPendingAction();
  const status=byId('aiAccountingStatus');if(status){status.textContent=message;status.className='ai-status success';}
}
function fillFromAiDraft(){
  if(!aiDraft)return;const data=aiDraft.data||aiDraft,order=data.order||{},income=data.income||{};
  if(data.intent==='order'){
    byId('openOrderDialog').click();setOrderType(order.type==='flight'?'flight':'hotel');byId('customer').value=aiValue(order.customer);byId('booker').value=aiValue(order.booker);byId('orderDate').value=aiValue(order.order_date)||today;byId('serviceDate').value=aiValue(order.service_date)||today;byId('location').value=aiValue(order.location);byId('supplier').value=aiValue(order.supplier);byId('product').value=aiValue(order.product);byId('confirmation').value=aiValue(order.confirmation);byId('rooms').value=order.rooms||1;byId('nights').value=order.nights||1;byId('tickets').value=order.tickets||1;byId('gmv').value=order.gmv||0;byId('cost').value=order.cost||0;byId('paymentStatus').value=order.payment_status||'paid';byId('paymentPlatform').value=aiValue(order.payment_platform);byId('orderStatus').value=order.status||'booked';syncSettlementFields();refreshFormPreview();clearAiDraftPreview();showView('orders');return;}
  if(data.intent==='other_income'||data.intent==='other_expense'){openOtherIncomeForm();byId('otherIncomeDate').value=aiValue(income.date)||today;byId('otherIncomeName').value=aiValue(income.name)||'一句话记账';byId('otherIncomePayer').value=aiValue(income.payer);byId('otherIncomePayee').value=aiValue(income.payee);byId('otherIncomeAmount').value=income.amount||0;byId('otherIncomeExpense').value=income.expense||0;byId('otherIncomeNet').textContent=compactCurrency(Number(income.amount||0)-Number(income.expense||0));clearAiDraftPreview();showView('otherIncome');return;}
  const search=aiValue(income.search_text)||aiValue(order.confirmation)||aiValue(order.customer);const candidate=orders.filter(item=>orderSearchText(item).includes(search.toLowerCase()));if(candidate.length===1){openDetails(candidate[0].id);window.alert(`已找到匹配订单 ${orderCode(candidate[0])}，请在详情中登记收款或返佣。`);}else{window.alert('这句话需要关联已有订单，请补充订单编号、确认号或客户姓名后再识别。');}
}
let currentProfile = null;
let currentFeatures = new Set();
let adminUsers = [];
let selectedAdminUserId = null;

const featureForView = { dashboard:'dashboard.view', orders:'orders.view', ledger:'ledger.view', otherIncome:'other_income.manage', quality:'quality.view', ai:'ai.use', knowledge:'knowledge.read', memory:'ai.use', settings:'settings.manage', admin:'users.manage' };
const canFeature = feature => currentProfile?.role === 'admin' || (currentProfile?.account_status === 'approved' && currentFeatures.has(feature));
const featureText = status => ({pending:'待审核', approved:'已通过', rejected:'已拒绝', suspended:'已暂停'})[status] || status || '未知';

async function loadAccessProfile(){
  if(!currentUser||!supabaseClient)return null;
  const profileResult=await supabaseClient.from('profiles').select('user_id,email,display_name,role,account_status,approved_at,approved_by,rejected_reason,created_at,updated_at').eq('user_id',currentUser.id).maybeSingle();
  if(profileResult.error)throw profileResult.error;
  currentProfile=profileResult.data;
  currentFeatures=new Set();
  if(currentProfile?.account_status==='approved'){
    const permissions=await supabaseClient.from('user_feature_permissions').select('feature_key').eq('user_id',currentUser.id).eq('enabled',true);
    if(permissions.error)throw permissions.error;
    currentFeatures=new Set((permissions.data||[]).map(item=>item.feature_key));
  }
  return currentProfile;
}
async function checkCurrentAccountStatus(){
  if(!currentUser||!supabaseClient)return;
  try{
    const profile=await loadAccessProfile();
    if(profile?.account_status!=='approved'){
      if(accountStatusTimer){clearInterval(accountStatusTimer);accountStatusTimer=null;}
      window.alert('当前账号已被暂停或取消审核，请联系管理员。');
      await supabaseClient.auth.signOut();
      return;
    }
    applyFeatureVisibility();
  }catch(error){console.warn('Account status check failed',error.message);}
}
function startAccountStatusMonitor(){
  if(accountStatusTimer)clearInterval(accountStatusTimer);
  accountStatusTimer=setInterval(checkCurrentAccountStatus,60000);
}

function showApprovalUI(show){
  byId('approvalShell').hidden=!show;
  byId('authShell').hidden=show||Boolean(currentUser);
  byId('registerShell').hidden=show||Boolean(currentUser)||byId('registerShell').dataset.open!=='true';
  byId('resetShell').hidden=show||Boolean(currentUser);
  byId('recoveryShell').hidden=show||Boolean(currentUser);
  byId('appShell').hidden=show||!currentUser;
  if(show){byId('approvalEmail').textContent=currentUser?.email||'';byId('approvalStatus').textContent=`当前状态：${featureText(currentProfile?.account_status)}`;}
}

function applyFeatureVisibility(){
  document.querySelectorAll('[data-view]').forEach(item=>{const feature=featureForView[item.dataset.view];item.hidden=Boolean(feature&&!canFeature(feature));});
  document.querySelectorAll('.admin-only').forEach(item=>{item.hidden=currentProfile?.role!=='admin';});
  byId('migrateLocalData')?.classList.toggle('hidden',!canFeature('orders.import'));
}

function setSyncStatus(message, state='') { const element=byId('cloudStatus'); if(!element)return; element.textContent=message; element.className=state; }
function setAuthStatus(message, state='') { const element=byId('authStatus'); if(!element)return; element.textContent=message; element.className=state ? `auth-status-${state}` : ''; }
function showAuthenticatedUI(isAuthenticated) { byId('authShell').hidden=isAuthenticated; byId('registerShell').hidden=isAuthenticated||byId('registerShell').dataset.open!=='true'; byId('resetShell').hidden=isAuthenticated; byId('recoveryShell').hidden=isAuthenticated; byId('appShell').hidden=!isAuthenticated; }
function showRegisterUI(show){
  const shell=byId('registerShell');
  if(!shell)return;
  shell.dataset.open=show?'true':'';
  shell.hidden=!show||Boolean(currentUser);
  byId('authShell').hidden=show||Boolean(currentUser);
  byId('resetShell').hidden=show||Boolean(currentUser);
  byId('recoveryShell').hidden=show||Boolean(currentUser);
  if(show){
    const loginEmail=byId('authEmail')?.value.trim();
    if(loginEmail&&!byId('registerEmail').value)byId('registerEmail').value=loginEmail;
    byId('registerPassword').value='';
    byId('registerPasswordConfirm').value='';
    byId('registerStatus').textContent='';
    setTimeout(()=>byId('registerEmail')?.focus(),0);
  }
}
function showResetUI(show){
  byId('resetShell').hidden=!show||Boolean(currentUser);
  byId('authShell').hidden=show||Boolean(currentUser);
  byId('registerShell').hidden=show||Boolean(currentUser);
  byId('recoveryShell').hidden=true;
  if(show){
    byId('resetEmail').value=byId('authEmail')?.value.trim()||'';
    byId('resetStatus').textContent='';
    setTimeout(()=>byId('resetEmail')?.focus(),0);
  }
}
function showPasswordRecoveryUI(show){
  byId('authShell').hidden=show||Boolean(currentUser);
  byId('registerShell').hidden=show||Boolean(currentUser);
  byId('resetShell').hidden=show||Boolean(currentUser);
  byId('recoveryShell').hidden=!show;
  if(show){
    byId('recoveryPassword').value='';
    byId('recoveryPasswordConfirm').value='';
    byId('recoveryStatus').textContent='';
    setTimeout(()=>byId('recoveryPassword')?.focus(),0);
  }
}
async function loadCloudData({ allowMigration=true, silent=false }={}) {
  if (!currentUser || !supabaseClient) return;
  const [ordersResult, incomesResult] = await Promise.all([
    supabaseClient.from('orders').select('*').order('order_date', { ascending: false }),
    supabaseClient.from('other_income').select('*').order('income_date', { ascending: false })
  ]);
  if (ordersResult.error) throw ordersResult.error;
  if (incomesResult.error) throw incomesResult.error;
  orders = (ordersResult.data || []).map(rowToOrder);
  otherIncomes = (incomesResult.data || []).map(rowToOtherIncome);
  cloudReady = true;
  saveLocalOrders(); saveLocalOtherIncomes();
  setSyncStatus(`云端数据 · ${orders.length} 笔订单`, 'synced');
  renderAll();
  // 多用户模式下禁止登录后自动迁移本地数据，避免把上一个账号的数据上传到当前账号。
  if (!silent) setAuthStatus('已连接云端', 'success');
}
async function migrateLocalData() {
  if (!currentUser || !supabaseClient) return;
  if (!localOrders.length && !localOtherIncomes.length) { window.alert('当前浏览器没有可上传的本地数据。'); return; }
  if (!window.confirm(`确认上传本地数据？\n订单：${localOrders.length} 笔\n其它收入：${localOtherIncomes.length} 笔\n\n云端已有同编号记录会更新，不同编号记录会保留。`)) return;
  cloudBusy = true; setSyncStatus('正在上传本地数据…', 'syncing');
  try {
    if (localOrders.length) { orders = localOrders.map(order => ({ ...order })); const { error } = await supabaseClient.from('orders').upsert(orders.map(orderToRow), { onConflict: 'user_id,id' }); if (error) throw error; }
    if (localOtherIncomes.length) { otherIncomes = localOtherIncomes.map(item => ({ ...item })); const { error } = await supabaseClient.from('other_income').upsert(otherIncomes.map(otherIncomeToRow), { onConflict: 'user_id,id' }); if (error) throw error; }
    await loadCloudData({ allowMigration:false });
    window.alert('本地数据已上传到云端。');
  } catch (error) { setSyncStatus(`上传失败：${error.message}`, 'sync-error'); window.alert(`上传失败：${error.message}`); }
  finally { cloudBusy=false; }
}
function applyRealtimeOrderChange(payload) {
  if (!payload?.eventType) return;
  const row=payload.eventType==='DELETE' ? payload.old : payload.new;
  if (!row?.id) return;
  if (payload.eventType==='DELETE') orders=orders.filter(order=>order.id!==row.id);
  else {
    const next=rowToOrder(row); const index=orders.findIndex(order=>order.id===next.id);
    if (index>=0) orders[index]=next; else orders.push(next);
  }
  saveLocalOrders(); renderAll();
}
function applyRealtimeIncomeChange(payload) {
  if (!payload?.eventType) return;
  const row=payload.eventType==='DELETE' ? payload.old : payload.new;
  if (!row?.id) return;
  if (payload.eventType==='DELETE') otherIncomes=otherIncomes.filter(item=>item.id!==row.id);
  else {
    const next=rowToOtherIncome(row); const index=otherIncomes.findIndex(item=>item.id===next.id);
    if (index>=0) otherIncomes[index]=next; else otherIncomes.push(next);
  }
  saveLocalOtherIncomes(); renderAll();
}
async function setupRealtime() {
  if (!supabaseClient || !currentUser) return;
  if (realtimeChannel) await supabaseClient.removeChannel(realtimeChannel);
  realtimeChannel = supabaseClient.channel(`ledger-sync-${currentUser.id}`)
    .on('postgres_changes', { event:'*', schema:'public', table:'orders', filter:`user_id=eq.${currentUser.id}` }, payload => applyRealtimeOrderChange(payload))
    .on('postgres_changes', { event:'*', schema:'public', table:'other_income', filter:`user_id=eq.${currentUser.id}` }, payload => applyRealtimeIncomeChange(payload))
    .subscribe();
}
async function handleSession(session, authEvent='') {
  if(authEvent==='PASSWORD_RECOVERY'){
    currentUser=session?.user||null;
    showAuthenticatedUI(false);showApprovalUI(false);showPasswordRecoveryUI(true);
    return;
  }
  const sessionKey=session?.user?.id||'guest';if(sessionKey===lastHandledSessionKey)return;lastHandledSessionKey=sessionKey;
  currentUser = session?.user || null;
  AI_SETTINGS_STORAGE_KEY=aiSettingsStorageKey();
  if (!currentUser) {
    if(accountStatusTimer){clearInterval(accountStatusTimer);accountStatusTimer=null;}
    currentProfile=null; currentFeatures=new Set(); cloudReady=false; qualityActions={}; qualityActionsCloudAvailable=false; orders=[]; otherIncomes=[]; assistantMemories=[]; assistantMemoryDraft=null; showApprovalUI(false); showAuthenticatedUI(false); setAuthStatus(''); AI_SETTINGS_STORAGE_KEY='qizhang-ai-settings-draft-guest';
    if (realtimeChannel && supabaseClient) { await supabaseClient.removeChannel(realtimeChannel); realtimeChannel=null; }
    return;
  }
  showAuthenticatedUI(true); byId('currentUserEmail').textContent=currentUser.email || ''; setSyncStatus('正在检查账户权限…', 'syncing');
  try {
    await loadAccessProfile();
    applyFeatureVisibility();
    if(currentProfile?.account_status!=='approved'){
      showApprovalUI(true);
      return;
    }
    showApprovalUI(false); setSyncStatus('正在读取云端数据…', 'syncing');
    await loadCloudData({allowMigration:false}); await loadQualityActions(); await setupRealtime(); await loadAiSettings(); await loadAssistantWorkspace();
    startAccountStatusMonitor();
    applyFeatureVisibility();
    if(!canFeature('dashboard.view')){const fallback=Object.entries(featureForView).find(([view,feature])=>view!=='admin'&&canFeature(feature));if(fallback)showView(fallback[0]);}
  } catch (error) { cloudReady=false; setSyncStatus(`云端连接失败：${error.message}`, 'sync-error'); window.alert(`云端数据库还未准备好或连接失败：${error.message}\n\n请先完成最新的多用户权限迁移。`); renderAll(); }
}
async function signIn() {
  if (!supabaseClient) { setAuthStatus('Supabase 客户端未加载，请检查网络后刷新。', 'error'); return; }
  const email=byId('authEmail').value.trim(), password=byId('authPassword').value;
  setAuthStatus('正在登录…'); byId('authSubmit').disabled=true;
  const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
  byId('authSubmit').disabled=false;
  if (error) setAuthStatus(error.message, 'error');
}
async function signUp() {
  if (!supabaseClient) { setAuthStatus('Supabase 客户端未加载，请检查网络后刷新。', 'error'); return; }
  const email=byId('registerEmail').value.trim(), password=byId('registerPassword').value, confirmation=byId('registerPasswordConfirm').value, status=byId('registerStatus'), button=byId('registerSubmit');
  if (!email || password.length < 6) { status.textContent='请先填写邮箱和至少 6 位密码。'; status.className='auth-status auth-status-error'; return; }
  if(password!==confirmation){ status.textContent='两次输入的密码不一致。'; status.className='auth-status auth-status-error'; return; }
  status.textContent='正在提交注册…'; status.className='auth-status'; button.disabled=true;
  const { data, error } = await supabaseClient.auth.signUp({ email, password });
  button.disabled=false;
  if (error) { status.textContent=error.message; status.className='auth-status auth-status-error'; return; }
  byId('authEmail').value=email; byId('authPassword').value=''; showRegisterUI(false);
  setAuthStatus(data.session?'注册成功，正在进入系统…':'注册成功，请查收邮箱并完成验证后再登录。', 'success');
}
async function requestPasswordReset(){
  if(!supabaseClient)return;
  const email=byId('resetEmail').value.trim(), status=byId('resetStatus'), button=byId('resetSubmit');
  if(!email){status.textContent='请先填写注册邮箱。';status.className='auth-status auth-status-error';return;}
  status.textContent='正在发送重置链接…';status.className='auth-status';button.disabled=true;
  const {error}=await supabaseClient.auth.resetPasswordForEmail(email,{redirectTo:window.location.href});
  button.disabled=false;
  if(error){status.textContent=error.message;status.className='auth-status auth-status-error';return;}
  showResetUI(false);setAuthStatus('重置链接已发送，请检查邮箱。','success');
}
async function updatePasswordFromRecovery(){
  const password=byId('recoveryPassword').value, confirmation=byId('recoveryPasswordConfirm').value, status=byId('recoveryStatus'), button=byId('recoverySubmit');
  if(password.length<6){status.textContent='密码至少需要 6 位。';status.className='auth-status auth-status-error';return;}
  if(password!==confirmation){status.textContent='两次输入的密码不一致。';status.className='auth-status auth-status-error';return;}
  status.textContent='正在保存…';status.className='auth-status';button.disabled=true;
  const {error}=await supabaseClient.auth.updateUser({password});button.disabled=false;
  if(error){status.textContent=error.message;status.className='auth-status auth-status-error';return;}
  await supabaseClient.auth.signOut();
  setAuthStatus('密码已更新，请使用新密码登录。','success');
}
async function changePassword(){
  const password=byId('changePassword').value, confirmation=byId('changePasswordConfirm').value, status=byId('changePasswordMessage'), button=byId('changePasswordForm button[type="submit"]');
  if(password.length<6){status.textContent='密码至少需要 6 位。';status.className='ai-status error';return;}
  if(password!==confirmation){status.textContent='两次输入的密码不一致。';status.className='ai-status error';return;}
  button.disabled=true;status.textContent='正在保存…';status.className='ai-status';
  const {error}=await supabaseClient.auth.updateUser({password});button.disabled=false;
  if(error){status.textContent=error.message;status.className='ai-status error';return;}
  byId('changePasswordForm').reset();status.textContent='密码已更新。';status.className='ai-status success';
}
async function signOut() { if (supabaseClient) await supabaseClient.auth.signOut(); }
const issueEntries = () => orders.flatMap(order => {
  if (payment(order) === 'refunded' || ['cancelled', 'refunded'].includes(order.status)) return [];
  const issues = [...(order.issues || [])];
  if (!isCommissionOrder(order) && !order.cost && order.gmv) issues.push('成本金额为 0');
  if (!order.serviceDate) issues.push('缺少业务日期');
  const servicePassed=Boolean(order.serviceDate&&order.serviceDate<today);
  if (isCommissionOrder(order) && commissionOutstanding(order)>0) { issues.push(servicePassed?'返佣逾期':'存在待返佣'); }
  else {
    if (customerReceivable(order)) issues.push(servicePassed&&order.type==='hotel'?'已入住未收款':servicePassed&&order.type==='flight'&&order.status==='ticketed'?'已出票未收款':'客户存在待收款');
    if (supplierPayable(order)) issues.push('供应商 / 平台待付款');
  }
  if (!isCommissionOrder(order) && Number(order.gmv||0)>0 && Number(order.cost||0)>Number(order.gmv||0)) issues.push('成本高于 GMV');
  if (!isCommissionOrder(order) && order.profitOverride!==null && order.profitOverride!==undefined && Math.abs(Number(order.profitOverride)-(Number(order.gmv||0)-Number(order.cost||0)))>0.01) issues.push('利润与 GMV/成本不一致');
  if (!isCommissionOrder(order) && customerPaymentStatus(order) === 'unknown') issues.push('客户收款状态待核对');
  return [...new Set(issues)].map(issue => ({ order, issue }));
});

function filteredOrders() {
  return orders.filter(order => { const date=order[dateField]||''; return (activeType === 'all' || order.type === activeType) && (statusFilter==='all'||order.status===statusFilter) && (paymentFilter==='all'||customerPaymentStatus(order)===paymentFilter) && (supplierPaymentFilter==='all'||supplierPaymentStatus(order)===supplierPaymentFilter) && (invoiceFilter==='all'||invoiceStatus(order)===invoiceFilter) && `${order.customer} ${order.booker} ${order.supplier} ${order.product} ${order.confirmation} ${order.location}`.toLowerCase().includes(searchTerm.toLowerCase()) && String(order.location||'').toLowerCase().includes(locationFilter.toLowerCase()) && String(order.supplier||'').toLowerCase().includes(supplierFilter.toLowerCase()) && (!dateStart || date>=dateStart) && (!dateEnd || date<=dateEnd); });
}
function updateStatusOptions(){const type=byId('typeSelect').value;const options=[['all','全部状态'],...(type==='flight'?[['pending','待出票'],['ticketed','已出票'],['refunded','已退票']]:type==='hotel'?[['booked','预订中'],['confirming','确认中'],['confirmed','已确认'],['cancelled','已取消']]:[['booked','预订中'],['confirming','确认中'],['confirmed','已确认'],['cancelled','已取消'],['pending','待出票'],['ticketed','已出票'],['refunded','已退票']])];byId('statusFilter').innerHTML=options.map(([v,t])=>`<option value="${v}">${t}</option>`).join('');if(options.some(([v])=>v===statusFilter))byId('statusFilter').value=statusFilter;else{statusFilter='all';byId('statusFilter').value='all';}}
function syncDashboardMonthPicker() {
  const select=byId('periodSelect'); const month=byId('periodMonth');
  if(!month.value) month.value=today.slice(0,7);
  if(select.value==='current') month.value=today.slice(0,7);
  month.disabled=select.value==='all';
}
function dashboardOrders() { const period=byId('periodSelect').value; const month=period==='current'?today.slice(0,7):byId('periodMonth').value; return period==='all' ? orders : orders.filter(order => (order[dashboardDateField] || '').slice(0, 7) === month); }
function dashboardOtherIncomes() { const period=byId('periodSelect').value; const month=period==='current'?today.slice(0,7):byId('periodMonth').value; return period==='all' ? otherIncomes : otherIncomes.filter(item => (item.date || '').slice(0, 7) === month); }
function otherIncomeNet(item) { return Number(item.amount || 0) - Number(item.expense || 0); }
function transactionRows() {
  const orderRows=dashboardOrders().flatMap(order => {
    const rows = [];
    if (isCommissionOrder(order)) { if (commissionReceived(order)) rows.push({ date: order.commissionReceivedDate || order.orderDate || order.serviceDate, kind:'平台返佣', amount:commissionReceived(order), party:order.commissionPlatform||order.supplier, note:`佣金到账 · ${order.confirmation||orderCode(order)}`, order }); if (directCost(order)) rows.push({ date: order.orderDate || order.serviceDate, kind:'直接费用', amount:-directCost(order), party:order.supplier, note:'返佣订单直接费用', order }); }
    else { if (order.received) rows.push({ date: order.orderDate || order.serviceDate, kind:'收款', amount:Number(order.received), party:order.customer, note:'订单收款', order }); if (order.cost) rows.push({ date: order.orderDate || order.serviceDate, kind:'成本付款', amount:-Number(order.cost), party:order.supplier, note:'供应商结算', order }); }
    return rows;
  });
  const otherRows=otherIncomes.map(item=>{const linked=incomeOrderIds(item).map(id=>orders.find(order=>order.id===id)).filter(Boolean);return [{date:item.date,kind:'其它收入',amount:Number(item.amount||0),party:item.payer||item.name,note:linked.length?`关联 ${linked.map(order=>orderCode(order)).join('、')}`:'未关联订单',order:{id:item.id}} , item.expense?{date:item.date,kind:'其它支出',amount:-Number(item.expense),party:item.payee||item.name,note:'其它收入支出',order:{id:item.id}}:null].filter(Boolean)}).flat();
  return [...orderRows,...otherRows].sort((a,b) => (b.date || '').localeCompare(a.date || ''));
}
function sums(list) { return list.reduce((acc, order) => ({ gmv:acc.gmv + Number(order.gmv), cost:acc.cost + Number(order.cost), profit:acc.profit + profit(order), received:acc.received + Number(order.received) }), {gmv:0,cost:0,profit:0,received:0}); }

// Keep the ledger on the same basis as the split payment fields. The legacy
// renderer above is retained for compatibility, then replaced here so partial
// supplier payments never appear as a full cost payment.
function transactionRowsWithSplit() {
  const orderRows = dashboardOrders().flatMap(order => {
    const rows = [];
    if (isCommissionOrder(order)) {
      if (commissionReceived(order)) rows.push({ date: order.commissionReceivedDate || order.orderDate || order.serviceDate, kind:'\u5e73\u53f0\u8fd4\u4f63', amount:commissionReceived(order), party:order.commissionPlatform||order.supplier, note:`\u4f63\u91d1\u5230\u8d26 \u00b7 ${order.confirmation||orderCode(order)}`, order });
      if (directCost(order)) rows.push({ date: order.orderDate || order.serviceDate, kind:'\u76f4\u63a5\u8d39\u7528', amount:-directCost(order), party:order.supplier, note:'\u8fd4\u4f63\u8ba2\u5355\u76f4\u63a5\u8d39\u7528', order });
    } else {
      if (order.received) rows.push({ date: order.orderDate || order.serviceDate, kind:'\u6536\u6b3e', amount:Number(order.received), party:order.customer, note:'\u8ba2\u5355\u6536\u6b3e', order });
      if (supplierPaid(order)) rows.push({ date: order.orderDate || order.serviceDate, kind:'\u6210\u672c\u4ed8\u6b3e', amount:-supplierPaid(order), party:order.supplier, note:'\u4f9b\u5e94\u5546\u7ed3\u7b97', order });
    }
    return rows;
  });
  const otherRows = otherIncomes.map(item => {
    const linked = incomeOrderIds(item).map(id => orders.find(order => order.id===id)).filter(Boolean);
    return [{ date:item.date, kind:'\u5176\u4ed6\u6536\u5165', amount:Number(item.amount||0), party:item.payer||item.name, note:linked.length?`\u5173\u8054 ${linked.map(order=>orderCode(order)).join('\u3001')}`:'\u672a\u5173\u8054\u8ba2\u5355', order:{id:item.id} }, item.expense?{ date:item.date, kind:'\u5176\u4ed6\u652f\u51fa', amount:-Number(item.expense), party:item.payee||item.name, note:'\u5176\u4ed6\u6536\u5165\u652f\u51fa', order:{id:item.id} }:null].filter(Boolean);
  }).flat();
  return [...orderRows,...otherRows].sort((a,b)=>(b.date||'').localeCompare(a.date||''));
}
transactionRows = transactionRowsWithSplit;

function renderDashboard() {
  syncDashboardMonthPicker();
  const data = dashboardOrders(); const total = sums(data);
  const incomeData = dashboardOtherIncomes(); const otherIncomeTotal = incomeData.reduce((sum,item)=>sum+Number(item.amount||0),0); const otherExpenseTotal = incomeData.reduce((sum,item)=>sum+Number(item.expense||0),0); const otherNet = incomeData.reduce((sum,item)=>sum+otherIncomeNet(item),0); const combinedNet = total.profit+otherNet;
  const hotels = data.filter(o => o.type === 'hotel'); const flights = data.filter(o => o.type === 'flight');
  const period=byId('periodSelect').value; const selectedMonth=byId('periodMonth').value; const periodLabel=period==='all'?'全部数据':period==='current'?'本月':selectedMonth?`${selectedMonth.slice(0,4)}年${Number(selectedMonth.slice(5,7))}月`:'指定月份';
  byId('heroPeriodLabel').textContent=`${periodLabel}综合净收益`;
  byId('heroGmv').textContent = compactCurrency(combinedNet);
  byId('heroMeta').textContent = `订单业务利润 ${compactCurrency(total.profit)} · 其它收入净额 ${compactCurrency(otherNet)} · ${data.length} 笔订单 / ${incomeData.length} 笔其它收入`;
  byId('heroMargin').textContent = total.gmv ? `${(total.profit / total.gmv * 100).toFixed(1)}%` : '—';
  byId('orderProfit').textContent=compactCurrency(total.profit); byId('dashboardOtherIncomeNet').textContent=compactCurrency(otherNet); byId('combinedNetProfit').textContent=compactCurrency(combinedNet);
  byId('otherIncomeHint').textContent=`收入 ${compactCurrency(otherIncomeTotal)} · 支出 ${compactCurrency(otherExpenseTotal)}`;
  byId('hotelOrders').textContent = hotels.length; byId('hotelOrderHint').textContent = `${compactCurrency(sums(hotels).gmv)} GMV`;
  byId('roomNights').textContent = hotels.reduce((n,o)=>n+roomNights(o),0);
  byId('flightOrders').textContent = flights.length; byId('flightOrderHint').textContent = `${compactCurrency(sums(flights).gmv)} GMV`;
  byId('ticketCount').textContent = flights.reduce((n,o)=>n+Number(o.tickets||0),0);
  const outstanding = data.filter(customerReceivable); const due = outstanding.reduce((n,o)=>n+Math.max(0,o.gmv-o.received),0); const payable = data.filter(supplierPayable); const payableDue=payable.reduce((n,o)=>n+Math.max(0,Number(o.cost||0)-supplierPaid(o)),0); const commissionDue=data.filter(isCommissionOrder).reduce((n,o)=>n+commissionOutstanding(o),0); const commissionOrders=data.filter(o=>isCommissionOrder(o)&&commissionOutstanding(o)>0).length;
  byId('receivable').textContent = compactCurrency(due); byId('receivableHint').textContent = `${outstanding.length} 笔需跟进`; byId('payable').textContent=compactCurrency(payableDue); byId('payableHint').textContent=`${payable.length} 笔需跟进`; byId('commissionReceivable').textContent=compactCurrency(commissionDue); byId('commissionReceivableHint').textContent=`${commissionOrders} 笔待到账`;
  renderTrend(); renderQueue(); renderRanking(); renderBookerRanking(); renderRecentLedger(); renderPaymentPlatformDistribution();
}
function renderTrend() {
  const monthly = {};
  dashboardOrders().forEach(o => { const key=(o[dashboardDateField] || '').slice(0,7) || '—'; monthly[key] ||= {gmv:0,profit:0}; monthly[key].gmv += Number(o.gmv); monthly[key].profit += profit(o); });
  const items=Object.entries(monthly).sort(([a],[b])=>a.localeCompare(b)).slice(-6); const max=Math.max(...items.map(([,v])=>v.gmv),1);
  byId('trendChart').innerHTML=items.map(([month,v],index)=>{const [year,monthNumber]=month.split('-');const label=year&&monthNumber?`${year}年${Number(monthNumber)}月`:month;const gmvHeight=Math.max(4,v.gmv/max*100),profitHeight=Math.max(3,v.profit/max*100);return `<div class="bar-col" data-month="${label}" style="--bar-delay:${index*70}ms"><div class="bar-tooltip"><b>${label}</b><span>GMV ${compactCurrency(v.gmv)}</span><span>利润 ${compactCurrency(v.profit)}</span></div><div class="bar-pair"><span class="bar gmv" title="GMV ${compactCurrency(v.gmv)}" style="height:${gmvHeight}%"></span><span class="bar profit" title="利润 ${compactCurrency(v.profit)}" style="height:${profitHeight}%"></span></div><div class="bar-values"><span>${compactCurrency(v.gmv)}</span><span>${compactCurrency(v.profit)}</span></div></div>`}).join('') || '<div class="empty-state">暂无趋势数据</div>';
}
function renderQueue() {
  const issues=issueEntries().slice(0,5); byId('issueCount').textContent=issueEntries().length;
  byId('actionQueue').innerHTML=issues.length?issues.map(({order,issue})=>`<button class="action-row" data-detail="${order.id}"><span class="badge ${issue.includes('待收')?'warn':''}">${typeName(order)}</span><span><p>${issue}</p><small>${order.id} · ${order.customer}</small></span></button>`).join(''):'<div class="empty-state">暂无待处理事项</div>';
}
function renderRanking() {
  const ranked=Object.values(orders.filter(o=>o.type==='hotel').reduce((map,o)=>{(map[o.supplier] ||= 0);map[o.supplier]+=Number(o.gmv);return map},{})).length;
  const list=Object.entries(dashboardOrders().filter(o=>o.type==='hotel').reduce((map,o)=>{map[o.supplier]=(map[o.supplier]||0)+Number(o.gmv);return map},{})).sort((a,b)=>b[1]-a[1]).slice(0,10);
  const max=list[0]?.[1]||1; byId('hotelRanking').innerHTML=list.map(([name,amount],i)=>`<div class="rank-row"><b>0${i+1}</b><div><span class="rank-name">${name}</span><div class="rank-line"><span style="width:${amount/max*100}%"></span></div></div><strong>${compactCurrency(amount)}</strong></div>`).join('') || '<div class="empty-state">暂无酒店订单</div>';
}
function renderBookerRanking() {
  const bookerMap=dashboardOrders().reduce((map,order)=>{const name=String(order.booker||'未填写').trim()||'未填写';const item=map[name]||{gmv:0,orders:0};item.gmv+=Number(order.gmv||0);item.orders+=1;map[name]=item;return map},{});
  const list=Object.entries(bookerMap).sort((a,b)=>b[1].gmv-a[1].gmv).slice(0,10);const max=list[0]?.[1].gmv||1;
  byId('bookerRanking').innerHTML=list.map(([name,item],i)=>`<div class="rank-row booker-rank-row"><b>${String(i+1).padStart(2,'0')}</b><div><span class="rank-name" title="${name}">${name}</span><div class="rank-line"><span style="width:${item.gmv/max*100}%"></span></div><small class="rank-sub">${item.orders} 笔订单</small></div><strong>${compactCurrency(item.gmv)}</strong></div>`).join('')||'<div class="empty-state">暂无预订人数据</div>';
}
function renderPaymentPlatformDistribution() {
  const platformMap=dashboardOrders().reduce((map,order)=>{const platform=String(order.paymentPlatform||'未填写平台').trim()||'未填写平台';map[platform]=(map[platform]||0)+Number(order.gmv||0);return map},{});
  const sorted=Object.entries(platformMap).sort((a,b)=>b[1]-a[1]);const total=sorted.reduce((sum,[,value])=>sum+value,0);const top=sorted.slice(0,7);const rest=sorted.slice(7).reduce((sum,[,value])=>sum+value,0);if(rest>0)top.push(['其他',rest]);
  const colors=['#1f5b4e','#bd843b','#6d9b8d','#d6b47a','#8b6d4b','#47796f','#b6c9c0','#d8d1c4'];let cursor=0;const stops=top.map(([name,value],index)=>{const start=cursor;cursor+=total?value/total*360:0;return `${colors[index%colors.length]} ${start}deg ${cursor}deg`;});
  byId('platformTotal').textContent=compactCurrency(total);byId('platformDonut').style.background=top.length?`conic-gradient(${stops.join(',')})`:'conic-gradient(#ded7c7 0deg 360deg)';byId('platformLegend').innerHTML=top.map(([name,value],index)=>{const share=total?Math.round(value/total*100):0;return `<div class="city-legend-row" title="${name} · ${compactCurrency(value)}" style="--legend-delay:${index*65}ms;--city-share:${share}%;color:${colors[index%colors.length]}"><i style="background:${colors[index%colors.length]}"></i><span>${name}</span><b>${share}%</b></div>`}).join('')||'<div class="empty-state">暂无付款平台数据</div>';
}
function renderCityDistribution() {
  const cityMap=dashboardOrders().reduce((map,order)=>{const city=String(order.location||'未填写').trim()||'未填写';map[city]=(map[city]||0)+Number(order.gmv||0);return map},{});
  const sorted=Object.entries(cityMap).sort((a,b)=>b[1]-a[1]);const total=sorted.reduce((n,[,value])=>n+value,0);const top=sorted.slice(0,7);const rest=sorted.slice(7).reduce((n,[,value])=>n+value,0);if(rest>0)top.push(['其他',rest]);const colors=['#1f5b4e','#bd843b','#6d9b8d','#d6b47a','#8b6d4b','#47796f','#b6c9c0','#d8d1c4'];let cursor=0;const stops=top.map(([city,value],index)=>{const start=cursor;cursor+=total?value/total*360:0;return `${colors[index%colors.length]} ${start}deg ${cursor}deg`;});byId('cityTotal').textContent=compactCurrency(total);byId('cityDonut').style.background=top.length?`conic-gradient(${stops.join(',')})`:'conic-gradient(#ded7c7 0deg 360deg)';byId('cityLegend').innerHTML=top.map(([city,value],index)=>{const share=total?Math.round(value/total*100):0;return `<div class="city-legend-row" title="${city} · ${compactCurrency(value)}" style="--legend-delay:${index*65}ms;--city-share:${share}%;color:${colors[index%colors.length]}"><i style="background:${colors[index%colors.length]}"></i><span>${city}</span><b>${share}%</b></div>`}).join('')||'<div class="empty-state">暂无城市数据</div>';
}
function renderRecentLedger() { byId('recentLedger').innerHTML=transactionRows().slice(0,4).map(row=>`<div class="mini-ledger-row"><div><p>${row.kind} · ${row.party}</p><small>${dateFmt(row.date)} · ${row.order.id}</small></div><strong class="amount ${row.amount>=0?'income':'expense'}">${row.amount>=0?'+':'−'}${compactCurrency(Math.abs(row.amount))}</strong></div>`).join('') || '<div class="empty-state">暂无资金流水</div>'; }

function renderOrders() {
  const list=filteredOrders().sort((a,b)=>((b[dateField] || b.orderDate || b.serviceDate || '')).localeCompare(a[dateField] || a.orderDate || a.serviceDate || ''));
  const pageCount=Math.ceil(list.length/ORDER_PAGE_SIZE); orderPage=Math.min(orderPage,pageCount||1);
  const pageList=list.slice((orderPage-1)*ORDER_PAGE_SIZE,orderPage*ORDER_PAGE_SIZE);
  byId('orderTable').innerHTML=pageList.map(order=>{const isHotel=order.type==='hotel'; const invoiceState=invoiceStatus(order); return `<tr class="clickable ${paymentIssue(order)?'unpaid-order':''}" data-detail="${order.id}"><td><span class="order-code">${orderCode(order)}</span><small class="order-status">${statusText(order)}</small></td><td>${dateFmt(order.orderDate || order.serviceDate)}</td><td>${dateFmt(order.serviceDate)}</td><td class="entity-cell"><strong>${order.customer}</strong><small>${order.booker||'—'}</small></td><td>${order.location||'—'}</td><td class="entity-cell"><strong>${order.supplier}</strong><small>${typeName(order)}</small></td><td class="entity-cell product-cell"><strong>${order.product||'—'}</strong>${order.confirmation?`<small class="confirmation-line">确认号：${order.confirmation}</small>`:''}</td><td>${isHotel?`${order.rooms||1} 间 × ${order.nights||0} 晚`:`${order.tickets||0} 张`}</td><td class="money">${compactCurrency(order.gmv)}</td><td class="money ${profit(order)>=0?'profit-positive':'profit-negative'}">${compactCurrency(profit(order))}</td><td><span class="status ${payment(order)}">${paymentText(order)}</span>${isCommissionOrder(order)?`<small class="payment-platform">${commissionStatusText(order)}</small>`:`<small class="payment-platform">供应商：${supplierPaymentText(order)}</small><small class="payment-platform">${order.paymentPlatform||'未填付款方式'}</small>`}<small class="settlement-badge">${settlementText(order)}</small></td><td><span class="status ${invoiceState==='issued'?'paid':invoiceState==='no_invoice'?'invoice-no-invoice':'pending'}">${invoiceText(order)}</span>${invoiceState==='issued'&&order.invoiceCompany?`<small class="invoice-company">${order.invoiceCompany}</small>`:''}</td><td><button class="arrow" aria-label="查看订单">›</button></td></tr>`}).join('') || '<tr><td colspan="13"><div class="empty-state">未找到订单</div></td></tr>';
  byId('mobileOrderList').innerHTML=pageList.map(order=>{const isHotel=order.type==='hotel';return `<article class="mobile-order-card ${payment(order)==='unpaid'?'unpaid-order':''}" data-detail="${order.id}"><div class="mobile-order-head"><div><div class="mobile-order-code">${orderCode(order)}</div><div class="mobile-order-title">${order.supplier||'待确认'}</div><div class="mobile-order-subtitle"><span>${order.product||typeName(order)}</span>${order.confirmation?`<span class="mobile-order-confirmation">确认号：${order.confirmation}</span>`:''}<span>客户：${order.customer||'待补客户'}</span></div></div><span class="status ${payment(order)}">${paymentText(order)}</span></div><div class="mobile-order-meta"><span>下单日期<b>${dateFmt(order.orderDate||order.serviceDate)}</b></span><span>${isHotel?'入住日期':'出发日期'}<b>${dateFmt(order.serviceDate)}</b></span><span>${isHotel?'房晚':'票数'}<b>${isHotel?roomNights(order):`${order.tickets||0} 张`}</b></span></div><div class="mobile-order-money"><div><strong>${compactCurrency(order.gmv)}</strong><small>GMV · ${order.location||'—'}</small></div><div><small>${isCommissionOrder(order)?`${settlementText(order)} · 佣金 ${compactCurrency(commissionReceived(order))}`:(order.paymentPlatform||'未填付款平台')}</small><small>${invoiceText(order)}</small></div></div></article>`}).join('') || '<div class="empty-state">未找到订单</div>';
  const first= list.length ? (orderPage-1)*ORDER_PAGE_SIZE+1 : 0; const last=Math.min(orderPage*ORDER_PAGE_SIZE,list.length);
  byId('orderCountLabel').textContent=list.length?`共 ${list.length} 笔订单 · 显示 ${first}-${last}`:'共 0 笔订单';
  byId('orderPagination').innerHTML=pageCount>1?`<button class="page-button" data-order-page="${orderPage-1}" ${orderPage===1?'disabled':''}>上一页</button><span>第 ${orderPage} / ${pageCount} 页</span><button class="page-button" data-order-page="${orderPage+1}" ${orderPage===pageCount?'disabled':''}>下一页</button>`:'';
}
function renderLedger() {
  const rows=transactionRows(); const received=rows.filter(r=>r.amount>0).reduce((n,r)=>n+r.amount,0); const paid=Math.abs(rows.filter(r=>r.amount<0).reduce((n,r)=>n+r.amount,0));
  byId('ledgerSummary').innerHTML=`<article><p>已收款</p><strong class="profit-positive">${compactCurrency(received)}</strong></article><article><p>已付成本</p><strong class="profit-negative">${compactCurrency(paid)}</strong></article><article><p>现金净流入</p><strong>${compactCurrency(received-paid)}</strong></article>`;
  byId('ledgerTable').innerHTML=rows.map(r=>`<tr><td>${dateFmt(r.date)}</td><td><span class="status ${r.amount>=0?'paid':'unpaid'}">${r.kind}</span></td><td>${r.order.id}</td><td>${r.party}</td><td>${r.note}</td><td class="money amount ${r.amount>=0?'income':'expense'}">${r.amount>=0?'+':'−'}${compactCurrency(Math.abs(r.amount))}</td></tr>`).join('') || '<tr><td colspan="6"><div class="empty-state">暂无资金流水</div></td></tr>';
}
function renderOtherIncome(){const total=otherIncomes.reduce((n,item)=>n+Number(item.amount||0),0),expense=otherIncomes.reduce((n,item)=>n+Number(item.expense||0),0);byId('otherIncomeSummary').innerHTML=`<article><p>其它收入</p><strong class="profit-positive">${compactCurrency(total)}</strong></article><article><p>其它支出</p><strong class="profit-negative">${compactCurrency(expense)}</strong></article><article><p>净额</p><strong>${compactCurrency(total-expense)}</strong></article>`;byId('otherIncomeTable').innerHTML=otherIncomes.slice().sort((a,b)=>b.date.localeCompare(a.date)).map(item=>{const linked=incomeOrderIds(item).map(id=>orders.find(order=>order.id===id)).filter(Boolean);const net=Number(item.amount||0)-Number(item.expense||0);return `<tr><td>${dateFmt(item.date)}</td><td><strong>${item.name}</strong></td><td>${item.payer||'—'}</td><td>${item.payee||'—'}</td><td>${linked.length?`<div class="income-order-links">${linked.map(order=>`<span class="order-code">${orderCode(order)}</span>`).join('')}</div><small>${linked.length} 笔订单</small>`:'未关联订单'}</td><td class="money">${compactCurrency(item.amount)}</td><td class="money profit-negative">${compactCurrency(item.expense)}</td><td class="money ${net>=0?'profit-positive':'profit-negative'}">${compactCurrency(net)}</td><td class="row-actions"><button class="button quiet" data-edit-income="${item.id}" aria-label="编辑">编辑</button><button class="button quiet danger" data-delete-income="${item.id}" aria-label="删除">删除</button></td></tr>`}).join('')||'<tr><td colspan="9"><div class="empty-state">还没有其它收入记录</div></td></tr>';}
const qualityKindLabels={missing:'资料缺失',payment:'待收款 / 待返佣',cost:'成本异常',paymentStatus:'付款状态异常',duplicate:'疑似重复',extension:'续住关联',incomeLink:'收入关联异常',review:'需要核对'};
const qualityKindDescriptions={missing:'补齐客户、日期、供应商、房型、GMV、成本或开票公司等字段。',payment:'确认客户实收金额，或补登记平台返佣到账。',cost:'确认是否为赠送、未结算，或遗漏成本。',paymentStatus:'核对订单当前付款状态和收款记录。',duplicate:'核对确认号、客户、酒店和入住日期，避免重复记账。',extension:'同确认号但入住日期相差一天，建议保留为独立续住订单。',incomeLink:'其它收入关联了不存在的订单，需要重新选择或清空关联。',review:'确认订单信息差异是否符合实际业务。'};
const qualityActionLabels={open:'待处理',processed:'已处理',ignored:'已忽略'};
function qualityActionStatus(order,kind){return qualityActions[qualityActionKey(order,kind)]?.status||'open';}
function qualityEvidence(order,kind,detail){
  if(kind==='payment')return isCommissionOrder(order)?`预计返佣 ${compactCurrency(commissionExpected(order))} · 已到账 ${compactCurrency(commissionReceived(order))} · 待到账 ${compactCurrency(commissionOutstanding(order))}`:`GMV ${compactCurrency(order.gmv)} · 已收 ${compactCurrency(order.received)} · 待收 ${compactCurrency(Math.max(0,Number(order.gmv||0)-Number(order.received||0)))}`;
  if(kind==='incomeLink')return `其它收入：${order.customer||'未命名'} · ${detail}`;
  if(kind==='cost'&&detail.includes('利润'))return `GMV ${compactCurrency(order.gmv)} · 成本 ${compactCurrency(order.cost)} · 录入利润 ${compactCurrency(order.profitOverride)}`;
  if(kind==='cost')return `GMV ${compactCurrency(order.gmv)} · 成本 ${compactCurrency(order.cost)}`;
  if(kind==='duplicate'||kind==='extension'||kind==='review')return `${order.confirmation?'确认号 '+order.confirmation+' · ':''}${order.serviceDate?'业务日期 '+order.serviceDate+' · ':''}${detail}`;
  return detail;
}
function qualitySuggestion(order,kind){
  if(kind==='payment')return isCommissionOrder(order)?'建议登记平台返佣到账金额；不要把客人前台付款当作我方收款。':'建议补登记客户本次收款，或确认订单是否应标记为退款/取消。';
  if(kind==='cost')return '建议核对供应商结算单；若确实无需我方支付，请使用客人前台付款/平台返佣结算模式。';
  if(kind==='missing')return '建议打开订单补齐缺失字段后再纳入经营分析。';
  if(kind==='duplicate')return '建议打开两笔订单比对；确认重复后人工处理，系统不会自动删除。';
  if(kind==='extension')return '这是续住关联提示，建议保留为两笔独立订单，分别核对日期、房晚和成本。';
  if(kind==='incomeLink')return '建议打开其它收入，使用确认号、订单编号或客户名重新关联；找不到对应订单时清空关联。';
  if(kind==='paymentStatus')return '建议核对付款状态、已收金额和资金流水是否一致。';
  return '建议打开订单核对确认号、客户、酒店和业务日期。';
}
function qualityEntries(){
  const grouped=new Map();
  const add=(order,kind,detail,meta={})=>{const key=`${order.id}|${kind}`;if(!grouped.has(key))grouped.set(key,{order,kind,details:[],...meta});const entry=grouped.get(key);if(detail&&!entry.details.includes(detail))entry.details.push(detail);};
  issueEntries().forEach(({order,issue})=>{const kind=issue.includes('收款')||issue.includes('返佣')?'payment':issue.includes('成本')||issue.includes('利润')?'cost':issue.includes('缺少')?'missing':issue.includes('付款状态')?'paymentStatus':'review';add(order,kind,issue);});
  dataCleaningEntries().forEach(({order,kind,detail})=>{const mapped=kind==='缺失字段'?'missing':kind==='疑似重复'?'duplicate':kind==='续住关联'?'extension':'review';add(order,mapped,detail);});
  const orderIds=new Set(orders.map(order=>order.id));
  otherIncomes.forEach(item=>{const missingIds=incomeOrderIds(item).filter(id=>!orderIds.has(id));if(!missingIds.length)return;const record={id:item.id,orderCode:`OI-${String(item.id).replace(/^OI-/,'')}`,type:'other_income',customer:item.name||'其它收入',supplier:item.payer||item.payee||'其它收入',serviceDate:item.date||''};add(record,'incomeLink',`关联订单不存在：${missingIds.join('、')}`,{recordType:'other_income'});});
  return [...grouped.values()].map(entry=>({...entry,detail:entry.details.join('；')}));
}
function filteredQualityEntries(){
  const query=qualitySearch.trim().toLowerCase();
  return qualityEntries().filter(({order,kind,detail})=>{const status=qualityActionStatus(order,kind);return (qualityIssueFilter==='all'||kind===qualityIssueFilter)&&(qualityStatusFilter==='all'||status===qualityStatusFilter)&&(qualityTypeFilter==='all'||order.type===qualityTypeFilter)&&(!query||`${orderCode(order)} ${order.id} ${order.customer||''} ${order.booker||''} ${order.supplier||''} ${order.confirmation||''} ${order.location||''} ${detail}`.toLowerCase().includes(query));});
}
async function setQualityAction(orderId,kind,status){
  const entry=qualityEntries().find(item=>item.order.id===orderId&&item.kind===kind);const order=entry?.order;if(!order)return;
  const id=qualityActionKey(order,kind),previous=qualityActions[id];
  if(status==='open')delete qualityActions[id];else qualityActions[id]={status,updatedAt:new Date().toISOString()};
  saveLocalQualityActions();renderQuality();
  try{
    if(status==='open'&&qualityActionsCloudAvailable&&cloudReady&&currentUser){const {error}=await supabaseClient.from('quality_issue_actions').delete().eq('id',id);if(error)throw error;}
    else if(status!=='open')await saveQualityActionToCloud(id,order.id,kind,status,qualityActions[id].updatedAt);
    setSyncStatus(qualityActionsCloudAvailable?'异常处理状态已同步':'异常处理状态已保存到本机',qualityActionsCloudAvailable?'synced':'sync-error');
  }catch(error){
    if(previous)qualityActions[id]=previous;else delete qualityActions[id];saveLocalQualityActions();renderQuality();setSyncStatus(`异常处理状态同步失败：${error.message}`,'sync-error');window.alert(`异常处理状态保存失败，已恢复原状态：${error.message}`);
  }
}
function renderQuality() {
  const allEntries=qualityEntries(),entries=filteredQualityEntries(),openCount=allEntries.filter(entry=>qualityActionStatus(entry.order,entry.kind)==='open').length;
  byId('issueCount').textContent=openCount;
  byId('qualityFilterSummary').innerHTML=`当前显示 <strong>${entries.length}</strong> 条 · 待处理 <strong>${openCount}</strong> 条 · 全部异常 <strong>${allEntries.length}</strong> 条`;
  const groupOrder=['payment','cost','missing','paymentStatus','duplicate','extension','incomeLink','review'];
  byId('issueGrid').innerHTML=groupOrder.filter(kind=>entries.some(entry=>entry.kind===kind)).map(kind=>{const list=entries.filter(entry=>entry.kind===kind);return `<article class="issue-card"><strong class="issue-count">${list.length}</strong><h3>${qualityKindLabels[kind]}</h3><p>${qualityKindDescriptions[kind]}</p><div class="quality-issue-list">${list.map(({order,detail,recordType})=>{const status=qualityActionStatus(order,kind),nextAction=status==='open'?'processed':'open';const openButton=recordType==='other_income'?`<button class="button quiet" data-edit-income="${escapeHtml(order.id)}">编辑其它收入</button>`:`<button class="button quiet" data-detail="${escapeHtml(order.id)}">打开订单</button>`;return `<div class="quality-issue-row"><div class="quality-issue-head"><div><b>${escapeHtml(orderCode(order))}</b><span>${escapeHtml(order.customer||'未填写客户')} · ${escapeHtml(order.supplier||'未填写供应商')}</span></div><span class="quality-smart-tag">智能建议</span></div><small class="quality-state ${status}">${qualityActionLabels[status]}</small><small class="quality-evidence">证据：${escapeHtml(qualityEvidence(order,kind,detail))}</small><small class="quality-suggestion">建议：${escapeHtml(qualitySuggestion(order,kind))}</small><div class="quality-row-actions">${openButton}<button class="button quiet" data-quality-action="${nextAction}" data-quality-order="${escapeHtml(order.id)}" data-quality-kind="${escapeHtml(kind)}">${status==='open'?'标记已处理':'恢复待处理'}</button>${status==='open'?'<button class="button quiet" data-quality-action="ignored" data-quality-order="'+escapeHtml(order.id)+'" data-quality-kind="'+escapeHtml(kind)+'">忽略本次</button>':''}</div></div>`}).join('')}</div></article>`}).join('')||'<div class="empty-state">当前筛选下暂无待办问题</div>';
}
function analysisMonthKey(offset=0){const date=new Date(`${today}T00:00:00`);date.setDate(1);date.setMonth(date.getMonth()+offset);return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`;}
function analysisMonthRange(month){const [year,monthNumber]=month.split('-').map(Number);const last=new Date(Date.UTC(year,monthNumber,0)).getUTCDate();return {start:`${month}-01`,end:`${month}-${String(last).padStart(2,'0')}`};}
function analysisScope(question){
  const q=question.toLowerCase();const dateField=/入住|房晚|住宿/.test(q)?'serviceDate':/下单|预订/.test(q)?'orderDate':dashboardDateField;let start='',end='',label='全部数据';
  const explicit=q.match(/(20\d{2})年\s*(\d{1,2})月/);
  if(explicit){const month=`${explicit[1]}-${String(Number(explicit[2])).padStart(2,'0')}`;({start,end}=analysisMonthRange(month));label=`${explicit[1]}年${Number(explicit[2])}月`;}
  else if(q.includes('本月')){const month=analysisMonthKey();({start,end}=analysisMonthRange(month));label='本月';}
  else if(q.includes('上月')){const month=analysisMonthKey(-1);({start,end}=analysisMonthRange(month));label='上月';}
  else if(q.includes('今年')||q.includes('本年')){start=`${today.slice(0,4)}-01-01`;end=`${today.slice(0,4)}-12-31`;label='今年';}
  else if(q.includes('去年')){const year=Number(today.slice(0,4))-1;start=`${year}-01-01`;end=`${year}-12-31`;label='去年';}
  return {dateField,start,end,label,dateFieldLabel:dateField==='serviceDate'?'入住/出发日期':'下单日期'};
}
function analysisDimensionMatch(question){
  const q=question.toLowerCase();const candidates=[['supplier',[...new Set(orders.map(order=>order.supplier).filter(Boolean))]],['location',[...new Set(orders.map(order=>order.location).filter(Boolean))]],['booker',[...new Set(orders.map(order=>order.booker).filter(Boolean))]],['customer',[...new Set(orders.map(order=>order.customer).filter(Boolean))]]];
  for(const [field,values] of candidates){const value=values.sort((a,b)=>b.length-a.length).find(item=>q.includes(String(item).toLowerCase()));if(value)return {field,value};}
  return null;
}
function analysisSummary(rows,incomes){const gmv=rows.reduce((n,order)=>n+Number(order.gmv||0),0),profitTotal=rows.reduce((n,order)=>n+profit(order),0),received=rows.reduce((n,order)=>n+Number(order.received||0),0);return {orders:rows.length,hotels:rows.filter(order=>order.type==='hotel').length,flights:rows.filter(order=>order.type==='flight').length,gmv,profit:profitTotal,margin:gmv?profitTotal/gmv*100:0,received,outstanding:rows.filter(customerReceivable).reduce((n,order)=>n+(isCommissionOrder(order)?commissionOutstanding(order):Math.max(0,Number(order.gmv||0)-Number(order.received||0))),0),roomNights:rows.reduce((n,order)=>n+roomNights(order),0),tickets:rows.reduce((n,order)=>n+Number(order.tickets||0),0),otherNet:incomes.reduce((n,item)=>n+otherIncomeNet(item),0)};}
function analysisGroup(rows,field){const map={};rows.forEach(order=>{const name=String(order[field]||'未填写').trim()||'未填写';const item=map[name]||{name,orders:0,gmv:0,profit:0};item.orders+=1;item.gmv+=Number(order.gmv||0);item.profit+=profit(order);map[name]=item;});return Object.values(map).map(item=>({...item,margin:item.gmv?item.profit/item.gmv*100:0})).sort((a,b)=>b.profit-a.profit);}
function buildBusinessAnalysis(question){
  const scope=analysisScope(question),q=question.toLowerCase();let rows=orders.filter(order=>{const date=order[scope.dateField]||'';return (!scope.start||date>=scope.start)&&(!scope.end||date<=scope.end);});let incomes=otherIncomes.filter(item=>(!scope.start||item.date>=scope.start)&&(!scope.end||item.date<=scope.end));
  const type=/机票|航班|出票|票数/.test(q)&&!/(酒店|房晚|入住)/.test(q)?'flight':/(酒店|房晚|入住|住宿)/.test(q)?'hotel':'all';if(type!=='all')rows=rows.filter(order=>order.type===type);const dimension=analysisDimensionMatch(question);if(dimension)rows=rows.filter(order=>String(order[dimension.field]||'').toLowerCase()===dimension.value.toLowerCase());
  let condition='';if(/待收款|未收款/.test(q)){rows=rows.filter(customerReceivable);condition='待收款';}else if(/待返佣|返佣.*未到账|返佣逾期/.test(q)){rows=rows.filter(order=>isCommissionOrder(order)&&commissionOutstanding(order)>0);condition='待返佣';}
  const lowMargin=q.match(/利润率\s*(?:低于|小于|少于)\s*(\d+(?:\.\d+)?)\s*%/);if(lowMargin){const threshold=Number(lowMargin[1]);rows=rows.filter(order=>Number(order.gmv||0)>0&&profit(order)/Number(order.gmv)*100<threshold);condition=`利润率低于 ${threshold}%`;}
  const summary=analysisSummary(rows,incomes);const rankingField=/预订人/.test(q)?'booker':/酒店|供应商|航司/.test(q)?'supplier':/城市/.test(q)?'location':null;const ranking=rankingField?analysisGroup(rows,rankingField).slice(0,10):[];let answer='';
  if(condition)answer=`${scope.label}${type==='hotel'?'酒店':type==='flight'?'机票':'订单'}${condition}共 ${summary.orders} 笔，GMV ${compactCurrency(summary.gmv)}，订单利润 ${compactCurrency(summary.profit)}。`;
  else if(rankingField&&ranking.length){const top=ranking[0];answer=`按${rankingField==='booker'?'预订人':rankingField==='supplier'?'酒店/航司':'城市'}统计，当前利润最高的是${top.name}：${top.orders} 笔订单，GMV ${compactCurrency(top.gmv)}，利润 ${compactCurrency(top.profit)}，利润率 ${top.margin.toFixed(1)}%。`;}
  else answer=`${scope.label}${type==='hotel'?'酒店':type==='flight'?'机票':'经营数据'}共 ${summary.orders} 笔，GMV ${compactCurrency(summary.gmv)}，订单利润 ${compactCurrency(summary.profit)}，利润率 ${summary.margin.toFixed(1)}%。房晚 ${summary.roomNights}，票数 ${summary.tickets}。`;
  return {question,scope,scopeLabel:scope.label,dateFieldLabel:scope.dateFieldLabel,type,dimension,condition,summary,ranking,topOrders:rows.slice().sort((a,b)=>profit(a)-profit(b)).slice(0,10).map(order=>({code:orderCode(order),customer:order.customer||'未填写',supplier:order.supplier||'未填写',date:order[scope.dateField]||'',gmv:Number(order.gmv||0),profit:profit(order)})),answer};
}
function renderAnalysisResult(result,source='确定性统计'){
  const panel=byId('analysisResult');if(!panel)return;const summary=result.summary||{};panel.className='analysis-result';panel.hidden=false;panel.innerHTML=`<div class="analysis-answer"><span class="quality-smart-tag">${escapeHtml(source)}</span><p>${escapeHtml(result.answer||'暂无可回答的数据。')}</p></div><div class="analysis-metrics"><div><span>订单数</span><b>${summary.orders||0}</b></div><div><span>GMV</span><b>${compactCurrency(summary.gmv||0)}</b></div><div><span>订单利润</span><b>${compactCurrency(summary.profit||0)}</b></div><div><span>利润率</span><b>${Number(summary.margin||0).toFixed(1)}%</b></div></div><div class="analysis-scope"><strong>统计口径：</strong>${escapeHtml(result.scopeLabel||'全部数据')} · ${escapeHtml(result.dateFieldLabel||'下单日期')} · ${escapeHtml(result.type==='hotel'?'酒店':result.type==='flight'?'机票':'酒店 + 机票')}${result.dimension?` · ${escapeHtml(result.dimension.field)}：${escapeHtml(result.dimension.value)}`:''}${result.condition?` · ${escapeHtml(result.condition)}`:''}</div>`;
}
async function runBusinessAnalysis(questionOverride=''){
  const question=(questionOverride||byId('aiAccountingText').value).trim(),button=byId('aiParseButton'),status=byId('aiAccountingStatus');if(!question){status.textContent='请先输入一个经营问题。';status.className='ai-status error';return;}
  const localResult=buildBusinessAnalysis(question);analysisResult=localResult;renderAnalysisResult(localResult);status.textContent='已完成确定性统计；金额和口径来自当前台账。';status.className='ai-status success';await saveAssistantContext({date_field:localResult.scope.dateField==='serviceDate'?'service_date':'order_date',period_start:localResult.scope.start||null,period_end:localResult.scope.end||null,order_type:localResult.type||'all',city:localResult.dimension?.field==='location'?localResult.dimension.value:'',supplier:localResult.dimension?.field==='supplier'?localResult.dimension.value:'',booker:localResult.dimension?.field==='booker'?localResult.dimension.value:'',pending_question:''});
  if(!aiSettings.enabled||!supabaseClient||!currentUser){status.textContent+=' 启用模型配置后可生成 AI 文字说明。';return;}
  button.disabled=true;button.textContent='解释中…';
  try{const {data:sessionData}=await supabaseClient.auth.getSession();const response=await fetch(`${SUPABASE_URL}/functions/v1/ai-accounting`,{method:'POST',headers:{Authorization:`Bearer ${sessionData.session?.access_token||''}`,'Content-Type':'application/json'},body:JSON.stringify({mode:'analysis',text:question,conversation_id:assistantConversationId,...assistantModelContext(),context:{scope:localResult.scopeLabel,date_field:localResult.dateFieldLabel,type:localResult.type,condition:localResult.condition,summary:localResult.summary,ranking:localResult.ranking,top_orders:localResult.topOrders}})});const result=await response.json();if(!response.ok)throw new Error(result.error||'AI经营解释失败');if(result.data?.answer){localResult.answer=result.data.answer;analysisResult=localResult;renderAnalysisResult(localResult,`AI说明 · ${result.model||'模型'}`);status.textContent='统计完成，AI已基于确定性结果生成说明。';await saveAssistantMessage('assistant',result.data.answer,{intent:'business_query',scope:localResult.scopeLabel,date_field:localResult.dateFieldLabel});}}
  catch(error){status.textContent=`统计已完成，但 AI 说明失败：${error.message}`;status.className='ai-status error';}
  finally{button.disabled=false;button.textContent='交给 AI 处理';}
}
function isBusinessAnalysisQuestion(text){
  const query=text.toLowerCase();
  return /多少钱|多少金额|多少利润|gmv|利润率|订单数|房晚|票数|待收款|待返佣|趋势|排行|排名|哪个|哪些|找出|比较|同比|环比|本月|上月|今年|去年/.test(query)
    && !/订房|预订|下单|出票|机票订单|酒店订单|收到|收款|返佣到账|付给|支出|记账|登记/.test(query);
}
function isAccountingCaptureQuestion(text){return /记账|登记|收到|返佣|收款|支出|新增订单|订房|预订|下单|出票|付款|支付|佣金|关联订单|填入订单/.test(text);}
async function runUnifiedAi(){
  const text=byId('aiAccountingText').value.trim();
  if(!text){byId('aiAccountingStatus').textContent='请先输入你要做的事情。';byId('aiAccountingStatus').className='ai-status error';return;}
  await saveAssistantMessage('user',text);
  byId('aiDraftPanel').hidden=true;byId('analysisResult').hidden=true;
  return runAssistantChat(text);
}
function dataCleaningEntries(){
  const entries=[];
  orders.forEach(order=>{
    const missing=[];
    if(!order.customer)missing.push('客户');
    if(!order.serviceDate)missing.push(order.type==='hotel'?'入住日期':'出发日期');
    if(!order.supplier)missing.push(order.type==='hotel'?'酒店':'航司');
    if(!order.product)missing.push(order.type==='hotel'?'房型':'航班');
    if(!order.gmv)missing.push('GMV');
    if(!isCommissionOrder(order)&&order.gmv&&!Number(order.cost))missing.push('成本金额');
    if(invoiceStatus(order)==='issued'&&!order.invoiceCompany)missing.push('开票公司');
    if(missing.length)entries.push({order,kind:'缺失字段',detail:`缺少：${missing.join('、')}`});
  });
  const groups={};orders.forEach(order=>{const key=order.confirmation?`确认号：${order.confirmation}`:`${order.customer}|${order.supplier}|${order.serviceDate}|${order.gmv}`;(groups[key] ||= []).push(order);});
  Object.entries(groups).filter(([,list])=>list.length>1).forEach(([key,list])=>list.forEach(order=>entries.push({order,kind:'疑似重复',detail:`匹配 ${list.length} 笔 · ${key}`})));
  return entries;
}
function serviceDateGap(a,b){const first=Date.parse(`${a||''}T00:00:00`),second=Date.parse(`${b||''}T00:00:00`);return Number.isFinite(first)&&Number.isFinite(second)?Math.abs(first-second)/86400000:null;}
function dataCleaningEntries(){
  const entries=[];
  orders.forEach(order=>{
    const missing=[];
    if(!order.customer)missing.push('客户');if(!order.serviceDate)missing.push(order.type==='hotel'?'入住日期':'出发日期');if(!order.supplier)missing.push(order.type==='hotel'?'酒店':'航司');if(!order.product)missing.push(order.type==='hotel'?'房型':'航班');if(!order.gmv)missing.push('GMV');if(!isCommissionOrder(order)&&order.gmv&&!Number(order.cost))missing.push('成本金额');if(invoiceStatus(order)==='issued'&&!order.invoiceCompany)missing.push('开票公司');
    if(missing.length)entries.push({order,kind:'缺失字段',detail:`缺少：${missing.join('、')}`});
  });
  const groups={};orders.filter(order=>order.confirmation).forEach(order=>{(groups[order.confirmation] ||= []).push(order);});
  Object.values(groups).filter(list=>list.length>1).forEach(list=>{
    list.forEach((order,index)=>list.slice(index+1).forEach(other=>{
      const sameBooking=order.type==='hotel'&&other.type==='hotel'&&order.customer===other.customer&&order.supplier===other.supplier&&order.location===other.location;
      const gap=serviceDateGap(order.serviceDate,other.serviceDate);
      const kind=sameBooking&&gap===1?'续住关联':sameBooking&&gap===0?'疑似重复':'需要核对';
      const detail=kind==='续住关联'?`同确认号 ${order.confirmation}，入住日期相差1天，建议保留为续住拆单`:kind==='疑似重复'?`同确认号、同入住日期，匹配 ${list.length} 笔`:`同确认号 ${order.confirmation}，客户/酒店/日期存在差异`;
      entries.push({order,kind,detail});entries.push({order:other,kind,detail});
    }));
  });
  return entries.filter((item,index,list)=>list.findIndex(candidate=>candidate.order.id===item.order.id&&candidate.kind===item.kind&&candidate.detail===item.detail)===index);
}
function renderDataCleaning(){
  const result=byId('aiCleaningResults');if(!result)return;const entries=dataCleaningEntries();
  if(!entries.length){result.innerHTML='<div class="ai-clean-empty">扫描完成，暂未发现缺失字段或疑似重复订单。</div>';return;}
  result.innerHTML=entries.slice(0,30).map(item=>`<div class="ai-clean-row"><span class="status ${item.kind==='疑似重复'?'partial':'unpaid'}">${escapeHtml(item.kind)}</span><div><b>${escapeHtml(orderCode(item.order))}</b><small>${escapeHtml(item.detail)} · ${escapeHtml(item.order.supplier||'未填写供应商')} · ${escapeHtml(item.order.customer||'未填写客户')}</small></div><button class="button quiet" data-open-order="${escapeHtml(item.order.id)}">查看</button></div>`).join('')+(entries.length>30?`<span class="ai-status">共发现 ${entries.length} 个问题，当前显示前30个。</span>`:'');
}
function renderDataCleaning(){
  const result=byId('aiCleaningResults');if(!result)return;const entries=dataCleaningEntries();
  if(!entries.length){result.innerHTML='<div class="ai-clean-empty">扫描完成，暂未发现缺失字段、续住关联或疑似重复订单。</div>';return;}
  result.innerHTML=entries.slice(0,30).map(item=>{const badgeClass=item.kind==='疑似重复'?'partial':item.kind==='续住关联'?'paid':'unpaid';return `<div class="ai-clean-row"><span class="status ${badgeClass}">${escapeHtml(item.kind)}</span><div><b>${escapeHtml(orderCode(item.order))}</b><small>${escapeHtml(item.detail)} · ${escapeHtml(item.order.supplier||'未填写供应商')} · ${escapeHtml(item.order.customer||'未填写客户')}</small></div><button class="button quiet" data-open-order="${escapeHtml(item.order.id)}">查看</button></div>`}).join('')+(entries.length>30?`<span class="ai-status">共发现 ${entries.length} 个问题，当前显示前30个。</span>`:'');
}
const cleanupFieldLabels = { supplier:'酒店 / 航司', paymentPlatform:'付款平台', location:'城市 / 航线', booker:'预订人' };
function getCleanupMatches(){
  const field=byId('cleanupField')?.value;
  const from=(byId('cleanupFrom')?.value||'').trim();
  if(!field||!from)return [];
  return orders.filter(order=>String(order[field]??'').trim()===from);
}
function renderCleanupPreview(){
  const result=byId('cleanupPreview');if(!result)return;
  const field=byId('cleanupField').value;
  const from=byId('cleanupFrom').value.trim();
  const to=byId('cleanupTo').value.trim();
  cleanupPreviewField=field;cleanupPreviewFrom=from;cleanupPreviewTo=to;cleanupPreviewOrders=[];
  result.className='cleanup-preview';
  if(!from||!to){result.innerHTML='<span class="ai-status">请先填写当前值和统一后的新值。</span>';return;}
  if(from===to){result.innerHTML='<span class="ai-status error">新旧值相同，不需要修改。</span>';return;}
  const matches=getCleanupMatches();cleanupPreviewOrders=matches;
  if(!matches.length){result.innerHTML=`<div class="ai-clean-empty">没有找到“${escapeHtml(from)}”的订单，未执行任何修改。</div>`;return;}
  const label=cleanupFieldLabels[field]||field;
  result.innerHTML=`<div class="cleanup-summary"><span>字段：${escapeHtml(label)} · 当前值：<b>${escapeHtml(from)}</b> · 统一为：<strong>${escapeHtml(to)}</strong></span><strong>${matches.length} 笔将被修改</strong></div><div class="cleanup-actions"><button class="button primary" type="button" data-confirm-cleanup>确认批量修改 ${matches.length} 笔</button></div>${matches.map(order=>`<div class="cleanup-row"><div class="cleanup-row-main"><div class="cleanup-row-title"><strong>${escapeHtml(orderCode(order))}</strong><span>${escapeHtml(order.customer||'待补客户')}</span><span>${escapeHtml(order.supplier||'待确认供应商')}</span></div><div class="cleanup-row-meta"><span>${escapeHtml(order.type==='hotel'?'酒店':'机票')}</span><span>${escapeHtml(order.serviceDate||'未填写日期')}</span><span>${escapeHtml(order.location||'未填写城市/航线')}</span></div><div class="cleanup-change">${escapeHtml(label)}：<b>${escapeHtml(from)}</b> → <strong>${escapeHtml(to)}</strong></div></div><button class="button quiet" type="button" data-open-order="${escapeHtml(order.id)}">查看</button></div>`).join('')}`;
}
async function confirmCleanup(){
  if(!cleanupPreviewOrders.length)return;
  const field=byId('cleanupField').value,from=byId('cleanupFrom').value.trim(),to=byId('cleanupTo').value.trim();
  if(field!==cleanupPreviewField||from!==cleanupPreviewFrom||to!==cleanupPreviewTo){renderCleanupPreview();return;}
  if(!window.confirm(`确认把 ${cleanupPreviewOrders.length} 笔订单的“${cleanupFieldLabels[field]||field}”从“${from}”统一改为“${to}”吗？\n\n只修改这个字段，不会删除订单，也不会改变金额、成本、利润或付款状态。`))return;
  const before=orders.map(order=>({...order}));
  const ids=new Set(cleanupPreviewOrders.map(order=>order.id));
  orders=orders.map(order=>ids.has(order.id)?{...order,[field]:to}:order);
  const result=byId('cleanupPreview');
  const button=result?.querySelector('[data-confirm-cleanup]');if(button){button.disabled=true;button.textContent='正在保存…';}
  try{
    await saveOrdersBatch();
    const count=ids.size;cleanupPreviewOrders=[];result.className='cleanup-preview success';result.innerHTML=`已完成：${count} 笔订单的“${escapeHtml(cleanupFieldLabels[field]||field)}”已统一为“${escapeHtml(to)}”。如需继续清洗，请重新输入当前值和新值。`;renderAll();
  }catch(error){
    orders=before;saveLocalOrders();result.className='cleanup-preview error';result.innerHTML=`批量修改保存失败，已恢复修改前数据。${escapeHtml(error.message||'请稍后重试。')}`;renderAll();
  }
}
function renderAll(){renderDashboard();renderOrders();renderLedger();renderQuality();renderCityDistribution();renderOtherIncome();}

let selectedOtherIncomeOrderIds=[];
function orderSearchText(order){return `${orderCode(order)} ${order.id} ${order.confirmation||''} ${order.customer||''} ${order.booker||''} ${order.supplier||''} ${order.product||''} ${order.location||''}`.toLowerCase();}
function renderOtherIncomeOrderPicker(){
  const query=(byId('otherIncomeOrderSearch')?.value||'').trim().toLowerCase();
  const matches=orders.filter(order=>!query||orderSearchText(order).includes(query)).slice(0,80);
  const selected=selectedOtherIncomeOrderIds.map(id=>orders.find(order=>order.id===id)).filter(Boolean);
  byId('otherIncomeSelectedOrders').innerHTML=selected.length?selected.map(order=>`<span class="income-order-chip">${orderCode(order)}<button type="button" data-remove-income-order="${order.id}" aria-label="移除 ${orderCode(order)}">×</button></span>`).join(''):'<span class="income-order-empty">暂未关联订单</span>';
  byId('otherIncomeOrderCount').textContent=`已关联 ${selected.length} 笔订单`;
  byId('otherIncomeOrderResults').innerHTML=matches.map(order=>{const checked=selectedOtherIncomeOrderIds.includes(order.id);return `<label class="income-order-result"><input type="checkbox" data-income-order="${order.id}" ${checked?'checked':''}><span><b>${orderCode(order)} · ${order.supplier||'待确认'}</b><small>${order.confirmation?`确认号 ${order.confirmation} · `:''}${order.customer||'待补客户'} · ${order.product||order.location||'—'}</small></span></label>`}).join('')||'<div class="income-order-empty">没有找到匹配订单</div>';
}
function populateOtherIncomeOrders(selectedIds=[]){selectedOtherIncomeOrderIds=[...new Set((Array.isArray(selectedIds)?selectedIds:[selectedIds]).filter(Boolean))];renderOtherIncomeOrderPicker();}
function openOtherIncomeForm(item=null) {
  byId('otherIncomeForm').reset();
  byId('otherIncomeDate').value=item?.date || today;
  byId('otherIncomeName').value=item?.name || '';
  byId('otherIncomePayer').value=item?.payer || '';
  byId('otherIncomePayee').value=item?.payee || '';
  byId('otherIncomeAmount').value=item?.amount ?? '';
  byId('otherIncomeExpense').value=item?.expense ?? '';
  populateOtherIncomeOrders(item?.orderIds || (item?.orderId?[item.orderId]:[]));
  byId('otherIncomeNet').textContent=compactCurrency(Number(item?.amount||0)-Number(item?.expense||0));
  byId('otherIncomeHeading').textContent=item?'编辑其它收入':'新增其它收入';
  byId('otherIncomeForm').dataset.editId=item?.id || '';
  byId('otherIncomeForm').dataset.saving='false';
  const submitButton=byId('otherIncomeForm').querySelector('button.primary');
  submitButton.disabled=false;
  submitButton.textContent='保存';
  byId('otherIncomeDialog').showModal();
}

function mountWorkspacePages(){const knowledge=document.querySelector('#aiView .knowledge-panel')||document.querySelector('.knowledge-panel'),knowledgeMount=byId('knowledgePageMount');if(knowledge&&knowledgeMount&&knowledge.parentElement!==knowledgeMount){knowledgeMount.appendChild(knowledge);knowledge.classList.add('knowledge-page-panel');}const settings=document.querySelector('#aiView .ai-settings-panel')||document.querySelector('.ai-settings-panel'),settingsMount=byId('settingsPageMount');if(settings&&settingsMount&&settings.parentElement!==settingsMount){settingsMount.appendChild(settings);settings.classList.add('settings-page-panel');}}
function showView(view){mountWorkspacePages();activeView=view;document.querySelectorAll('.view').forEach(el=>el.classList.toggle('active',el.id===`${view}View`));document.querySelectorAll('.nav-item').forEach(el=>el.classList.toggle('active',el.dataset.view===view));document.querySelectorAll('.dashboard-only').forEach(el=>el.classList.toggle('hidden',view!=='dashboard'));document.querySelectorAll('.order-toolbar-only').forEach(el=>el.classList.toggle('hidden',view==='otherIncome'||view==='ai'||view==='knowledge'||view==='settings'||view==='memory'));byId('viewTitle').textContent={dashboard:'经营总览',orders:'订单台账',ledger:'资金流水',otherIncome:'其它收入',quality:'数据待办',ai:'AI工作台',knowledge:'专业知识库',memory:'AI记忆',settings:'设置'}[view];if(view==='ai'||view==='settings')syncAiSettingsForm();if(view==='memory')renderMemoryList();}
function openDetails(id){const o=orders.find(x=>x.id===id);if(!o)return;selectedOrderId=id;const isHotel=o.type==='hotel';const transactions=transactionRows().filter(r=>r.order.id===id);const commissionInfo=isCommissionOrder(o)?`<div><span>结算模式</span><b>${settlementText(o)}</b></div><div><span>客人支付给</span><b>${o.guestPaymentTo||'—'}</b></div><div><span>返佣平台</span><b>${o.commissionPlatform||'—'}</b></div><div><span>预计 / 已收佣金</span><b>${compactCurrency(commissionExpected(o))} / ${compactCurrency(commissionReceived(o))}</b></div><div><span>佣金状态</span><b>${commissionStatusText(o)}${o.commissionReceivedDate?` · ${o.commissionReceivedDate}`:''}</b></div>`:`<div><span>结算模式</span><b>${settlementText(o)}</b></div>`;const amountCards=isCommissionOrder(o)?`<div><span>订单金额 GMV</span><strong>${compactCurrency(o.gmv)}</strong></div><div><span>酒店成本</span><strong>无需我方支付</strong></div><div><span>订单利润</span><strong class="${profit(o)>=0?'profit-positive':'profit-negative'}">${compactCurrency(profit(o))}</strong></div><div><span>待返佣</span><strong>${compactCurrency(commissionOutstanding(o))}</strong></div>`:`<div><span>GMV</span><strong>${compactCurrency(o.gmv)}</strong></div><div><span>成本</span><strong>${compactCurrency(o.cost)}</strong></div><div><span>利润</span><strong class="${profit(o)>=0?'profit-positive':'profit-negative'}">${compactCurrency(profit(o))}</strong></div><div><span>待收款</span><strong>${compactCurrency(o.gmv-o.received)}</strong></div>`;byId('detailContent').innerHTML=`<div class="detail-header"><div><p class="eyebrow">${isHotel?'HOTEL ORDER':'FLIGHT ORDER'} · ${o.id}</p><h2>${o.supplier}</h2><span class="status ${payment(o)} detail-status">${paymentText(o)} · ${statusText(o)}</span></div><button class="icon-button" data-close="detailDialog" aria-label="关闭">×</button></div><div class="detail-info"><div><span>客户</span><b>${o.customer}</b></div><div><span>预订人</span><b>${o.booker||'—'}</b></div><div><span>下单日期</span><b>${o.orderDate||'—'}</b></div><div><span>${isHotel?'入住日期':'出发日期'}</span><b>${o.serviceDate||'—'}</b></div><div><span>${isHotel?'城市':'航线'}</span><b>${o.location||'—'}</b></div><div><span>${isHotel?'房型':'航班'}</span><b>${o.product||'—'}</b></div><div><span>确认号 / 票号</span><b>${o.confirmation||'—'}</b></div>${commissionInfo}<div><span>订单状态</span><b>${statusText(o)}</b></div><div><span>付款平台</span><b>${o.paymentPlatform||'—'}</b></div><div><span>开票状态</span><b>${invoiceText(o)}${invoiceStatus(o)==='issued'&&o.invoiceCompany?` · ${o.invoiceCompany}`:''}</b></div><div><span>${isHotel?'住宿':'票数'}</span><b>${isHotel?`${o.rooms||1} 间 × ${o.nights||0} 晚 = ${roomNights(o)} 房晚`:`${o.tickets||0} 张`}</b></div></div><div class="detail-amounts">${amountCards}</div><section class="detail-section"><h3>资金流水</h3><div class="detail-ledger">${transactions.map(r=>`<div><span>${dateFmt(r.date)}</span><span>${r.kind}</span><span>${r.note}</span><b class="amount ${r.amount>=0?'income':'expense'}">${r.amount>=0?'+':'−'}${compactCurrency(Math.abs(r.amount))}</b></div>`).join('')||'<div>暂无流水</div>'}</div></section><div class="detail-actions"><div><button class="button quiet" id="editOrder" data-id="${o.id}">编辑订单</button><button class="button quiet" id="addPayment" data-id="${o.id}">+ ${isCommissionOrder(o)?'登记返佣':'登记收款'}</button></div><div><button class="button quiet danger" id="deleteOrder" data-id="${o.id}">删除订单</button><button class="button primary" data-close="detailDialog">关闭</button></div></div>`;byId('detailDialog').showModal();}
const openDetailsLegacy = openDetails;
openDetails = function openSplitPaymentDetails(id){
  openDetailsLegacy(id);
  const order=orders.find(item=>item.id===id);
  const content=byId('detailContent');
  if(!order||!content)return;
  const paymentSection=document.createElement('section');
  paymentSection.className='detail-section detail-payment-split';
  paymentSection.innerHTML=isCommissionOrder(order)
    ? `<h3>\u6536\u6b3e\u4e0e\u4ed8\u6b3e</h3><div class="detail-info"><div><span>\u5ba2\u6237\u6536\u6b3e</span><b>\u4e0d\u9002\u7528\uff08\u5ba2\u4eba\u524d\u53f0\u652f\u4ed8\uff09</b></div><div><span>\u4f9b\u5e94\u5546 / \u5e73\u53f0\u4ed8\u6b3e</span><b>\u65e0\u9700\u4ed8\u6b3e</b></div><div><span>\u5e73\u53f0\u8fd4\u4f63</span><b>${commissionStatusText(order)}\uff0c\u5f85\u8fd4 ${compactCurrency(commissionOutstanding(order))}</b></div></div>`
    : `<h3>\u6536\u6b3e\u4e0e\u4ed8\u6b3e</h3><div class="detail-info"><div><span>\u5ba2\u6237\u6536\u6b3e</span><b>${paymentText(order)}\uff0c\u5df2\u6536 ${compactCurrency(order.received)}\uff0c\u5f85\u6536 ${compactCurrency(Math.max(0,Number(order.gmv||0)-Number(order.received)))}</b></div><div><span>\u4f9b\u5e94\u5546 / \u5e73\u53f0\u4ed8\u6b3e</span><b>${supplierPaymentText(order)}\uff0c\u5df2\u4ed8 ${compactCurrency(supplierPaid(order))}\uff0c\u5f85\u4ed8 ${compactCurrency(Math.max(0,Number(order.cost||0)-supplierPaid(order)))}</b></div><div><span>\u4ed8\u6b3e\u65b9\u5f0f</span><b>${order.paymentPlatform||'\u672a\u586b\u5199'}</b></div></div>`;
  const amounts=content.querySelector('.detail-amounts');
  if(amounts)amounts.insertAdjacentElement('beforebegin',paymentSection);
};

async function deleteOrder(id){
  const order=orders.find(item=>item.id===id); if(!order)return;
  if(!window.confirm(`确定删除订单 ${orderCode(order)} 吗？\n\n删除后订单、统计和订单资金流水都会移除，且无法恢复。`))return;
  const button=byId('deleteOrder'); if(button){button.disabled=true;button.textContent='删除中…';}
  try{
    if(cloudReady&&currentUser){const {error}=await supabaseClient.from('orders').delete().eq('id',id);if(error)throw error;}
    orders=orders.filter(item=>item.id!==id);saveLocalOrders();
    byId('detailDialog').close();renderAll();
  }catch(error){if(button){button.disabled=false;button.textContent='删除订单';}window.alert(`删除订单失败：${error.message}`);}
}
function refreshFormPreview(){const type=byId('formType').value;const gmv=Number(byId('gmv').value||0);const cost=Number(byId('cost').value||0);if(type==='hotel'){const rooms=Number(byId('rooms').value||1),nights=Number(byId('nights').value||0);byId('quantityPreview').textContent=`住宿：${rooms} 间 × ${nights} 晚 = ${rooms*nights} 房晚`;}else byId('quantityPreview').textContent=`机票：${Number(byId('tickets').value||0)} 张`;
  byId('profitPreview').textContent=compactCurrency(byId('settlementMode')?.value==='guest_pay_commission'?Number(byId('commissionReceived')?.value||0)-Number(byId('directCost')?.value||0):gmv-cost);
}
function syncSettlementFields(){const commission=byId('settlementMode').value==='guest_pay_commission';document.querySelectorAll('.settlement-detail').forEach(el=>el.classList.toggle('hidden',!commission));byId('costLabel').classList.toggle('hidden',commission);byId('paymentStatusLabel').classList.toggle('hidden',commission);byId('paymentPlatformLabel').classList.toggle('hidden',commission);byId('receivedLabel').classList.toggle('hidden',commission);if(commission){byId('paymentStatus').value='unpaid';byId('received').value=0;byId('cost').value=0;}byId('quantityPreview').textContent=commission?'客人前台支付 · 平台返佣':byId('quantityPreview').textContent;refreshFormPreview();}
function evaluateCalculation(expression){const normalized=expression.replaceAll('×','*').replaceAll('÷','/').replaceAll('−','-').replaceAll('，',',').replaceAll(',','').trim();if(!normalized||!/^[0-9+\-*/().\s]+$/.test(normalized))throw new Error('请输入有效的算式');const result=Function(`"use strict"; return (${normalized})`)();if(!Number.isFinite(result))throw new Error('计算结果无效');return Math.round((result+Number.EPSILON)*100)/100;}
function openCalculator(target){calculatorTarget=target;const input=byId(target);byId('calculatorTitle').textContent=`计算 ${target==='gmv'?'GMV / 售价':target==='cost'?'成本金额':'已收金额'}`;byId('calcExpression').value=input.value||'';byId('calcHint').textContent='支持 + − × ÷ 和括号';byId('calcHint').classList.remove('error');byId('calculatorDialog').showModal();byId('calcExpression').focus();}
function calculateAndPreview(){try{const result=evaluateCalculation(byId('calcExpression').value);byId('calcExpression').value=String(result);byId('calcHint').textContent=`结果：${compactCurrency(result)}`;byId('calcHint').classList.remove('error');return result;}catch(error){byId('calcHint').textContent=error.message;byId('calcHint').classList.add('error');return null;}}
function setOrderType(type){byId('formType').value=type;document.querySelectorAll('[data-order-type]').forEach(b=>b.classList.toggle('selected',b.dataset.orderType===type));document.querySelectorAll('.hotel-only').forEach(e=>e.classList.toggle('hidden',type!=='hotel'));document.querySelectorAll('.flight-only').forEach(e=>e.classList.toggle('hidden',type!=='flight'));byId('locationLabel').firstChild.textContent=type==='hotel'?'城市':'航线';byId('supplierLabel').firstChild.textContent=type==='hotel'?'酒店':'航司';byId('productLabel').firstChild.textContent=type==='hotel'?'房型':'航班';byId('serviceDateLabel').firstChild.textContent=type==='hotel'?'入住日期':'出发日期';byId('supplier').placeholder=type==='hotel'?'如：广州瑰丽':'如：全日空 ANA';byId('product').placeholder=type==='hotel'?'如：豪华大床':'如：NH934 · 经济舱';const current=byId('orderStatus').value;const statuses=type==='hotel'?[['booked','预订中'],['confirming','确认中'],['confirmed','已确认'],['cancelled','已取消']]:[['pending','待出票'],['ticketed','已出票'],['refunded','已退票']];byId('orderStatus').innerHTML=statuses.map(([value,label])=>`<option value="${value}">${label}</option>`).join('');if(statuses.some(([value])=>value===current))byId('orderStatus').value=current;refreshFormPreview();}
function excelDate(value){if(!value)return '';if(value instanceof Date)return value.toISOString().slice(0,10);if(typeof value==='number'&&window.XLSX){const parts=XLSX.SSF.parse_date_code(value);if(parts)return `${parts.y}-${String(parts.m).padStart(2,'0')}-${String(parts.d).padStart(2,'0')}`;}const parsed=new Date(value);return Number.isNaN(parsed.getTime())?'':parsed.toISOString().slice(0,10);}
function excelNumber(value){const number=Number(value);return Number.isFinite(number)?number:0;}
function isFlightRow(row){const source=`${row['酒店/机票']||''} ${row['房型']||''} ${row['城市']||''}`.toLowerCase();return /航空|airways?|airlines?|flight|航班|机票|航司/.test(source);}
function mapExcelRow(row,index){const source=row.map(value=>String(value??'')).join(' ');const type=/[\u673a\u822a]\u7968|\u822a\u73ed|airways?|airlines?|flight/i.test(source)?'flight':'hotel';const rawGmv=row[14],rawCost=row[8],rawProfit=row[15],rawPaymentStatus=String(row[11]||'').trim(),rawInvoice=String(row[10]||'').trim(),rawPaymentPlatform=String(row[12]||'').trim();const paymentStatus=/\u672a\u4ed8|\u5f85\u6536/.test(rawPaymentStatus)?'unpaid':/\u90e8\u5206/.test(rawPaymentStatus)?'partial':/\u9000\u6b3e/.test(rawPaymentStatus)?'refunded':'paid';const gmv=excelNumber(rawGmv),cost=excelNumber(rawCost),count=excelNumber(row[5]);const issues=[];if(!row[0])issues.push('缺少下单日期');if(!row[1])issues.push('缺少业务日期');if(!row[3])issues.push('缺少供应商');if(rawCost===null||rawCost===undefined||rawCost==='')issues.push('缺少成本金额');if(rawGmv===null||rawGmv===undefined||rawGmv==='')issues.push('缺少收款金额');if(String(row[3]||'').trim()==='发票')issues.push('需要核对业务类型');return {id:`IM-${String(index+2).padStart(4,'0')}`,orderCode:`ORD-${String(index+1).padStart(5,'0')}`,type,customer:String(row[7]||'').replace(/\s+/g,' ').trim()||'待补客户',booker:String(row[9]||'').trim(),orderDate:excelDate(row[0]),serviceDate:excelDate(row[1]),location:String(row[2]||'').trim(),supplier:String(row[3]||'').trim()||'待确认',product:String(row[4]||'').trim(),confirmation:String(row[6]||'').trim(),rooms:type==='hotel'?1:0,nights:type==='hotel'?count:0,tickets:type==='flight'?count:0,gmv,cost,received:paymentStatus==='paid'?gmv:0,paymentStatus,paymentPlatform:rawPaymentPlatform,invoiceStatus:rawInvoice?'issued':'unissued',invoiceCompany:rawInvoice,profitOverride:rawProfit===null||rawProfit===undefined||rawProfit===''?null:excelNumber(rawProfit),status:type==='hotel'?'confirmed':'ticketed',issues};}
async function importExcel(file){if(!window.XLSX){window.alert('Excel 解析组件尚未加载，请检查网络后刷新页面重试。');return;}const button=byId('importExcel');button.textContent='正在导入…';button.disabled=true;try{const buffer=await file.arrayBuffer();const workbook=XLSX.read(buffer,{type:'array',cellDates:true});const sheetName=workbook.SheetNames.includes('酒店销售')?'酒店销售':workbook.SheetNames[0];const rows=XLSX.utils.sheet_to_json(workbook.Sheets[sheetName],{defval:null,raw:true});const imported=rows.filter(row=>Object.values(row).some(value=>value!==null&&value!=='')) .map(mapExcelOrder);if(!imported.length)throw new Error('未在工作表中找到可导入的订单记录。');orders=imported;await saveOrdersBatch();renderAll();showView('orders');window.alert(`已导入 ${imported.length} 笔真实订单（来源：${sheetName}）。\n\n说明：旧表未提供房间数，因此酒店订单暂按 1 间房换算房晚；付款状态为空的记录暂按“已收款”保留收款金额，待收款和异常数据会进入“数据待办”。`);}catch(error){window.alert(`导入失败：${error.message}`);}finally{button.textContent='导入 Excel';button.disabled=false;byId('excelFile').value='';}}
async function importExcelFixed(file){if(!window.XLSX){window.alert('Excel 解析组件未加载，请检查网络后刷新重试。');return;}const button=byId('importExcel');button.textContent='正在导入…';button.disabled=true;try{const workbook=XLSX.read(await file.arrayBuffer(),{type:'array',cellDates:true});const sheet=workbook.Sheets[workbook.SheetNames[0]];const matrix=XLSX.utils.sheet_to_json(sheet,{header:1,defval:null,raw:true});const imported=matrix.slice(1).filter(row=>Array.isArray(row)&&row.some(value=>value!==null&&value!=='')) .map(mapExcelRow).filter(order=>order.orderDate||order.serviceDate||order.supplier!=='待确认'||order.gmv!==0);if(imported.length<10||!imported.some(order=>order.supplier!=='待确认'&&order.gmv>0))throw new Error('没有识别到“酒店销售”订单数据，请确认选择的是导出的订单汇总文件。');orders=imported;await saveOrdersBatch();renderAll();showView('orders');byId('importStatus').textContent=`已导入 ${imported.length} 笔订单 · 来源：${file.name} · 真实数据已替换本地示例`;byId('importStatus').classList.add('success');window.alert(`已成功导入 ${imported.length} 笔真实订单。`);}catch(error){byId('importStatus').textContent=`导入失败：${error.message}`;byId('importStatus').classList.remove('success');window.alert(`导入失败：${error.message}`);}finally{button.textContent='导入 Excel';button.disabled=false;byId('excelFile').value='';}}
function openEditOrder(id){const o=orders.find(order=>order.id===id);if(!o)return;byId('detailDialog').close();byId('orderForm').dataset.editId=id;byId('orderForm').dataset.saving='false';byId('formKicker').textContent=`EDIT ORDER · ${id}`;byId('formHeading').textContent='编辑订单';byId('formSubmit').disabled=false;byId('formSubmit').textContent='保存修改';setOrderType(o.type);byId('orderStatus').value=o.status|| (o.type==='hotel'?'booked':'pending');byId('customer').value=o.customer||'';byId('booker').value=o.booker||'';byId('orderDate').value=o.orderDate||o.serviceDate||today;byId('serviceDate').value=o.serviceDate||today;byId('confirmation').value=o.confirmation||'';byId('location').value=o.location||'';byId('supplier').value=o.supplier||'';byId('product').value=o.product||'';byId('rooms').value=o.rooms||1;byId('nights').value=o.nights||1;byId('tickets').value=o.tickets||1;byId('gmv').value=o.gmv||0;byId('cost').value=o.cost||0;byId('settlementMode').value=settlementMode(o);byId('guestPaymentTo').value=o.guestPaymentTo||'';byId('commissionPlatform').value=o.commissionPlatform||'';byId('commissionExpected').value=commissionExpected(o)||'';byId('commissionReceived').value=commissionReceived(o)||'';byId('commissionStatus').value=commissionStatus(o);byId('commissionReceivedDate').value=o.commissionReceivedDate||'';byId('directCost').value=directCost(o)||'';byId('paymentStatus').value=payment(o);byId('paymentPlatform').value=o.paymentPlatform||'';byId('received').value=o.received||0;byId('invoiceStatus').value=invoiceStatus(o);byId('invoiceCompany').value=o.invoiceCompany||'';syncSettlementFields();refreshFormPreview();byId('orderDialog').showModal();}

document.addEventListener('click', event=>{
  const qualityAction=event.target.closest('[data-quality-action]'); if(qualityAction){event.preventDefault();event.stopImmediatePropagation();setQualityAction(qualityAction.dataset.qualityOrder,qualityAction.dataset.qualityKind,qualityAction.dataset.qualityAction);return;}
  const nav=event.target.closest('[data-view]'); if(nav)showView(nav.dataset.view);
  const go=event.target.closest('[data-go]'); if(go)showView(go.dataset.go);
  const detail=event.target.closest('[data-detail]'); if(detail && !detail.closest('#orderTable') && !detail.closest('#mobileOrderList'))openDetails(detail.dataset.detail);
  const close=event.target.closest('[data-close]'); if(close)byId(close.dataset.close).close();
  const page=event.target.closest('[data-order-page]'); if(page&&!page.disabled){orderPage=Number(page.dataset.orderPage);renderOrders();}
  const type=event.target.closest('[data-order-type]'); if(type)setOrderType(type.dataset.orderType);
  const filter=event.target.closest('[data-type-filter]'); if(filter){activeType=filter.dataset.typeFilter;orderPage=1;document.querySelectorAll('[data-type-filter]').forEach(b=>b.classList.toggle('selected',b===filter));renderOrders();}
  const calcTrigger=event.target.closest('[data-calc-for]'); if(calcTrigger)openCalculator(calcTrigger.dataset.calcFor);
  const calcKey=event.target.closest('[data-calc-key]'); if(calcKey){const input=byId('calcExpression'),key=calcKey.dataset.calcKey;if(key==='C')input.value='';else if(key==='?')input.value=input.value.slice(0,-1);else input.value+=key;byId('calcHint').textContent='支持 + − × ÷ 和括号';byId('calcHint').classList.remove('error');}
  if(event.target.id==='calcEquals')calculateAndPreview();
  if(event.target.id==='applyCalculation'){const result=calculateAndPreview();if(result!==null&&calculatorTarget){byId(calculatorTarget).value=String(result);refreshFormPreview();byId('calculatorDialog').close();}}
  if(event.target.id==='clearFilters'){activeType='all';searchTerm='';orderPage=1;byId('orderSearch').value='';document.querySelectorAll('[data-type-filter]').forEach(b=>b.classList.toggle('selected',b.dataset.typeFilter==='all'));renderOrders();}
  if(event.target.id==='importExcel')byId('excelFile').click();
  if(event.target.id==='openOrderDialog'){byId('orderForm').reset();delete byId('orderForm').dataset.editId;byId('orderForm').dataset.saving='false';byId('formKicker').textContent='NEW TRANSACTION';byId('formHeading').textContent='新增订单';byId('formSubmit').disabled=false;byId('formSubmit').textContent='保存订单';byId('orderDate').value=today;byId('serviceDate').value=today;byId('paymentStatus').value='paid';byId('settlementMode').value='agency_pay';syncSettlementFields();setOrderType('hotel');byId('orderStatus').value='booked';byId('orderDialog').showModal();}
  if(event.target.id==='editOrder')openEditOrder(event.target.dataset.id);
  if(event.target.id==='deleteOrder')deleteOrder(event.target.dataset.id);
  if(event.target.id==='migrateLocalData')migrateLocalData();
  if(event.target.id==='signOut')signOut();
  if(event.target.id==='addPayment'){const order=orders.find(o=>o.id===event.target.dataset.id);if(!order)return;if(isCommissionOrder(order)){const outstanding=commissionOutstanding(order);const value=window.prompt(`请输入本次返佣金额（最多 ${compactCurrency(outstanding)}）`,outstanding);if(value!==null&&!Number.isNaN(Number(value))){order.commissionReceived=Math.min(commissionExpected(order),commissionReceived(order)+Number(value));order.commissionStatus=commissionReceived(order)>=commissionExpected(order)?'received':'partial';order.commissionReceivedDate=today;saveOrder(order).then(()=>{renderAll();openDetails(order.id);}).catch(error=>window.alert(`保存返佣失败：${error.message}`));}}else{const outstanding=order.gmv-order.received;const value=window.prompt(`请输入本次收款金额（最多 ${compactCurrency(outstanding)}）`,outstanding);if(value!==null&&!Number.isNaN(Number(value))){order.received=Math.min(order.gmv,order.received+Number(value));order.paymentStatus=order.received>=order.gmv?'paid':'partial';saveOrder(order).then(()=>{renderAll();openDetails(order.id);}).catch(error=>window.alert(`保存收款失败：${error.message}`));}}}
});
byId('calcExpression').addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();calculateAndPreview();}});
byId('excelFile').addEventListener('change',event=>{const [file]=event.target.files;if(file)importExcelFixed(file);});
byId('orderSearch').addEventListener('input',e=>{searchTerm=e.target.value;orderPage=1;renderOrders();});
byId('dateField').addEventListener('change',e=>{dateField=e.target.value;orderPage=1;renderOrders();});
byId('dateStart').addEventListener('change',e=>{dateStart=e.target.value;orderPage=1;renderOrders();});
byId('dateEnd').addEventListener('change',e=>{dateEnd=e.target.value;orderPage=1;renderOrders();});
  byId('typeSelect').addEventListener('change',e=>{activeType=e.target.value;updateStatusOptions();});
byId('statusFilter').addEventListener('change',e=>{statusFilter=e.target.value;});
byId('paymentFilter').addEventListener('change',e=>{paymentFilter=e.target.value;});
byId('invoiceFilter').addEventListener('change',e=>{invoiceFilter=e.target.value;});
byId('locationFilter').addEventListener('input',e=>{locationFilter=e.target.value;});
byId('supplierFilter').addEventListener('input',e=>{supplierFilter=e.target.value;});
byId('applyFilters').addEventListener('click',()=>{dateField=byId('dateField').value;dateStart=byId('dateStart').value;dateEnd=byId('dateEnd').value;activeType=byId('typeSelect').value;statusFilter=byId('statusFilter').value;paymentFilter=byId('paymentFilter').value;invoiceFilter=byId('invoiceFilter').value;locationFilter=byId('locationFilter').value.trim();supplierFilter=byId('supplierFilter').value.trim();searchTerm=byId('orderSearch').value.trim();orderPage=1;renderOrders();byId('applyFilters').classList.add('filter-applied');setTimeout(()=>byId('applyFilters').classList.remove('filter-applied'),450);});
byId('clearFilters').addEventListener('click',()=>{activeType='all';dateField='orderDate';dateStart='';dateEnd='';statusFilter='all';paymentFilter='all';invoiceFilter='all';locationFilter='';supplierFilter='';searchTerm='';orderPage=1;byId('typeSelect').value='all';byId('dateField').value='orderDate';byId('dateStart').value='';byId('dateEnd').value='';byId('paymentFilter').value='all';byId('invoiceFilter').value='all';byId('locationFilter').value='';byId('supplierFilter').value='';byId('orderSearch').value='';updateStatusOptions();renderOrders();});
byId('qualityIssueFilter').addEventListener('change',event=>{qualityIssueFilter=event.target.value;renderQuality();});
byId('qualityStatusFilter').addEventListener('change',event=>{qualityStatusFilter=event.target.value;renderQuality();});
byId('qualityTypeFilter').addEventListener('change',event=>{qualityTypeFilter=event.target.value;renderQuality();});
byId('qualitySearch').addEventListener('input',event=>{qualitySearch=event.target.value;renderQuality();});
byId('clearQualityFilters').addEventListener('click',()=>{qualityIssueFilter='all';qualityStatusFilter='open';qualityTypeFilter='all';qualitySearch='';byId('qualityIssueFilter').value='all';byId('qualityStatusFilter').value='open';byId('qualityTypeFilter').value='all';byId('qualitySearch').value='';renderQuality();});
['gmv','cost','rooms','nights','tickets'].forEach(id=>byId(id).addEventListener('input',refreshFormPreview));
byId('settlementMode').addEventListener('change',syncSettlementFields);
['commissionExpected','commissionReceived','directCost'].forEach(id=>byId(id).addEventListener('input',refreshFormPreview));
byId('orderForm').addEventListener('submit',async event=>{
  event.preventDefault();
  const submitButton=byId('formSubmit');
  if(submitButton.disabled)return;
  submitButton.disabled=true;
  const originalSubmitText=submitButton.textContent;
  submitButton.textContent='保存中…';
  const type=byId('formType').value, editId=byId('orderForm').dataset.editId, existing=orders.find(order=>order.id===editId), previous=existing ? { ...existing } : null;
  const paymentStatus=byId('paymentStatus').value, paymentPlatform=byId('paymentPlatform').value.trim(), invoiceStatusValue=byId('invoiceStatus').value, invoiceCompany=byId('invoiceCompany').value.trim();
  const gmv=Number(byId('gmv').value||0); let received=Number(byId('received').value||0);
  if(paymentStatus==='paid')received=gmv; if(paymentStatus==='unpaid'||paymentStatus==='refunded')received=0;
  const commission=byId('settlementMode').value==='guest_pay_commission'; const order={id:editId||newOrderId(type),orderCode:existing?.orderCode||nextOrderCode(),type,customer:byId('customer').value.trim(),booker:byId('booker').value.trim(),orderDate:byId('orderDate').value,serviceDate:byId('serviceDate').value,location:byId('location').value.trim(),supplier:byId('supplier').value.trim(),product:byId('product').value.trim(),confirmation:byId('confirmation').value.trim(),rooms:type==='hotel'?Number(byId('rooms').value||1):0,nights:type==='hotel'?Number(byId('nights').value||0):0,tickets:type==='flight'?Number(byId('tickets').value||1):0,gmv,cost:commission?0:Number(byId('cost').value||0),received:commission?0:received,paymentStatus:commission?'unpaid':paymentStatus,paymentPlatform,settlementMode:byId('settlementMode').value,guestPaymentTo:byId('guestPaymentTo').value.trim(),commissionPlatform:byId('commissionPlatform').value.trim(),commissionExpected:commission?Number(byId('commissionExpected').value||0):0,commissionReceived:commission?Number(byId('commissionReceived').value||0):0,commissionStatus:commission?byId('commissionStatus').value:'none',directCost:commission?Number(byId('directCost').value||0):0,commissionReceivedDate:commission?byId('commissionReceivedDate').value:'',invoiceStatus:invoiceStatusValue,invoiceCompany:invoiceStatusValue==='issued'?invoiceCompany:'',profitOverride:existing?.profitOverride ?? null,status:byId('orderStatus').value,issues:existing?.issues};
  const savedMode=byId('settlementMode').value;
  const savedCommission=savedMode==='guest_pay_commission';
  const savedNoFunds=savedMode==='no_funds';
  const savedCost=savedCommission||savedNoFunds?0:Number(byId('cost').value||0);
  const requestedSupplierStatus=byId('supplierPaymentStatus').value;
  let savedSupplierPaid=savedCommission||savedNoFunds?0:Number(byId('supplierPaid').value||0);
  if(requestedSupplierStatus==='paid')savedSupplierPaid=savedCost;
  if(requestedSupplierStatus==='unpaid')savedSupplierPaid=0;
  savedSupplierPaid=Math.max(0,Math.min(savedCost,savedSupplierPaid));
  Object.assign(order,{cost:savedCost,received:savedCommission||savedNoFunds?0:received,paymentStatus:savedCommission||savedNoFunds?'not_applicable':paymentStatus,customerPaymentStatus:savedCommission||savedNoFunds?'not_applicable':paymentStatus,supplierPaid:savedSupplierPaid,supplierPaymentStatus:savedCommission||savedNoFunds?'not_required':requestedSupplierStatus});
  if(existing)Object.assign(existing,order);else orders.unshift(order);
  try { await saveOrder(order); saveLocalOrders(); delete byId('orderForm').dataset.editId; byId('orderDialog').close(); renderAll(); showView('orders'); openDetails(order.id); }
  catch(error) { if(existing && previous) Object.assign(existing, previous); else orders=orders.filter(item=>item.id!==order.id); saveLocalOrders(); submitButton.disabled=false; submitButton.textContent=originalSubmitText; window.alert(`保存订单失败：${error.message}`); }
});
byId('openOtherIncomeDialog').addEventListener('click',()=>openOtherIncomeForm());
byId('otherIncomeOrderSearch').addEventListener('input',renderOtherIncomeOrderPicker);
document.addEventListener('change',event=>{const checkbox=event.target.closest('[data-income-order]');if(!checkbox)return;const id=checkbox.dataset.incomeOrder;if(checkbox.checked){if(!selectedOtherIncomeOrderIds.includes(id))selectedOtherIncomeOrderIds.push(id);}else selectedOtherIncomeOrderIds=selectedOtherIncomeOrderIds.filter(orderId=>orderId!==id);renderOtherIncomeOrderPicker();});
document.addEventListener('click',event=>{const remove=event.target.closest('[data-remove-income-order]');if(remove){selectedOtherIncomeOrderIds=selectedOtherIncomeOrderIds.filter(id=>id!==remove.dataset.removeIncomeOrder);renderOtherIncomeOrderPicker();}});
['otherIncomeAmount','otherIncomeExpense'].forEach(id=>byId(id).addEventListener('input',()=>byId('otherIncomeNet').textContent=compactCurrency(Number(byId('otherIncomeAmount').value||0)-Number(byId('otherIncomeExpense').value||0))));
byId('otherIncomeForm').addEventListener('submit',async event=>{event.preventDefault();const submitButton=byId('otherIncomeForm').querySelector('button[type="submit"],button.primary');if(submitButton.disabled)return;submitButton.disabled=true;const originalSubmitText=submitButton.textContent;submitButton.textContent='保存中…';const editId=byId('otherIncomeForm').dataset.editId;const item={id:editId||`OI-${Date.now()}`,date:byId('otherIncomeDate').value,name:byId('otherIncomeName').value.trim(),payer:byId('otherIncomePayer').value.trim(),payee:byId('otherIncomePayee').value.trim(),orderId:selectedOtherIncomeOrderIds[0]||'',orderIds:[...selectedOtherIncomeOrderIds],amount:Number(byId('otherIncomeAmount').value||0),expense:Number(byId('otherIncomeExpense').value||0)};const index=otherIncomes.findIndex(record=>record.id===editId);if(index>=0)otherIncomes[index]=item;else otherIncomes.unshift(item);try{await saveOtherIncome(item);delete byId('otherIncomeForm').dataset.editId;byId('otherIncomeDialog').close();renderAll();showView('otherIncome');}catch(error){submitButton.disabled=false;submitButton.textContent=originalSubmitText;window.alert(`保存其它收入失败：${error.message}`);}});
document.addEventListener('click',event=>{const editIncome=event.target.closest('[data-edit-income]');if(editIncome){const item=otherIncomes.find(record=>record.id===editIncome.dataset.editIncome);if(item)openOtherIncomeForm(item);}const deleteIncome=event.target.closest('[data-delete-income]');if(deleteIncome&&window.confirm('确定删除这条其它收入记录吗？')){const id=deleteIncome.dataset.deleteIncome;otherIncomes=otherIncomes.filter(item=>item.id!==id);const removeCloud=cloudReady&&currentUser?supabaseClient.from('other_income').delete().eq('id',id):Promise.resolve({error:null});removeCloud.then(result=>{if(result.error)throw result.error;saveLocalOtherIncomes();renderAll();}).catch(error=>window.alert(`删除失败：${error.message}`));}});
async function importExcelFixed(file){
  if(!window.XLSX){window.alert('Excel 解析组件未加载，请检查网络后刷新重试。');return;}
  const button=byId('importExcel');
  button.textContent='正在导入…';
  button.disabled=true;
  try{
    const workbook=XLSX.read(await file.arrayBuffer(),{type:'array',cellDates:true});
    const aliases={
      order:["\u4e0b\u5355\u65e5\u671f"],
      service:["\u5165\u4f4f\u65e5\u671f/\u98de\u884c\u65e5\u671f","\u5165\u4f4f\u65e5\u671f","\u51fa\u53d1\u65e5\u671f"],
      location:["\u57ce\u5e02","\u51fa\u53d1\u5730/\u76ee\u7684\u5730","\u822a\u7ebf"],
      supplier:["\u9152\u5e97/\u673a\u7968","\u9152\u5e97","\u822a\u53f8"],
      product:["\u623f\u578b","\u822a\u73ed"],
      count:["\u665a\u6570/\u5f20\u6570","\u665a\u6570","\u5f20\u6570"],
      confirmation:["\u786e\u8ba4\u53f7/\u7968\u53f7","\u786e\u8ba4\u53f7","\u7968\u53f7"],
      traveler:["\u5165\u4f4f\u4eba/\u4e58\u673a\u4eba","\u5165\u4f4f\u4eba","\u4e58\u673a\u4eba"],
      cost:["\u6210\u672c\u91d1\u989d","\u6210\u672c"],
      booker:["\u9884\u5b9a\u4eba","\u9884\u8ba2\u4eba"],
      invoice:["\u53d1\u7968","\u5f00\u7968\u516c\u53f8","\u5f00\u7968\u4fe1\u606f"],
      payment:["\u4ed8\u6b3e\u72b6\u6001","\u6536\u6b3e\u72b6\u6001"],
      paymentPlatform:["\u4ed8\u6b3e\u5e73\u53f0","\u652f\u4ed8\u5e73\u53f0","\u4ed8\u6b3e\u6e20\u9053","\u652f\u4ed8\u6e20\u9053"],
      gmv:["\u6536\u6b3e\u91d1\u989d","GMV","\u552e\u4ef7"],
      profit:["\u5229\u6da6"]
    };
    const normalize=value=>String(value??'').replace(/[\\s\u3000]/g,'').toLowerCase();
    const findColumn=(headers,names)=>{const wanted=names.map(normalize);return headers.findIndex(header=>wanted.includes(normalize(header)));};
    let found=null;
    for(const sheetName of workbook.SheetNames){
      const matrix=XLSX.utils.sheet_to_json(workbook.Sheets[sheetName],{header:1,defval:null,raw:true});
      for(let headerRow=0;headerRow<Math.min(matrix.length,30);headerRow++){
        const headers=Array.isArray(matrix[headerRow])?matrix[headerRow]:[];
        const columns={};
        Object.entries(aliases).forEach(([key,names])=>{columns[key]=findColumn(headers,names);});
        const recognized=Object.values(columns).filter(index=>index>=0).length;
        if(columns.order>=0 && columns.supplier>=0 && columns.gmv>=0 && recognized>=6){found={sheetName,matrix,headerRow,headers,columns};break;}
      }
      if(found)break;
    }
    if(!found){const sheetSummary=workbook.SheetNames.join('、');const firstSheet=XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]],{header:1,defval:null,raw:true})[0]||[];const firstHeader=firstSheet.map(value=>String(value??'')).join('、');if(/收件人姓名|收件人电话|物品名称|月结卡号/.test(firstHeader))throw new Error(`当前文件“${file.name}”是快递/寄件模板，不是酒店订单汇总。请选择“2026年订单汇总.xlsx”。`);throw new Error(`未找到订单表。当前文件“${file.name}”的工作表为：${sheetSummary}。需要包含“下单日期、酒店/机票、收款金额”等列。`);}
    const c=found.columns;
    const cell=(row,key)=>c[key]>=0?row[c[key]]:null;
    const imported=found.matrix.slice(found.headerRow+1).filter(row=>Array.isArray(row)&&row.some(value=>value!==null&&value!=='')).map((row,index)=>mapExcelRow([
      cell(row,'order'),cell(row,'service'),cell(row,'location'),cell(row,'supplier'),cell(row,'product'),cell(row,'count'),cell(row,'confirmation'),cell(row,'traveler'),cell(row,'cost'),cell(row,'booker'),cell(row,'invoice'),cell(row,'payment'),cell(row,'paymentPlatform'),null,cell(row,'gmv'),cell(row,'profit')
    ],index)).filter(order=>order.orderDate||order.serviceDate||order.supplier!=='待确认'||order.gmv!==0);
    if(imported.length<1||!imported.some(order=>order.supplier!=='待确认'&&order.gmv>0))throw new Error(`已找到工作表“${found.sheetName}”，但没有识别到有效订单行。`);
    orders=imported;await saveOrdersBatch();
    activeType='all';dateField='orderDate';dateStart='';dateEnd='';statusFilter='all';paymentFilter='all';locationFilter='';supplierFilter='';searchTerm='';
    byId('typeSelect').value='all';byId('dateField').value='orderDate';byId('dateStart').value='';byId('dateEnd').value='';byId('paymentFilter').value='all';byId('locationFilter').value='';byId('supplierFilter').value='';byId('orderSearch').value='';
    updateStatusOptions();byId('periodSelect').value='all';byId('periodMonth').value=today.slice(0,7);renderAll();showView('orders');
    byId('importStatus').textContent=`已导入 ${imported.length} 笔订单 · 工作表：${found.sheetName} · 文件：${file.name}`;byId('importStatus').classList.add('success');
    window.alert(`已成功导入 ${imported.length} 笔真实订单。`);
  }catch(error){byId('importStatus').textContent=`导入失败：${error.message}`;byId('importStatus').classList.remove('success');window.alert(`导入失败：${error.message}`);}
  finally{button.textContent='导入 Excel';button.disabled=false;byId('excelFile').value='';}
}

byId('periodSelect').addEventListener('change',()=>{if(byId('periodSelect').value==='current')byId('periodMonth').value=today.slice(0,7);renderAll();});
byId('periodMonth').addEventListener('change',()=>{if(byId('periodMonth').value)byId('periodSelect').value='custom';renderAll();});
byId('dashboardDateField').addEventListener('change',e=>{dashboardDateField=e.target.value;renderAll();});
byId('authForm').addEventListener('submit',event=>{event.preventDefault();signIn();});
byId('authSignUp').addEventListener('click',()=>showRegisterUI(true));
byId('registerForm').addEventListener('submit',event=>{event.preventDefault();signUp();});
byId('authBackToLogin').addEventListener('click',()=>showRegisterUI(false));
byId('authResetPassword').addEventListener('click',()=>showResetUI(true));
byId('resetForm').addEventListener('submit',event=>{event.preventDefault();requestPasswordReset();});
byId('resetBackToLogin').addEventListener('click',()=>showResetUI(false));
byId('recoveryForm').addEventListener('submit',event=>{event.preventDefault();updatePasswordFromRecovery();});
byId('changePasswordForm').addEventListener('submit',event=>{event.preventDefault();changePassword();});
byId('aiSettingsForm').addEventListener('submit',event=>{event.preventDefault();saveAiSettings();});
byId('memoryForm')?.addEventListener('submit',saveManualMemory);
byId('aiProvider').addEventListener('change',event=>{if(event.target.value==='deepseek'){if(!byId('aiBaseUrl').value||byId('aiBaseUrl').value.includes('openai.com'))byId('aiBaseUrl').value='https://api.deepseek.com';if(!byId('aiModel').value||byId('aiModel').value==='gpt-4o-mini')byId('aiModel').value='deepseek-flash';}else if(event.target.value==='openai-compatible'&&byId('aiBaseUrl').value.includes('deepseek.com')){byId('aiBaseUrl').value='https://api.openai.com/v1';if(byId('aiModel').value==='deepseek-flash')byId('aiModel').value='gpt-4o-mini';}});
byId('aiParseButton').addEventListener('click',runUnifiedAi);
byId('aiFillButton').addEventListener('click',fillFromAiDraft);
document.addEventListener('click',event=>{if(event.target.closest('[data-confirm-ai-change]')){event.preventDefault();confirmAssistantPendingAction();}if(event.target.closest('[data-cancel-ai-change]')){event.preventDefault();clearPendingAction();byId('aiAccountingStatus').textContent='已取消批量修改，未改变任何订单。';byId('aiAccountingStatus').className='ai-status';}});
byId('knowledgeForm').addEventListener('submit',saveKnowledgeDraft);
document.addEventListener('click',event=>{const action=event.target.closest('[data-knowledge-action]');if(!action)return;updateKnowledgeStatus(action.dataset.knowledgeId,action.dataset.knowledgeAction==='publish'?'published':'archived');});
byId('scanDataQuality').addEventListener('click',()=>{byId('aiCleaningResults').innerHTML='<span class="ai-status">正在扫描订单字段和重复记录…</span>';setTimeout(renderDataCleaning,0);});
byId('previewCleanup').addEventListener('click',renderCleanupPreview);
document.addEventListener('click',event=>{if(event.target.closest('[data-confirm-cleanup]'))confirmCleanup();});
document.querySelectorAll('[data-ai-example]').forEach(button=>button.addEventListener('click',()=>{byId('aiAccountingText').value=button.dataset.aiExample;byId('aiAccountingText').focus();}));
const renderOrdersOriginal = renderOrders;
renderOrders = function renderOrdersWithVisibleActions(){
  renderOrdersOriginal();
  document.querySelectorAll('#mobileOrderList article[data-detail]').forEach(card=>{
    const order=orders.find(item=>item.id===card.dataset.detail);
    if(!order)return;
    card.classList.toggle('unpaid-order',paymentIssue(order));
    const money=card.querySelector('.mobile-order-money > div:last-child');
    if(money){
      money.innerHTML=isCommissionOrder(order)
        ? `<small>\u5ba2\u4eba\u524d\u53f0\u652f\u4ed8 \u00b7 \u5e73\u53f0\u8fd4\u4f63</small><small>\u8fd4\u4f63\uff1a${commissionStatusText(order)}</small><small>${invoiceText(order)}</small>`
        : `<small>\u5ba2\u6237\uff1a${paymentText(order)}</small><small>\u4f9b\u5e94\u5546\uff1a${supplierPaymentText(order)}${order.paymentPlatform?` \u00b7 ${order.paymentPlatform}`:''}</small><small>${invoiceText(order)}</small>`;
    }
  });
  const actionHead=document.querySelector('#ordersView thead th:last-child');
  if(actionHead){actionHead.textContent='操作';actionHead.style.width='104px';}
  document.querySelectorAll('#orderTable tr[data-detail]').forEach(row=>{
    const productCell=row.children[6];
    if(productCell&&!productCell.querySelector('.confirmation-line')){
      productCell.insertAdjacentHTML('beforeend','<small class="confirmation-line">确认号：未填写</small>');
    }
    const actionCell=row.lastElementChild;
    if(actionCell){actionCell.innerHTML=`<div class="order-actions"><button class="button quiet" data-open-order="${row.dataset.detail}">查看</button><button class="button quiet danger" data-delete-order="${row.dataset.detail}">删除</button></div>`;}
  });
  document.querySelectorAll('#mobileOrderList article[data-detail]').forEach(card=>{
    const subtitle=card.querySelector('.mobile-order-subtitle');
    if(subtitle&&!subtitle.querySelector('.mobile-order-confirmation')){
      const first=subtitle.querySelector('span');
      if(first)first.insertAdjacentHTML('afterend','<span class="mobile-order-confirmation">确认号：未填写</span>');
    }
    if(!card.querySelector('[data-delete-order]'))card.insertAdjacentHTML('beforeend',`<div class="mobile-order-actions"><button class="button quiet" data-open-order="${card.dataset.detail}">查看详情</button><button class="button quiet danger" data-delete-order="${card.dataset.detail}">删除订单</button></div>`);
  });
};

function assistantMessageMetadata(message){
  if(!message?.metadata)return {};
  if(typeof message.metadata==='object')return message.metadata;
  try{return JSON.parse(message.metadata)||{};}catch{return {};}
}

const memoryKindText=kind=>kind==='preference'?'个人偏好':'业务规则';
const memoryStatusText=status=>status==='archived'?'已停用':'使用中';
function renderMemoryList(){
  const panel=byId('memoryList');if(!panel)return;
  const summary=byId('assistantConversationSummary');
  const conversation=assistantConversations.find(item=>item.id===assistantConversationId);
  if(summary)summary.textContent=conversation?.summary||'当前还没有生成摘要。长对话达到一定长度后，系统会自动整理。';
  if(!assistantMemories.length){panel.innerHTML='<span class="ai-status">暂无已确认记忆。你可以在对话中说“请记住……”或在这里手动保存。</span>';return;}
  panel.innerHTML=assistantMemories.map(item=>`<article class="memory-card"><div class="memory-card-head"><span class="memory-card-title">${escapeHtml(item.title||'未命名记忆')}</span><span class="knowledge-status ${item.status==='archived'?'archived':'published'}">${memoryStatusText(item.status)} · ${memoryKindText(item.kind)}</span></div><p class="memory-card-content">${escapeHtml(item.content||'')}</p><small>${escapeHtml(item.source||'用户确认')} · ${escapeHtml(String(item.updated_at||item.created_at||'').slice(0,16).replace('T',' '))}</small><div class="memory-card-actions">${item.status==='active'?`<button class="button quiet" type="button" data-memory-action="archive" data-memory-id="${escapeHtml(item.id)}">停用</button>`:`<button class="button quiet" type="button" data-memory-action="restore" data-memory-id="${escapeHtml(item.id)}">恢复使用</button>`}<button class="button quiet danger" type="button" data-memory-action="delete" data-memory-id="${escapeHtml(item.id)}">删除</button></div></article>`).join('');
}
async function loadAssistantMemories(){
  assistantMemories=[];renderMemoryList();
  if(!cloudReady||!currentUser||!supabaseClient)return;
  const {data,error}=await supabaseClient.from('assistant_memories').select('id,kind,title,content,source,status,created_at,updated_at').order('updated_at',{ascending:false}).limit(100);
  if(error){if(!['42P01','PGRST205'].includes(error.code)&&error.status!==404)console.warn('AI记忆暂不可用',error.message);return;}
  assistantMemories=data||[];renderMemoryList();
}
async function saveMemoryRecord(memory){
  if(!currentUser||!supabaseClient){throw new Error('请先登录云端账户');}
  const {data,error}=await supabaseClient.from('assistant_memories').insert({user_id:currentUser.id,conversation_id:assistantConversationId,kind:memory.kind,title:memory.title,content:memory.content,source:memory.source||'用户确认',status:'active'}).select('id,kind,title,content,source,status,created_at,updated_at').single();
  if(error)throw error;assistantMemories=[data,...assistantMemories.filter(item=>item.id!==data.id)];renderMemoryList();return data;
}
async function updateMemoryRecord(id,action){
  if(action==='delete'&&!window.confirm('确认删除这条 AI 记忆吗？删除后 AI 不再使用。'))return;
  const patch=action==='restore'?{status:'active'}:action==='archive'?{status:'archived'}:null;
  if(!patch){const {error}=await supabaseClient.from('assistant_memories').delete().eq('id',id).eq('user_id',currentUser.id);if(error){window.alert(`删除记忆失败：${error.message}`);return;}assistantMemories=assistantMemories.filter(item=>item.id!==id);renderMemoryList();return;}
  const {data,error}=await supabaseClient.from('assistant_memories').update(patch).eq('id',id).eq('user_id',currentUser.id).select('id,kind,title,content,source,status,created_at,updated_at').single();
  if(error){window.alert(`更新记忆失败：${error.message}`);return;}assistantMemories=assistantMemories.map(item=>item.id===id?data:item);renderMemoryList();
}
function renderAssistantMemoryDraft(draft){
  const panel=byId('aiMemoryDraftPanel');if(!panel)return;assistantMemoryDraft=draft||null;
  if(!draft){panel.hidden=true;panel.innerHTML='';return;}
  panel.innerHTML=`<div class="ai-draft-head"><div><p class="eyebrow">MEMORY DRAFT</p><h3>建议保存一条长期记忆</h3></div><span class="status pending">待确认</span></div><div class="memory-draft-content"><strong>${escapeHtml(draft.title||'未命名记忆')} · ${escapeHtml(memoryKindText(draft.kind))}</strong>${escapeHtml(draft.content||'')}</div><div class="memory-draft-actions"><button class="button quiet" type="button" data-cancel-memory>暂不保存</button><button class="button primary" type="button" data-confirm-memory>确认保存</button></div>`;panel.hidden=false;
}
async function confirmAssistantMemory(){
  if(!assistantMemoryDraft)return;const button=byId('aiMemoryDraftPanel')?.querySelector('[data-confirm-memory]');if(button){button.disabled=true;button.textContent='保存中…';}
  try{const {data:sessionData}=await supabaseClient.auth.getSession();const response=await fetch(`${SUPABASE_URL}/functions/v1/ai-accounting`,{method:'POST',headers:{Authorization:`Bearer ${sessionData.session?.access_token||''}`,'Content-Type':'application/json'},body:JSON.stringify({mode:'save_memory',conversation_id:assistantConversationId,memory:assistantMemoryDraft})});const result=await response.json();if(!response.ok)throw new Error(result.error||'保存记忆失败');assistantMemoryDraft=null;renderAssistantMemoryDraft(null);await loadAssistantMemories();const status=byId('aiAccountingStatus');status.textContent='已保存到 AI 记忆，后续对话会自动参考。';status.className='ai-status success';}catch(error){if(button){button.disabled=false;button.textContent='确认保存';}const status=byId('aiAccountingStatus');status.textContent=error.message;status.className='ai-status error';}
}
async function saveManualMemory(event){
  event.preventDefault();const status=byId('memoryStatus'),button=byId('memoryForm')?.querySelector('button[type="submit"]');const memory={kind:byId('memoryKind').value,title:byId('memoryTitle').value.trim(),content:byId('memoryContent').value.trim(),source:'用户手动确认'};if(!memory.title||!memory.content){status.textContent='请填写标题和内容';status.className='ai-status error';return;}if(button)button.disabled=true;try{await saveMemoryRecord(memory);byId('memoryForm').reset();status.textContent='记忆已保存并立即生效';status.className='ai-status success';}catch(error){status.textContent=error.message;status.className='ai-status error';}finally{if(button)button.disabled=false;}
}

function renderAssistantQueryResults(results){
  if(!Array.isArray(results)||!results.length)return '';
  const orderLine=order=>{const due=Number(order.commission_outstanding||0)>0?`待返 ${compactCurrency(order.commission_outstanding)}`:['unpaid','partial'].includes(order.payment_status)?`待收 ${compactCurrency(Math.max(0,Number(order.gmv||0)-Number(order.received||0)))}`:'';return `<div class="assistant-query-row"><div><strong>${escapeHtml(order.order_code||order.id||'订单')}</strong><span>${escapeHtml([order.customer,order.supplier,order.product].filter(Boolean).join(' · ')||'未填写基础信息')}</span></div><small>${escapeHtml(order.service_date||order.order_date||'未填写日期')} · ${escapeHtml(order.payment_status_label||order.status_label||'')}</small>${due?`<b>${escapeHtml(due)}</b>`:''}</div>`;};
  return results.map(result=>{
    const title=String(result.title||'查询结果'),count=Number(result.matched_count||0),scope=result.start&&result.end?`${result.start} 至 ${result.end}`:'全部数据';
    if(result.kind==='other_income'){
      const records=Array.isArray(result.records)?result.records:[];
      return `<section class="assistant-query-card"><div class="assistant-query-head"><strong>${escapeHtml(title)}</strong><span>${count} 条 · ${escapeHtml(scope)}</span></div><div class="assistant-query-totals"><span>收入 ${compactCurrency(result.income_total||0)}</span><span>支出 ${compactCurrency(result.expense_total||0)}</span><b>净额 ${compactCurrency(result.net_total||0)}</b></div>${records.length?`<div class="assistant-query-list">${records.map(item=>`<div class="assistant-query-row"><div><strong>${escapeHtml(item.date||'未填写日期')}</strong><span>${escapeHtml(item.name||'未命名')}</span></div><small>${escapeHtml(item.payer||item.payee||'未填写往来方')} · 关联 ${escapeHtml(item.order_id||'无')}</small><b>${compactCurrency(item.net||0)}</b></div>`).join('')}</div>`:'<div class="assistant-query-empty">没有找到符合条件的其它收入或支出。</div>'}${result.truncated?'<small class="assistant-query-note">仅展示部分记录，完整结果请缩小查询范围。</small>':''}</section>`;
    }
    if(result.kind==='duplicate_orders'){
      const groups=Array.isArray(result.groups)?result.groups:[];
      return `<section class="assistant-query-card"><div class="assistant-query-head"><strong>${escapeHtml(title)}</strong><span>${count} 组 · ${escapeHtml(scope)}</span></div>${groups.length?`<div class="assistant-query-list">${groups.map(group=>`<div class="assistant-query-group"><b>${escapeHtml(group.reason||'疑似重复')}</b><span>${(Array.isArray(group.orders)?group.orders:[]).map(order=>escapeHtml(order.order_code||order.id||'订单')).join('、')}</span></div>`).join('')}</div>`:'<div class="assistant-query-empty">没有发现符合条件的疑似重复订单。</div>'}</section>`;
    }
    const orders=Array.isArray(result.orders)?result.orders:[];
    const amount=result.kind==='commission_outstanding'?`待返佣 ${compactCurrency(result.outstanding_total||0)}`:result.kind==='unpaid_orders'?`待收 ${compactCurrency(result.outstanding_total||0)}`:'';
    return `<section class="assistant-query-card"><div class="assistant-query-head"><strong>${escapeHtml(title)}</strong><span>${count} 笔 · ${escapeHtml(scope)}</span></div>${amount?`<div class="assistant-query-totals"><b>${escapeHtml(amount)}</b></div>`:''}${orders.length?`<div class="assistant-query-list">${orders.map(orderLine).join('')}</div>`:'<div class="assistant-query-empty">没有找到符合条件的订单。</div>'}${result.truncated?'<small class="assistant-query-note">仅展示部分记录，完整结果请缩小查询范围。</small>':''}</section>`;
  }).join('');
}

function renderAssistantConversation(){
  const panel=byId('assistantConversation');if(!panel)return;
  const messages=assistantMessages.slice(-12);
  panel.innerHTML=messages.length?messages.map(message=>{
    const metadata=assistantMessageMetadata(message),analysis=metadata.analysis;
    const created=escapeHtml(String(message.created_at||'').slice(0,16).replace('T',' '));
    if(analysis){
      const summary=analysis.summary||{};
      const typeText=analysis.type==='hotel'?'酒店':analysis.type==='flight'?'机票':'酒店 + 机票';
      const scope=`${analysis.scopeLabel||'全部数据'} · ${analysis.dateFieldLabel||'下单日期'} · ${typeText}${analysis.condition?` · ${analysis.condition}`:''}`;
      return `<article class="assistant-message assistant assistant-analysis"><small>AI · ${created} · 确定性工具</small><p>${escapeHtml(message.content||analysis.answer||'统计已完成。')}</p><div class="assistant-analysis-metrics"><div><span>订单数</span><b>${Number(summary.orders||0)}</b></div><div><span>GMV</span><b>${compactCurrency(summary.gmv||0)}</b></div><div><span>房晚</span><b>${Number(summary.roomNights||0)}</b></div><div><span>订单利润</span><b>${compactCurrency(summary.profit||0)}</b></div></div><div class="assistant-analysis-scope">统计口径：${escapeHtml(scope)}</div></article>`;
    }
    const sources=Array.isArray(metadata.knowledge_sources)?metadata.knowledge_sources:[];
    const queryResults=message.role==='assistant'?renderAssistantQueryResults(metadata.query_results):'';
    return `<article class="assistant-message ${message.role==='user'?'user':'assistant'}"><small>${message.role==='user'?'你':'AI'} · ${created}</small><p>${escapeHtml(message.content||'')}</p>${queryResults}${sources.length?`<div class="assistant-knowledge">参考知识：${sources.map(source=>escapeHtml(source.title||'未命名知识')).join('、')}</div>`:''}</article>`;
  }).join(''):'<div class="assistant-message empty">当前会话会记住日期口径、筛选条件和已确认的业务规则。</div>';
  panel.scrollTop=panel.scrollHeight;
}

async function runAssistantChat(question){
  const button=byId('aiParseButton'),status=byId('aiAccountingStatus'),input=byId('aiAccountingText');input.value='';
  if(!aiSettings.enabled){status.textContent='请先在右侧启用模型配置';status.className='ai-status error';return;}
  button.disabled=true;button.textContent='处理中…';status.textContent='AI 正在理解你的问题…';status.className='ai-status';
  try{
    const {data:sessionData}=await supabaseClient.auth.getSession();
    const response=await fetch(`${SUPABASE_URL}/functions/v1/ai-accounting`,{method:'POST',headers:{Authorization:`Bearer ${sessionData.session?.access_token||''}`,'Content-Type':'application/json'},body:JSON.stringify({mode:'chat',text:question,conversation_id:assistantConversationId,...assistantModelContext()})});
    const result=await response.json();if(!response.ok)throw new Error(result.error||'AI处理失败');
    const data=result.data||{};
    aiDraft=null;byId('aiDraftPanel').hidden=true;clearPendingAction();renderAssistantMemoryDraft(data.memory_draft||null);
    if(data.pending_action){renderPendingActionPreview(data.pending_action);}
    else if(data.draft&&['data_change','batch_update'].includes(data.draft.intent)){renderPendingActionPreview(data.draft);}
    else if(data.draft&&aiDraftIntents.has(data.draft.intent)){aiDraft={data:data.draft};renderAiDraft();}
    if(data.analysis){
      analysisResult=data.analysis;byId('analysisResult').hidden=true;
      const summaryCall=(result.tool_calls||[]).find(call=>call.name==='summarize_business');
      if(summaryCall?.arguments)await saveAssistantContext({date_field:summaryCall.arguments.date_field,period_start:summaryCall.arguments.start||null,period_end:summaryCall.arguments.end||null,order_type:summaryCall.arguments.type||'all',city:summaryCall.arguments.location||'',supplier:summaryCall.arguments.supplier||'',booker:summaryCall.arguments.booker||''});
    }
    if(data.conversation_summary){assistantConversations=assistantConversations.map(item=>item.id===assistantConversationId?{...item,summary:data.conversation_summary}:item);renderMemoryList();updateAssistantConversationHeader();}
    const answer=data.analysis?.answer||data.answer||(data.pending_action?`已生成批量修改预览，请确认影响范围后执行。`:data.draft&&aiDraftIntents.has(data.draft.intent)?`已生成${aiIntentText(data.draft.intent)}草稿，请确认后再填入表单。`:'当前没有可回答的内容。');
    await saveAssistantMessage('assistant',answer,{intent:data.analysis?'business_query':data.pending_action?'data_change':data.memory_draft?'memory_draft':data.draft&&aiDraftIntents.has(data.draft.intent)?'accounting_draft':Array.isArray(data.query_results)&&data.query_results.length?'business_query':'general_assistance',analysis:data.analysis||null,query_results:data.query_results||[],memory_draft:data.memory_draft||null,knowledge_sources:data.knowledge_sources||[],unsupported:Boolean(data.unsupported),tool_calls:result.tool_calls||[]});
    status.textContent=data.analysis?'统计完成，结果已加入对话。':Array.isArray(data.query_results)&&data.query_results.length?'查询完成，明细已加入对话。':data.pending_action?'已生成批量修改预览，请确认后执行。':data.memory_draft?'已生成记忆草稿，请确认是否保存。':data.draft&&aiDraftIntents.has(data.draft.intent)?'已生成草稿，请确认后再填入表单。':'回答完成。';status.className='ai-status success';
  }catch(error){status.textContent=error.message;status.className='ai-status error';}
  finally{button.disabled=false;button.textContent='交给 AI 处理';}
}

async function initApp(){
  if(!supabaseClient){setAuthStatus('Supabase 客户端未加载，请检查网络后刷新页面。','error');return;}
  const {data,error}=await supabaseClient.auth.getSession();
  if(error){setAuthStatus(`无法读取登录状态：${error.message}`,'error');return;}
  await handleSession(data.session);
  supabaseClient.auth.onAuthStateChange((event,session)=>{setTimeout(()=>handleSession(session,event),0);});
}
function assistantConversationLabel(conversation){return conversation?.title||'未命名对话';}
function assistantConversationStatusLabel(status){return status==='archived'?'已归档':'使用中';}
function updateAssistantConversationHeader(){const conversation=assistantConversations.find(item=>item.id===assistantConversationId);const title=byId('assistantConversationTitle'),meta=byId('assistantConversationMeta');if(title)title.textContent=assistantConversationLabel(conversation);if(meta)meta.textContent=conversation?`${assistantConversationStatusLabel(conversation.status)} · 只保留最近 100 条消息，清空不会影响订单和知识库`:'聊天记录会保存在当前会话中';}
function renderAssistantConversationHistory(){const panel=byId('assistantConversationHistory');if(!panel)return;panel.hidden=!assistantHistoryOpen;if(!assistantHistoryOpen)return;if(!assistantConversations.length){panel.innerHTML='<div class="assistant-history-empty">暂无历史会话</div>';return;}panel.innerHTML=assistantConversations.map(item=>{const archived=item.status==='archived',active=item.id===assistantConversationId;return `<div class="assistant-history-item ${archived?'archived':''} ${active?'current':''}"><div class="assistant-history-main"><strong>${escapeHtml(assistantConversationLabel(item))}${active?' · 当前':''}</strong><small>${escapeHtml(assistantConversationStatusLabel(item.status))} · ${escapeHtml(String(item.updated_at||item.created_at||'').slice(0,16).replace('T',' '))}</small></div><div class="assistant-history-actions">${archived?`<button class="button quiet" type="button" data-restore-assistant-conversation="${escapeHtml(item.id)}">恢复</button>`:`<button class="button quiet" type="button" data-open-assistant-conversation="${escapeHtml(item.id)}">打开</button>`}</div></div>`;}).join('');}
async function loadAssistantConversations(){
  const baseFields='id,title,summary,created_at,updated_at';let result=await supabaseClient.from('assistant_conversations').select(`${baseFields},status,archived_at`).eq('user_id',currentUser.id).order('updated_at',{ascending:false}).limit(50);
  if(result.error){assistantConversationStatusSupported=false;result=await supabaseClient.from('assistant_conversations').select(baseFields).eq('user_id',currentUser.id).order('updated_at',{ascending:false}).limit(50);}else assistantConversationStatusSupported=true;
  if(result.error)throw result.error;
  assistantConversations=(result.data||[]).map(item=>({...item,status:item.status||'active'}));
  if(assistantConversationStatusSupported){const cutoff=new Date(Date.now()-30*24*60*60*1000).toISOString();const stale=assistantConversations.filter(item=>item.status==='active'&&item.updated_at&&item.updated_at<cutoff);if(stale.length){const ids=stale.map(item=>item.id);const archivedAt=new Date().toISOString();const {error}=await supabaseClient.from('assistant_conversations').update({status:'archived',archived_at:archivedAt}).in('id',ids).eq('user_id',currentUser.id);if(!error)assistantConversations=assistantConversations.map(item=>ids.includes(item.id)?{...item,status:'archived',archived_at:archivedAt}:item);}}
  renderAssistantConversationHistory();updateAssistantConversationHeader();
}
async function ensureAssistantConversation(){
  if(!cloudReady||!currentUser||!supabaseClient)return false;const savedId=localStorage.getItem(assistantConversationStorageKey());let conversation=assistantConversations.find(item=>item.id===savedId&&item.status!=='archived')||assistantConversations.find(item=>item.status!=='archived');
  if(!conversation){const payload={user_id:currentUser.id,title:'AI 工作台',summary:''};if(assistantConversationStatusSupported)payload.status='active';let result=await supabaseClient.from('assistant_conversations').insert(payload).select('id,title,summary,created_at,updated_at').single();if(result.error&&assistantConversationStatusSupported){assistantConversationStatusSupported=false;result=await supabaseClient.from('assistant_conversations').insert({user_id:currentUser.id,title:'AI 工作台',summary:''}).select('id,title,summary,created_at,updated_at').single();}if(result.error)throw result.error;conversation={...result.data,status:'active'};assistantConversations=[conversation,...assistantConversations];}
  assistantConversationId=conversation.id;localStorage.setItem(assistantConversationStorageKey(),assistantConversationId);updateAssistantConversationHeader();renderAssistantConversationHistory();return true;
}
async function loadAssistantConversationData(conversationId){const [messagesResult,contextResult]=await Promise.all([supabaseClient.from('assistant_messages').select('id,role,content,metadata,created_at').eq('conversation_id',conversationId).order('created_at',{ascending:false}).limit(100),supabaseClient.from('assistant_context').select('*').eq('conversation_id',conversationId).maybeSingle()]);if(messagesResult.error)throw messagesResult.error;if(contextResult.error)throw contextResult.error;assistantMessages=(messagesResult.data||[]).reverse();assistantContext={...(contextResult.data||{}),...(contextResult.data?.context||{})};renderAssistantConversation();updateAssistantConversationHeader();}
async function loadAssistantWorkspace(){assistantWorkspaceAvailable=false;assistantMessages=[];assistantContext={};assistantKnowledge=[];assistantMemories=[];assistantMemoryDraft=null;assistantConversations=[];renderAssistantConversation();renderKnowledgeList();renderMemoryList();if(!cloudReady||!currentUser||!supabaseClient)return;try{await loadAssistantConversations();await ensureAssistantConversation();const {data:knowledge,error}=await supabaseClient.from('assistant_knowledge').select('id,title,category,scope,content,source,status,version,updated_at').order('updated_at',{ascending:false}).limit(50);if(error)throw error;await loadAssistantConversationData(assistantConversationId);assistantKnowledge=knowledge||[];await loadAssistantMemories();assistantWorkspaceAvailable=true;renderAssistantConversation();renderKnowledgeList();renderMemoryList();}catch(error){if(!['42P01','PGRST205'].includes(error?.code)&&error?.status!==404)console.warn('AI workspace data unavailable',error.message);renderAssistantConversation();renderKnowledgeList();renderMemoryList();}}
async function switchAssistantConversation(id){const conversation=assistantConversations.find(item=>item.id===id);if(!conversation||conversation.status==='archived')return;assistantConversationId=id;localStorage.setItem(assistantConversationStorageKey(),id);assistantMessages=[];assistantContext={};assistantHistoryOpen=false;renderAssistantConversationHistory();await loadAssistantConversationData(id);byId('aiAccountingStatus').textContent='已切换到历史会话';byId('aiAccountingStatus').className='ai-status success';}
async function createAssistantConversation(){if(!currentUser||!supabaseClient||!cloudReady){window.alert('请先登录云端账户');return;}const payload={user_id:currentUser.id,title:'AI 工作台',summary:''};if(assistantConversationStatusSupported)payload.status='active';let result=await supabaseClient.from('assistant_conversations').insert(payload).select('id,title,summary,created_at,updated_at').single();if(result.error&&assistantConversationStatusSupported){assistantConversationStatusSupported=false;result=await supabaseClient.from('assistant_conversations').insert({user_id:currentUser.id,title:'AI 工作台',summary:''}).select('id,title,summary,created_at,updated_at').single();}if(result.error){window.alert(`新建对话失败：${result.error.message}`);return;}const conversation={...result.data,status:'active'};assistantConversations=[conversation,...assistantConversations];assistantConversationId=conversation.id;localStorage.setItem(assistantConversationStorageKey(),assistantConversationId);assistantMessages=[];assistantContext={};assistantMemoryDraft=null;assistantPendingAction=null;assistantHistoryOpen=false;renderAssistantMemoryDraft(null);renderAssistantConversation();renderAssistantConversationHistory();renderMemoryList();updateAssistantConversationHeader();}
async function clearAssistantConversation(){if(!assistantConversationId)return;if(!window.confirm('确认清空当前对话吗？\n\n只会删除聊天消息、当前对话摘要和筛选口径，不会删除订单、其它收入、专业知识或已确认记忆。'))return;const [messagesResult,contextResult,conversationResult]=await Promise.all([supabaseClient.from('assistant_messages').delete().eq('conversation_id',assistantConversationId).eq('user_id',currentUser.id),supabaseClient.from('assistant_context').delete().eq('conversation_id',assistantConversationId).eq('user_id',currentUser.id),supabaseClient.from('assistant_conversations').update({summary:''}).eq('id',assistantConversationId).eq('user_id',currentUser.id)]);if(messagesResult.error||contextResult.error||conversationResult.error){window.alert(`清空失败：${messagesResult.error?.message||contextResult.error?.message||conversationResult.error?.message}`);return;}assistantMessages=[];assistantContext={};assistantMemoryDraft=null;assistantConversations=assistantConversations.map(item=>item.id===assistantConversationId?{...item,summary:''}:item);assistantPendingAction=null;byId('aiDraftPanel').hidden=true;byId('analysisResult').hidden=true;clearPendingAction();renderAssistantMemoryDraft(null);renderAssistantConversation();renderMemoryList();updateAssistantConversationHeader();byId('aiAccountingStatus').textContent='当前对话已清空，订单、记忆和知识库未受影响';byId('aiAccountingStatus').className='ai-status success';}
async function archiveAssistantConversation(){if(!assistantConversationId)return;if(!assistantConversationStatusSupported){window.alert('请先在 Supabase 执行 supabase/assistant-conversations-migration.sql，再使用归档功能。');return;}if(!window.confirm('确认归档当前对话吗？归档后会自动新建一个空白对话。'))return;const archivedAt=new Date().toISOString();const {error}=await supabaseClient.from('assistant_conversations').update({status:'archived',archived_at:archivedAt}).eq('id',assistantConversationId).eq('user_id',currentUser.id);if(error){window.alert(`归档失败：${error.message}`);return;}assistantConversations=assistantConversations.map(item=>item.id===assistantConversationId?{...item,status:'archived',archived_at:archivedAt}:item);await createAssistantConversation();}
async function restoreAssistantConversation(id){if(!assistantConversationStatusSupported)return;const {error}=await supabaseClient.from('assistant_conversations').update({status:'active',archived_at:null}).eq('id',id).eq('user_id',currentUser.id);if(error){window.alert(`恢复失败：${error.message}`);return;}assistantConversations=assistantConversations.map(item=>item.id===id?{...item,status:'active',archived_at:null}:item);await switchAssistantConversation(id);}
async function saveAssistantMessage(role,content,metadata={}){if(!content)return;const record={role,content:String(content),metadata,created_at:new Date().toISOString()};assistantMessages=[...assistantMessages.slice(-99),record];renderAssistantConversation();if(!assistantWorkspaceAvailable||!assistantConversationId||!currentUser||!supabaseClient)return;const {error}=await supabaseClient.from('assistant_messages').insert({user_id:currentUser.id,conversation_id:assistantConversationId,role,content:String(content),metadata});if(error){console.warn('AI message save failed',error.message);return;}const {data:oldMessages}=await supabaseClient.from('assistant_messages').select('id').eq('conversation_id',assistantConversationId).order('created_at',{ascending:false}).range(100,1000);if(oldMessages?.length)await supabaseClient.from('assistant_messages').delete().in('id',oldMessages.map(item=>item.id)).eq('user_id',currentUser.id);}
document.addEventListener('click',event=>{if(event.target.closest('[data-confirm-memory]')){confirmAssistantMemory();return;}if(event.target.closest('[data-cancel-memory]')){renderAssistantMemoryDraft(null);byId('aiAccountingStatus').textContent='已取消保存记忆';byId('aiAccountingStatus').className='ai-status';return;}const memoryAction=event.target.closest('[data-memory-action]');if(memoryAction){updateMemoryRecord(memoryAction.dataset.memoryId,memoryAction.dataset.memoryAction);return;}if(event.target.closest('#newAssistantConversation')){createAssistantConversation();return;}if(event.target.closest('#toggleAssistantHistory')){assistantHistoryOpen=!assistantHistoryOpen;renderAssistantConversationHistory();return;}if(event.target.closest('#archiveAssistantConversation')){archiveAssistantConversation();return;}if(event.target.closest('#clearAssistantConversation')){clearAssistantConversation();return;}const open=event.target.closest('[data-open-assistant-conversation]');if(open){switchAssistantConversation(open.dataset.openAssistantConversation);return;}const restore=event.target.closest('[data-restore-assistant-conversation]');if(restore){restoreAssistantConversation(restore.dataset.restoreAssistantConversation);return;}});
mountWorkspacePages();
initApp();

async function loadAssistantConversationData(conversationId){
  const [messagesResult,contextResult,pendingResult]=await Promise.all([
    supabaseClient.from('assistant_messages').select('id,role,content,metadata,created_at').eq('conversation_id',conversationId).order('created_at',{ascending:false}).limit(100),
    supabaseClient.from('assistant_context').select('*').eq('conversation_id',conversationId).maybeSingle(),
    supabaseClient.from('assistant_pending_actions').select('id,action_type,affected_record_ids,preview,status,expires_at').eq('conversation_id',conversationId).eq('status','pending').order('created_at',{ascending:false}).limit(1).maybeSingle(),
  ]);
  if(messagesResult.error)throw messagesResult.error;
  if(contextResult.error)throw contextResult.error;
  if(pendingResult.error&&!['42P01','PGRST205'].includes(pendingResult.error.code)&&pendingResult.error.status!==404)throw pendingResult.error;
  assistantMessages=(messagesResult.data||[]).reverse();
  assistantContext={...(contextResult.data||{}),...(contextResult.data?.context||{})};
  renderAssistantMemoryDraft(null);
  const pending=pendingResult.data;
  if(pending?.preview){assistantPendingAction={...pending.preview,pending_action_id:pending.id,status:'pending_confirmation'};renderPendingActionPreview(assistantPendingAction);}else{clearPendingAction();}
  renderAssistantConversation();
  renderMemoryList();
  updateAssistantConversationHeader();
}

async function requestAssistantAction(mode, actionId){
  const {data:sessionData}=await supabaseClient.auth.getSession();
  const response=await fetch(`${SUPABASE_URL}/functions/v1/ai-accounting`,{method:'POST',headers:{Authorization:`Bearer ${sessionData.session?.access_token||''}`,'Content-Type':'application/json'},body:JSON.stringify({mode,action_id:actionId})});
  const result=await response.json();
  if(!response.ok)throw new Error(result.error||'服务端任务执行失败');
  return result;
}

async function confirmAssistantPendingAction(){
  const action=assistantPendingAction,actionId=action?.pending_action_id||action?.id;
  if(!actionId)return;
  const button=byId('aiPendingActionPanel')?.querySelector('[data-confirm-ai-change]');
  if(button){button.disabled=true;button.textContent='服务端校验中…';}
  try{
    const result=await requestAssistantAction('confirm_action',actionId);
    await loadCloudData({allowMigration:false,silent:true});
    clearPendingAction();
    renderAll();
    const updated=Number(result.data?.updated_count||0);
    const status=byId('aiAccountingStatus');
    status.textContent=result.data?.status==='already_confirmed'?'该任务已完成，未重复修改订单':`已完成：${updated} 笔订单已由服务端修改`;
    status.className='ai-status success';
  }catch(error){
    const status=byId('aiAccountingStatus');
    status.textContent=error.message||'服务端任务执行失败';
    status.className='ai-status error';
    if(button){button.disabled=false;button.textContent='确认修改';}
  }
}

async function cancelAssistantPendingAction(){
  const action=assistantPendingAction,actionId=action?.pending_action_id||action?.id;
  clearPendingAction();
  const status=byId('aiAccountingStatus');
  if(!actionId){status.textContent='已取消批量修改，未改变任何订单';status.className='ai-status';return;}
  try{
    await requestAssistantAction('cancel_action',actionId);
    status.textContent='已取消批量修改，未改变任何订单';
    status.className='ai-status';
  }catch(error){
    status.textContent=`本地已隐藏预览，但服务端取消失败：${error.message||'未知错误'}`;
    status.className='ai-status error';
  }
}

document.addEventListener('click',event=>{
  const cancel=event.target.closest('[data-cancel-ai-change]');
  if(!cancel)return;
  event.preventDefault();
  event.stopImmediatePropagation();
  cancelAssistantPendingAction();
},true);

// Split payment form behavior: the database keeps customer receipt and supplier
// payment as separate facts, while commission/no-funds settlements hide both.
syncSettlementFields = function syncSplitSettlementFields(){
  const mode=byId('settlementMode').value;
  const commission=mode==='guest_pay_commission';
  const noFunds=mode==='no_funds';
  const hideSettlementFields=commission||noFunds;
  document.querySelectorAll('.settlement-detail').forEach(el=>el.classList.toggle('hidden',!commission));
  ['costLabel','paymentStatusLabel','paymentPlatformLabel','receivedLabel','supplierPaymentStatusLabel','supplierPaidLabel'].forEach(id=>byId(id)?.classList.toggle('hidden',hideSettlementFields));
  if(hideSettlementFields){
    byId('paymentStatus').value='not_applicable';
    byId('received').value=0;
    byId('supplierPaymentStatus').value='not_required';
    byId('supplierPaid').value=0;
    byId('cost').value=0;
  }else{
    if(byId('paymentStatus').value==='not_applicable')byId('paymentStatus').value='paid';
    if(byId('supplierPaymentStatus').value==='not_required')byId('supplierPaymentStatus').value='unknown';
  }
  byId('quantityPreview').textContent=commission?'\u5ba2\u4eba\u524d\u53f0\u652f\u4ed8 \u00b7 \u5e73\u53f0\u8fd4\u4f63':byId('quantityPreview').textContent;
  refreshFormPreview();
};

const openEditOrderSplit = openEditOrder;
openEditOrder = function openEditOrderWithSplitFields(id){
  openEditOrderSplit(id);
  const order=orders.find(item=>item.id===id);
  if(!order)return;
  byId('paymentStatus').value=customerPaymentStatus(order);
  byId('supplierPaymentStatus').value=supplierPaymentStatus(order);
  byId('supplierPaid').value=supplierPaid(order);
  syncSettlementFields();
};

document.addEventListener('click',event=>{
  if(event.target.id!=='openOrderDialog')return;
  byId('paymentStatus').value='paid';
  byId('supplierPaymentStatus').value='unknown';
  byId('supplierPaid').value=0;
  syncSettlementFields();
});

migrateLocalData = async function migrateScopedLocalData(){
  if(!currentUser||!supabaseClient||!canFeature('orders.import')){window.alert('当前账号没有导入数据权限');return;}
  const parse=(key,fallback)=>{try{const value=JSON.parse(localStorage.getItem(key)||'null');return Array.isArray(value)?value:fallback;}catch{return fallback;}};
  const scopedOrders=parse(userStorageKey('qizhang-orders'),[]), legacyOrders=parse('qizhang-orders',[]);
  const scopedIncomes=parse(userStorageKey('qizhang-other-income'),[]), legacyIncomes=parse('qizhang-other-income',[]);
  const importOrders=scopedOrders.length?scopedOrders:legacyOrders, importIncomes=scopedIncomes.length?scopedIncomes:legacyIncomes;
  if(!importOrders.length&&!importIncomes.length){window.alert('当前浏览器没有可上传的本地数据');return;}
  if(!window.confirm(`确认把本地数据上传到当前账号 ${currentUser.email} 吗？\n\n订单：${importOrders.length} 笔\n其它收入：${importIncomes.length} 笔\n\n请确认当前登录账号正确。`))return;
  cloudBusy=true;setSyncStatus('正在上传当前账号的本地数据…','syncing');
  try{
    if(importOrders.length){orders=importOrders.map(order=>({...order}));const {error}=await supabaseClient.from('orders').upsert(orders.map(orderToRow),{onConflict:'user_id,id'});if(error)throw error;}
    if(importIncomes.length){otherIncomes=importIncomes.map(item=>({...item}));const {error}=await supabaseClient.from('other_income').upsert(otherIncomes.map(otherIncomeToRow),{onConflict:'user_id,id'});if(error)throw error;}
    await loadCloudData({allowMigration:false});window.alert('本地数据已上传到当前账号。');
  }catch(error){setSyncStatus(`上传失败：${error.message}`,'sync-error');window.alert(`上传失败：${error.message}`);}
  finally{cloudBusy=false;}
};

document.addEventListener('click',event=>{
  if(event.target.id==='applyFilters'){
    supplierPaymentFilter=byId('supplierPaymentFilter').value;
    orderPage=1;
    renderOrders();
  }
  if(event.target.id==='clearFilters'){
    supplierPaymentFilter='all';
    byId('supplierPaymentFilter').value='all';
    renderOrders();
  }
});

// The legacy quick-payment action still writes paymentStatus. Clear the split
// field before it runs so orderToRow safely falls back to the updated value.
document.addEventListener('click',event=>{
  if(event.target.id!=='addPayment')return;
  const order=orders.find(item=>item.id===event.target.dataset.id);
  if(order&&!isCommissionOrder(order))order.customerPaymentStatus=null;
},true);

document.addEventListener('change',event=>{
  if(event.target.id==='excelFile'){
    supplierPaymentFilter='all';
    if(byId('supplierPaymentFilter'))byId('supplierPaymentFilter').value='all';
  }
},true);

function adminStatusClass(status){return ['approved','rejected','suspended','pending'].includes(status)?status:'pending';}
function renderAdminUsers(){
  const table=byId('adminUserTable');if(!table)return;
  table.innerHTML=adminUsers.map(user=>`<tr><td><strong>${escapeHtml(user.email||user.user_id)}</strong><small>${escapeHtml(user.display_name||'')}</small></td><td>${user.role==='admin'?'管理员':'普通用户'}</td><td><span class="admin-user-status ${adminStatusClass(user.account_status)}">${featureText(user.account_status)}</span></td><td>${escapeHtml(String(user.created_at||'').slice(0,16).replace('T',' '))}</td><td class="row-actions">${user.role!=='admin'&&user.account_status==='pending'?`<button class="button quiet" data-admin-status="approved" data-admin-user="${user.user_id}">通过</button><button class="button quiet danger" data-admin-status="rejected" data-admin-user="${user.user_id}">拒绝</button>`:''}${user.role!=='admin'&&user.account_status==='approved'?`<button class="button quiet danger" data-admin-status="suspended" data-admin-user="${user.user_id}">暂停</button>`:''}${user.role!=='admin'&&user.account_status!=='approved'?`<button class="button quiet" data-admin-status="approved" data-admin-user="${user.user_id}">通过</button>`:''}${user.role!=='admin'?`<button class="button quiet" data-admin-permissions="${user.user_id}">权限</button>`:''}</td></tr>`).join('')||'<tr><td colspan="5"><div class="empty-state">暂无注册用户</div></td></tr>';
}
function auditActionLabel(action){return ({account_approved:'通过审核',account_rejected:'拒绝注册',account_suspended:'暂停账号',permissions_updated:'更新功能权限'})[action]||action||'未知操作';}
function renderAdminAuditLogs(logs=[]){
  const table=byId('adminAuditTable');if(!table)return;
  table.innerHTML=logs.map(log=>`<tr><td>${escapeHtml(String(log.created_at||'').slice(0,16).replace('T',' '))}</td><td>${escapeHtml(log.actor_user_id||'管理员')}</td><td>${escapeHtml(log.target_user_id||'—')}</td><td>${escapeHtml(auditActionLabel(log.action))}</td></tr>`).join('')||'<tr><td colspan="4"><div class="empty-state">暂无管理员操作记录</div></td></tr>';
}
async function loadAdminAuditLogs(){
  if(currentProfile?.role!=='admin'||!supabaseClient)return;
  const {data,error}=await supabaseClient.from('admin_audit_logs').select('id,actor_user_id,target_user_id,action,details,created_at').order('created_at',{ascending:false}).limit(100);
  if(error){console.warn('Admin audit logs unavailable',error.message);renderAdminAuditLogs([]);return;}
  renderAdminAuditLogs(data||[]);
}
async function loadAdminUsers(){
  if(currentProfile?.role!=='admin'||!supabaseClient)return;
  const status=byId('adminStatus');if(status)status.textContent='正在读取用户列表…';
  const {data,error}=await supabaseClient.from('profiles').select('user_id,email,display_name,role,account_status,approved_at,created_at,updated_at').order('created_at',{ascending:false});
  if(error){if(status){status.textContent=error.message;status.className='ai-status error';}return;}
  adminUsers=data||[];renderAdminUsers();if(status){status.textContent=`共 ${adminUsers.length} 个账号`;status.className='ai-status success';}
}
async function openAdminPermissions(userId){
  const user=adminUsers.find(item=>item.user_id===userId);if(!user)return;
  selectedAdminUserId=userId;byId('adminPermissionPanel').hidden=false;byId('adminPermissionTitle').textContent=`功能权限 · ${user.email}`;
  const [featuresResult,permissionsResult]=await Promise.all([supabaseClient.from('feature_catalog').select('feature_key,label,description,sort_order').order('sort_order'),supabaseClient.from('user_feature_permissions').select('feature_key,enabled').eq('user_id',userId)]);
  if(featuresResult.error||permissionsResult.error){byId('adminPermissionStatus').textContent=featuresResult.error?.message||permissionsResult.error?.message;return;}
  const enabled=new Set((permissionsResult.data||[]).filter(item=>item.enabled).map(item=>item.feature_key));
  byId('adminPermissionList').innerHTML=(featuresResult.data||[]).map(feature=>`<label class="admin-permission-item"><input type="checkbox" data-admin-feature="${escapeHtml(feature.feature_key)}" ${enabled.has(feature.feature_key)?'checked':''}><span><strong>${escapeHtml(feature.label)}</strong><small>${escapeHtml(feature.description||feature.feature_key)}</small></span></label>`).join('');
  byId('adminPermissionStatus').textContent='勾选后保存，权限会立即影响后端请求。';
}
async function saveAdminPermissions(){
  if(!selectedAdminUserId||currentProfile?.role!=='admin')return;
  const button=byId('saveAdminPermissions');button.disabled=true;
  const rows=[...document.querySelectorAll('[data-admin-feature]')].map(input=>({user_id:selectedAdminUserId,feature_key:input.dataset.adminFeature,enabled:input.checked,granted_by:currentUser.id}));
  const {error}=await supabaseClient.from('user_feature_permissions').upsert(rows,{onConflict:'user_id,feature_key'});
  if(!error){await supabaseClient.from('admin_audit_logs').insert({actor_user_id:currentUser.id,target_user_id:selectedAdminUserId,action:'permissions_updated',details:{features:rows.filter(row=>row.enabled).map(row=>row.feature_key)}});await loadAdminAuditLogs();}
  if(error)byId('adminPermissionStatus').textContent=error.message;else byId('adminPermissionStatus').textContent='权限已保存';
  button.disabled=false;
}
async function updateAdminUserStatus(userId,nextStatus){
  if(currentProfile?.role!=='admin')return;
  const user=adminUsers.find(item=>item.user_id===userId);if(!user)return;
  if(nextStatus==='rejected'&&!window.confirm(`确定拒绝 ${user.email} 的注册申请吗？`))return;
  const patch={account_status:nextStatus,approved_at:nextStatus==='approved'?new Date().toISOString():null,approved_by:nextStatus==='approved'?currentUser.id:null,rejected_reason:nextStatus==='rejected'?'管理员拒绝':' '};
  const {error}=await supabaseClient.from('profiles').update(patch).eq('user_id',userId);
  if(error){byId('adminStatus').textContent=error.message;byId('adminStatus').className='ai-status error';return;}
  await supabaseClient.from('admin_audit_logs').insert({actor_user_id:currentUser.id,target_user_id:userId,action:`account_${nextStatus}`,details:{status:nextStatus}});
  await loadAdminUsers();await loadAdminAuditLogs();
}

const showViewWithAccess=showView;
showView=function showViewWithFeatureAccess(view){
  const feature=featureForView[view];
  if(feature&&!canFeature(feature)){window.alert('当前账号没有使用此功能的权限');return;}
  showViewWithAccess(view);
  document.querySelectorAll('.order-toolbar-only').forEach(element=>element.classList.toggle('hidden',view==='otherIncome'||view==='ai'||view==='knowledge'||view==='settings'||view==='memory'||view==='admin'));
  if(view==='admin')byId('viewTitle').textContent='用户管理';
  if(view==='admin'){loadAdminUsers();loadAdminAuditLogs();}
};
applyFeatureVisibility=function applyFeatureVisibilityWithActions(){
  document.querySelectorAll('[data-view]').forEach(item=>{const feature=featureForView[item.dataset.view];item.hidden=Boolean(feature&&!canFeature(feature));});
  document.querySelectorAll('.admin-only').forEach(item=>{item.hidden=currentProfile?.role!=='admin';});
  const actionMap={openOrderDialog:'orders.edit',importExcel:'orders.import',openOtherIncomeDialog:'other_income.manage',aiParseButton:'ai.use',aiFillButton:'ai.use',knowledgeForm:'knowledge.submit',scanDataQuality:'quality.view'};
  Object.entries(actionMap).forEach(([id,feature])=>{const element=byId(id);if(element)element.hidden=!canFeature(feature);});
  if(byId('knowledgeForm'))byId('knowledgeForm').hidden=!canFeature('knowledge.submit');
};
applyFeatureVisibility();

const renderKnowledgeListLegacy=renderKnowledgeList;
renderKnowledgeList=function renderKnowledgeListWithSharedAccess(){
  renderKnowledgeListLegacy();
  if(currentProfile?.role!=='admin')document.querySelectorAll('#knowledgeList [data-knowledge-action="publish"],#knowledgeList [data-knowledge-action="archive"]').forEach(button=>button.remove());
};
updateKnowledgeStatus=async function updateKnowledgeStatusWithAdminAccess(id,statusValue){
  if(!currentUser||!supabaseClient)return;
  const payload={status:statusValue,reviewed_at:statusValue==='published'?new Date().toISOString():null,scope:statusValue==='published'?'global':'personal'};
  let request=supabaseClient.from('assistant_knowledge').update(payload).eq('id',id);
  if(currentProfile?.role!=='admin')request=request.eq('user_id',currentUser.id);
  const {error}=await request;
  if(error){window.alert(`知识状态更新失败：${error.message}`);return;}
  await loadAssistantWorkspace();
};

function renderKnowledgeListWithTools(){
  const panel=byId('knowledgeList');if(!panel)return;
  const query=(byId('knowledgeSearch')?.value||'').trim().toLowerCase();
  const status=byId('knowledgeStatusFilter')?.value||'all';
  const category=byId('knowledgeCategoryFilter')?.value||'all';
  const list=assistantKnowledge.filter(item=>{
    const haystack=String(item.title||'')+' '+String(item.content||'')+' '+String(item.source||'')+' '+String(item.scope||'');
    return (status==='all'||item.status===status)&&(category==='all'||item.category===category)&&(!query||haystack.toLowerCase().includes(query));
  });
  if(!list.length){panel.innerHTML='<span class="ai-status">没有匹配的知识。保存后会先进入草稿，发布后 AI 才会检索使用。</span>';return;}
  panel.innerHTML=list.map(item=>{
    const actions=(item.status==='draft'?'<button class="button quiet" data-knowledge-action="publish" data-knowledge-id="'+escapeHtml(item.id)+'">发布使用</button>':'')+(item.status==='published'?'<button class="button quiet" data-knowledge-action="archive" data-knowledge-id="'+escapeHtml(item.id)+'">标记废弃</button>':'');
    return '<article class="knowledge-card"><div class="knowledge-card-head"><span class="knowledge-card-title">'+escapeHtml(item.title||'未命名知识')+'</span><span class="knowledge-status '+escapeHtml(item.status||'draft')+'">'+assistantStatusText(item.status)+'</span></div><div class="knowledge-card-meta"><span>'+assistantKnowledgeCategoryText(item.category)+'</span><span>版本 '+escapeHtml(item.version||1)+'</span><span>'+escapeHtml(item.scope||'personal')+'</span><span>'+escapeHtml(item.source||'用户提供')+'</span></div><p>'+escapeHtml(item.content||'')+'</p><div class="knowledge-card-actions">'+actions+'</div></article>';
  }).join('');
}
renderKnowledgeList=renderKnowledgeListWithTools;

async function importKnowledgeFile(){
  const file=byId('knowledgeFile')?.files?.[0], status=byId('knowledgeImportStatus');
  if(!file){status.textContent='请先选择 Markdown、Word 或 PDF 文件。';status.className='ai-status error';return;}
  status.textContent='正在读取文件…';status.className='ai-status';
  try{
    const extension=file.name.split('.').pop()?.toLowerCase();let content='';
    if(['md','markdown','txt'].includes(extension))content=await file.text();
    else if(extension==='docx'){
      if(!window.mammoth)throw new Error('Word 解析组件未加载，请检查网络后刷新。');
      const result=await window.mammoth.extractRawText({arrayBuffer:await file.arrayBuffer()});content=result.value||'';
    }else if(extension==='pdf'){
      const pdfjs=await import('https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs');
      pdfjs.GlobalWorkerOptions.workerSrc='https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs';
      const pdf=await pdfjs.getDocument({data:await file.arrayBuffer()}).promise;const pages=[];
      for(let pageNumber=1;pageNumber<=pdf.numPages;pageNumber++){const page=await pdf.getPage(pageNumber);const text=await page.getTextContent();pages.push(text.items.map(item=>item.str||'').join(' '));}
      content=pages.join('\n\n');
    }else throw new Error('暂不支持该文件类型。');
    if(!content.trim())throw new Error('文件中没有可读取的文字。');
    byId('knowledgeTitle').value=file.name.replace(/\.[^.]+$/,'');
    byId('knowledgeContent').value=content.trim();
    byId('knowledgeSource').value=file.name;
    status.textContent='文件已导入表单，请检查标题、分类和内容后保存草稿。';status.className='ai-status success';
  }catch(error){status.textContent='导入失败：'+error.message;status.className='ai-status error';}
}
byId('knowledgeImportFile')?.addEventListener('click',importKnowledgeFile);
['knowledgeSearch','knowledgeStatusFilter','knowledgeCategoryFilter'].forEach(id=>byId(id)?.addEventListener('input',renderKnowledgeListWithTools));
document.addEventListener('submit',event=>{
  if(event.target.id!=='knowledgeForm')return;
  const keywords=byId('knowledgeKeywords')?.value.trim(),scope=byId('knowledgeScopeText')?.value.trim();
  if(keywords)byId('knowledgeScopeText').value=[scope,'标签：'+keywords].filter(Boolean).join(' / ');
},true);

document.addEventListener('click',event=>{
  const statusButton=event.target.closest('[data-admin-status]');if(statusButton){updateAdminUserStatus(statusButton.dataset.adminUser,statusButton.dataset.adminStatus);return;}
  const permissionButton=event.target.closest('[data-admin-permissions]');if(permissionButton){openAdminPermissions(permissionButton.dataset.adminPermissions);return;}
  if(event.target.id==='refreshAdminUsers')loadAdminUsers();
  if(event.target.id==='closeAdminPermission'){byId('adminPermissionPanel').hidden=true;selectedAdminUserId=null;}
  if(event.target.id==='saveAdminPermissions')saveAdminPermissions();
  if(event.target.id==='approvalSignOut')signOut();
  if(event.target.id==='approvalRefresh'){lastHandledSessionKey=null;handleSession({user:currentUser});}
});
