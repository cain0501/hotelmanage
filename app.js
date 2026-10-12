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
const storedOrders = JSON.parse(localStorage.getItem('qizhang-orders') || 'null');
const localOrders = Array.isArray(storedOrders) && !looksLikeBrokenImport(storedOrders) ? storedOrders : [];
localOrders.forEach((order,index)=>{if(!order.orderCode)order.orderCode=`ORD-${String(index+1).padStart(5,'0')}`;});
let orders = [];
let activeType = 'all';
const ORDER_PAGE_SIZE = 50;
let orderPage = 1;
let activeView = 'dashboard';
let searchTerm = '';
let selectedOrderId = null;
let calculatorTarget = null;
let dateField = 'orderDate';
let dateStart = '';
let dateEnd = '';
let dashboardDateField = 'orderDate';
let statusFilter = 'all';
let paymentFilter = 'all';
let invoiceFilter = 'all';
let locationFilter = '';
let supplierFilter = '';
const localOtherIncomes = JSON.parse(localStorage.getItem('qizhang-other-income') || '[]');
let otherIncomes = [];

const byId = id => document.getElementById(id);
const SUPABASE_URL = 'https://onomizgpzhqrmiuqeikf.supabase.co';
// Publishable key 只能用于浏览器端，RLS 才是数据安全边界；不要替换成 service_role key。
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_PfLkfwLJTSGCIchlm3_xiQ_LuLj_JOC';
const supabaseClient = window.supabase?.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
let currentUser = null;
let realtimeChannel = null;
let cloudReady = false;
let cloudBusy = false;
const saveLocalOrders = () => localStorage.setItem('qizhang-orders', JSON.stringify(orders));
const saveLocalOtherIncomes = () => localStorage.setItem('qizhang-other-income', JSON.stringify(otherIncomes));
const save = async () => {
  saveLocalOrders();
  if (!cloudReady || !currentUser) return;
  setSyncStatus('正在同步订单…', 'syncing');
  const { error } = await supabaseClient.from('orders').upsert(orders.map(orderToRow), { onConflict: 'user_id,id' });
  if (error) { setSyncStatus(`同步失败：${error.message}`, 'sync-error'); throw error; }
  setSyncStatus('已同步到云端', 'synced');
};
const saveOtherIncomes = async () => {
  saveLocalOtherIncomes();
  if (!cloudReady || !currentUser) return;
  setSyncStatus('正在同步其它收入…', 'syncing');
  const { error } = await supabaseClient.from('other_income').upsert(otherIncomes.map(otherIncomeToRow), { onConflict: 'user_id,id' });
  if (error) { setSyncStatus(`同步失败：${error.message}`, 'sync-error'); throw error; }
  setSyncStatus('已同步到云端', 'synced');
};
const orderCode = order => order.orderCode || order.id;
const profit = order => order.profitOverride !== null && order.profitOverride !== undefined ? Number(order.profitOverride) : Number(order.gmv) - Number(order.cost);
const roomNights = order => order.type === 'hotel' ? Number(order.rooms || 1) * Number(order.nights || 0) : 0;
const payment = order => order.paymentStatus || (order.received >= order.gmv ? 'paid' : order.received > 0 ? 'partial' : 'unpaid');
const paymentText = order => ({ paid:'已收款', partial:'部分付款', unpaid:'未付款', refunded:'已退款', unknown:'待核对' })[payment(order)];
const invoiceStatus = order => order.invoiceStatus || (order.invoiceCompany ? 'issued' : 'unissued');
const invoiceText = order => invoiceStatus(order) === 'issued' ? '已开票' : '未开票';
const statusText = order => ({ booked:'预订中', confirming:'确认中', confirmed:'已确认', cancelled:'已取消', pending:'待出票', ticketed:'已出票', refunded:'已退票' })[order.status] || '待确认';
const typeName = order => order.type === 'hotel' ? '酒店' : '机票';
const emptyToNull = value => value === '' || value === undefined ? null : value;
const asNumber = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const orderToRow = order => ({
  id: order.id, user_id: currentUser?.id, order_code: orderCode(order), type: order.type,
  customer: order.customer || '', booker: order.booker || '', order_date: emptyToNull(order.orderDate), service_date: emptyToNull(order.serviceDate),
  location: order.location || '', supplier: order.supplier || '', product: order.product || '', rooms: asNumber(order.rooms), nights: asNumber(order.nights), tickets: asNumber(order.tickets),
  confirmation: order.confirmation || '', gmv: asNumber(order.gmv), cost: asNumber(order.cost), received: asNumber(order.received), payment_status: payment(order),
  payment_platform: order.paymentPlatform || '', invoice_status: invoiceStatus(order), invoice_company: order.invoiceCompany || '', profit_override: emptyToNull(order.profitOverride),
  status: order.status || 'booked', issues: Array.isArray(order.issues) ? order.issues : []
});
const rowToOrder = row => ({
  id: row.id, orderCode: row.order_code || row.id, type: row.type || 'hotel', customer: row.customer || '', booker: row.booker || '', orderDate: row.order_date || '', serviceDate: row.service_date || '',
  location: row.location || '', supplier: row.supplier || '', product: row.product || '', rooms: asNumber(row.rooms), nights: asNumber(row.nights), tickets: asNumber(row.tickets), confirmation: row.confirmation || '',
  gmv: asNumber(row.gmv), cost: asNumber(row.cost), received: asNumber(row.received), paymentStatus: row.payment_status || 'paid', paymentPlatform: row.payment_platform || '',
  invoiceStatus: row.invoice_status || 'unissued', invoiceCompany: row.invoice_company || '', profitOverride: row.profit_override === null || row.profit_override === undefined ? null : asNumber(row.profit_override),
  status: row.status || 'booked', issues: Array.isArray(row.issues) ? row.issues : []
});
const otherIncomeToRow = item => ({ id: item.id, user_id: currentUser?.id, income_date: emptyToNull(item.date) || today, name: item.name || '', order_id: item.orderId || null, amount: asNumber(item.amount), expense: asNumber(item.expense) });
const rowToOtherIncome = row => ({ id: row.id, date: row.income_date || '', name: row.name || '', orderId: row.order_id || '', amount: asNumber(row.amount), expense: asNumber(row.expense) });
function setSyncStatus(message, state='') { const element=byId('cloudStatus'); if(!element)return; element.textContent=message; element.className=state; }
function setAuthStatus(message, state='') { const element=byId('authStatus'); if(!element)return; element.textContent=message; element.className=state ? `auth-status-${state}` : ''; }
function showAuthenticatedUI(isAuthenticated) { byId('authShell').hidden=isAuthenticated; byId('appShell').hidden=!isAuthenticated; }
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
  if (allowMigration && !orders.length && !otherIncomes.length && localOrders.length) {
    const shouldMigrate = window.confirm(`云端暂时没有数据，发现本地浏览器中有 ${localOrders.length} 笔订单。是否上传到云端？\n\n不会自动上传示例数据。`);
    if (shouldMigrate) await migrateLocalData();
  }
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
async function setupRealtime() {
  if (!supabaseClient || !currentUser) return;
  if (realtimeChannel) await supabaseClient.removeChannel(realtimeChannel);
  realtimeChannel = supabaseClient.channel(`ledger-sync-${currentUser.id}`)
    .on('postgres_changes', { event:'*', schema:'public', table:'orders', filter:`user_id=eq.${currentUser.id}` }, () => loadCloudData({ allowMigration:false, silent:true }).catch(error => setSyncStatus(`实时同步失败：${error.message}`, 'sync-error')))
    .on('postgres_changes', { event:'*', schema:'public', table:'other_income', filter:`user_id=eq.${currentUser.id}` }, () => loadCloudData({ allowMigration:false, silent:true }).catch(error => setSyncStatus(`实时同步失败：${error.message}`, 'sync-error')))
    .subscribe();
}
async function handleSession(session) {
  currentUser = session?.user || null;
  if (!currentUser) {
    cloudReady=false; orders=[]; otherIncomes=[]; showAuthenticatedUI(false); setAuthStatus('');
    if (realtimeChannel && supabaseClient) { await supabaseClient.removeChannel(realtimeChannel); realtimeChannel=null; }
    return;
  }
  showAuthenticatedUI(true); byId('currentUserEmail').textContent=currentUser.email || ''; setSyncStatus('正在读取云端数据…', 'syncing');
  try { await loadCloudData(); await setupRealtime(); } catch (error) { cloudReady=false; setSyncStatus(`云端连接失败：${error.message}`, 'sync-error'); window.alert(`云端数据库还未准备好或连接失败：${error.message}\n\n请先在 Supabase SQL Editor 执行项目里的 supabase-schema.sql。`); renderAll(); }
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
  const email=byId('authEmail').value.trim(), password=byId('authPassword').value;
  if (!email || password.length < 6) { setAuthStatus('请先填写邮箱和至少 6 位密码。', 'error'); return; }
  setAuthStatus('正在注册…');
  const { data, error } = await supabaseClient.auth.signUp({ email, password });
  if (error) setAuthStatus(error.message, 'error'); else if (!data.session) setAuthStatus('注册成功，请查收邮箱并完成验证后再登录。', 'success'); else setAuthStatus('注册成功，正在进入系统…', 'success');
}
async function signOut() { if (supabaseClient) await supabaseClient.auth.signOut(); }
const issueEntries = () => orders.flatMap(order => {
  if (payment(order) === 'refunded' || ['cancelled', 'refunded'].includes(order.status)) return [];
  const issues = [...(order.issues || [])];
  if (!order.cost && order.gmv) issues.push('成本金额为 0');
  if (!order.serviceDate) issues.push('缺少业务日期');
  if (payment(order) === 'unpaid' || payment(order) === 'partial') issues.push('存在待收款');
  if (payment(order) === 'unknown') issues.push('付款状态待确认');
  return [...new Set(issues)].map(issue => ({ order, issue }));
});

function filteredOrders() {
  return orders.filter(order => { const date=order[dateField]||''; return (activeType === 'all' || order.type === activeType) && (statusFilter==='all'||order.status===statusFilter) && (paymentFilter==='all'||payment(order)===paymentFilter) && (invoiceFilter==='all'||invoiceStatus(order)===invoiceFilter) && `${order.customer} ${order.booker} ${order.supplier} ${order.product} ${order.confirmation} ${order.location}`.toLowerCase().includes(searchTerm.toLowerCase()) && String(order.location||'').toLowerCase().includes(locationFilter.toLowerCase()) && String(order.supplier||'').toLowerCase().includes(supplierFilter.toLowerCase()) && (!dateStart || date>=dateStart) && (!dateEnd || date<=dateEnd); });
}
function updateStatusOptions(){const type=byId('typeSelect').value;const options=[['all','全部状态'],...(type==='flight'?[['pending','待出票'],['ticketed','已出票'],['refunded','已退票']]:type==='hotel'?[['booked','预订中'],['confirming','确认中'],['confirmed','已确认'],['cancelled','已取消']]:[['booked','预订中'],['confirming','确认中'],['confirmed','已确认'],['cancelled','已取消'],['pending','待出票'],['ticketed','已出票'],['refunded','已退票']])];byId('statusFilter').innerHTML=options.map(([v,t])=>`<option value="${v}">${t}</option>`).join('');if(options.some(([v])=>v===statusFilter))byId('statusFilter').value=statusFilter;else{statusFilter='all';byId('statusFilter').value='all';}}
function syncDashboardMonthPicker() {
  const select=byId('periodSelect'); const month=byId('periodMonth');
  if(!month.value) month.value=today.slice(0,7);
  if(select.value==='current') month.value=today.slice(0,7);
  month.disabled=select.value==='all';
}
function dashboardOrders() { const period=byId('periodSelect').value; const month=period==='current'?today.slice(0,7):byId('periodMonth').value; return period==='all' ? orders : orders.filter(order => (order[dashboardDateField] || '').slice(0, 7) === month); }
function transactionRows() {
  const orderRows=dashboardOrders().flatMap(order => {
    const rows = [];
    if (order.received) rows.push({ date: order.orderDate || order.serviceDate, kind:'收款', amount:Number(order.received), party:order.customer, note:'订单收款', order });
    if (order.cost) rows.push({ date: order.orderDate || order.serviceDate, kind:'成本付款', amount:-Number(order.cost), party:order.supplier, note:'供应商结算', order });
    return rows;
  });
  const otherRows=otherIncomes.map(item=>{const linked=orders.find(order=>order.id===item.orderId);return [{date:item.date,kind:'其它收入',amount:Number(item.amount||0),party:item.name,note:linked?`关联 ${orderCode(linked)}`:'未关联订单',order:{id:item.id}} , item.expense?{date:item.date,kind:'其它支出',amount:-Number(item.expense),party:item.name,note:'其它收入支出',order:{id:item.id}}:null].filter(Boolean)}).flat();
  return [...orderRows,...otherRows].sort((a,b) => (b.date || '').localeCompare(a.date || ''));
}
function sums(list) { return list.reduce((acc, order) => ({ gmv:acc.gmv + Number(order.gmv), cost:acc.cost + Number(order.cost), profit:acc.profit + profit(order), received:acc.received + Number(order.received) }), {gmv:0,cost:0,profit:0,received:0}); }

function renderDashboard() {
  syncDashboardMonthPicker();
  const data = dashboardOrders(); const total = sums(data);
  const hotels = data.filter(o => o.type === 'hotel'); const flights = data.filter(o => o.type === 'flight');
  const period=byId('periodSelect').value; const selectedMonth=byId('periodMonth').value; const periodLabel=period==='all'?'全部数据':period==='current'?'本月':selectedMonth?`${selectedMonth.slice(0,4)}年${Number(selectedMonth.slice(5,7))}月`:'指定月份';
  byId('heroPeriodLabel').textContent=`${periodLabel}净 GMV`;
  byId('heroGmv').textContent = compactCurrency(total.gmv);
  byId('heroMeta').textContent = `按${dashboardDateField==='orderDate'?'下单日期':'入住 / 出发日期'}统计 · ${data.length} 笔有效订单 · ${compactCurrency(total.profit)} 利润`;
  byId('heroMargin').textContent = total.gmv ? `${(total.profit / total.gmv * 100).toFixed(1)}%` : '—';
  byId('hotelOrders').textContent = hotels.length; byId('hotelOrderHint').textContent = `${compactCurrency(sums(hotels).gmv)} GMV`;
  byId('roomNights').textContent = hotels.reduce((n,o)=>n+roomNights(o),0);
  byId('flightOrders').textContent = flights.length; byId('flightOrderHint').textContent = `${compactCurrency(sums(flights).gmv)} GMV`;
  byId('ticketCount').textContent = flights.reduce((n,o)=>n+Number(o.tickets||0),0);
  const outstanding = data.filter(o=>payment(o)==='unpaid'||payment(o)==='partial'); const due = outstanding.reduce((n,o)=>n+Math.max(0,o.gmv-o.received),0);
  byId('receivable').textContent = compactCurrency(due); byId('receivableHint').textContent = `${outstanding.length} 笔需跟进`;
  renderTrend(); renderQueue(); renderRanking(); renderRecentLedger();
}
function renderTrend() {
  const monthly = {};
  dashboardOrders().forEach(o => { const key=(o[dashboardDateField] || '')?.slice(5,7) || '—'; monthly[key] ||= {gmv:0,profit:0}; monthly[key].gmv += Number(o.gmv); monthly[key].profit += profit(o); });
  const items=Object.entries(monthly).sort(([a],[b])=>a.localeCompare(b)).slice(-6); const max=Math.max(...items.map(([,v])=>v.gmv),1);
  byId('trendChart').innerHTML=items.map(([month,v],index)=>{const gmvHeight=Math.max(4,v.gmv/max*100),profitHeight=Math.max(3,v.profit/max*100);return `<div class="bar-col" data-month="${month}月" style="--bar-delay:${index*70}ms"><div class="bar-tooltip"><b>${month}月</b><span>GMV ${compactCurrency(v.gmv)}</span><span>利润 ${compactCurrency(v.profit)}</span></div><div class="bar-pair"><span class="bar gmv" title="GMV ${compactCurrency(v.gmv)}" style="height:${gmvHeight}%"></span><span class="bar profit" title="利润 ${compactCurrency(v.profit)}" style="height:${profitHeight}%"></span></div><div class="bar-values"><span>${compactCurrency(v.gmv)}</span><span>${compactCurrency(v.profit)}</span></div></div>`}).join('') || '<div class="empty-state">暂无趋势数据</div>';
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
function renderCityDistribution() {
  const cityMap=dashboardOrders().reduce((map,order)=>{const city=String(order.location||'未填写').trim()||'未填写';map[city]=(map[city]||0)+Number(order.gmv||0);return map},{});
  const sorted=Object.entries(cityMap).sort((a,b)=>b[1]-a[1]);const total=sorted.reduce((n,[,value])=>n+value,0);const top=sorted.slice(0,7);const rest=sorted.slice(7).reduce((n,[,value])=>n+value,0);if(rest>0)top.push(['其他',rest]);const colors=['#1f5b4e','#bd843b','#6d9b8d','#d6b47a','#8b6d4b','#47796f','#b6c9c0','#d8d1c4'];let cursor=0;const stops=top.map(([city,value],index)=>{const start=cursor;cursor+=total?value/total*360:0;return `${colors[index%colors.length]} ${start}deg ${cursor}deg`;});byId('cityTotal').textContent=compactCurrency(total);byId('cityDonut').style.background=top.length?`conic-gradient(${stops.join(',')})`:'conic-gradient(#ded7c7 0deg 360deg)';byId('cityLegend').innerHTML=top.map(([city,value],index)=>{const share=total?Math.round(value/total*100):0;return `<div class="city-legend-row" title="${city} · ${compactCurrency(value)}" style="--legend-delay:${index*65}ms;--city-share:${share}%;color:${colors[index%colors.length]}"><i style="background:${colors[index%colors.length]}"></i><span>${city}</span><b>${share}%</b></div>`}).join('')||'<div class="empty-state">暂无城市数据</div>';
}
function renderRecentLedger() { byId('recentLedger').innerHTML=transactionRows().slice(0,4).map(row=>`<div class="mini-ledger-row"><div><p>${row.kind} · ${row.party}</p><small>${dateFmt(row.date)} · ${row.order.id}</small></div><strong class="amount ${row.amount>=0?'income':'expense'}">${row.amount>=0?'+':'−'}${compactCurrency(Math.abs(row.amount))}</strong></div>`).join('') || '<div class="empty-state">暂无资金流水</div>'; }

function renderOrders() {
  const list=filteredOrders().sort((a,b)=>((b[dateField] || b.orderDate || b.serviceDate || '')).localeCompare(a[dateField] || a.orderDate || a.serviceDate || ''));
  const pageCount=Math.ceil(list.length/ORDER_PAGE_SIZE); orderPage=Math.min(orderPage,pageCount||1);
  const pageList=list.slice((orderPage-1)*ORDER_PAGE_SIZE,orderPage*ORDER_PAGE_SIZE);
  byId('orderTable').innerHTML=pageList.map(order=>{const isHotel=order.type==='hotel'; return `<tr class="clickable ${payment(order)==='unpaid'?'unpaid-order':''}" data-detail="${order.id}"><td><span class="order-code">${orderCode(order)}</span><small class="order-status">${statusText(order)}</small></td><td>${dateFmt(order.orderDate || order.serviceDate)}</td><td>${dateFmt(order.serviceDate)}</td><td class="entity-cell"><strong>${order.customer}</strong><small>${order.booker||'—'}</small></td><td>${order.location||'—'}</td><td class="entity-cell"><strong>${order.supplier}</strong><small>${typeName(order)}</small></td><td class="entity-cell product-cell"><strong>${order.product||'—'}</strong>${order.confirmation?`<small class="confirmation-line">确认号：${order.confirmation}</small>`:''}</td><td>${isHotel?`${order.rooms||1} 间 × ${order.nights||0} 晚`:`${order.tickets||0} 张`}</td><td class="money">${compactCurrency(order.gmv)}</td><td class="money ${profit(order)>=0?'profit-positive':'profit-negative'}">${compactCurrency(profit(order))}</td><td><span class="status ${payment(order)}">${paymentText(order)}</span><small class="payment-platform">${order.paymentPlatform||'未填平台'}</small></td><td><span class="status ${invoiceStatus(order)==='issued'?'paid':'pending'}">${invoiceText(order)}</span>${invoiceStatus(order)==='issued'&&order.invoiceCompany?`<small class="invoice-company">${order.invoiceCompany}</small>`:''}</td><td><button class="arrow" aria-label="查看订单">›</button></td></tr>`}).join('') || '<tr><td colspan="13"><div class="empty-state">未找到订单</div></td></tr>';
  byId('mobileOrderList').innerHTML=pageList.map(order=>{const isHotel=order.type==='hotel';return `<article class="mobile-order-card ${payment(order)==='unpaid'?'unpaid-order':''}" data-detail="${order.id}"><div class="mobile-order-head"><div><div class="mobile-order-code">${orderCode(order)}</div><div class="mobile-order-title">${order.supplier||'待确认'}</div><div class="mobile-order-subtitle"><span>${order.product||typeName(order)}</span>${order.confirmation?`<span class="mobile-order-confirmation">确认号：${order.confirmation}</span>`:''}<span>客户：${order.customer||'待补客户'}</span></div></div><span class="status ${payment(order)}">${paymentText(order)}</span></div><div class="mobile-order-meta"><span>下单日期<b>${dateFmt(order.orderDate||order.serviceDate)}</b></span><span>${isHotel?'入住日期':'出发日期'}<b>${dateFmt(order.serviceDate)}</b></span><span>${isHotel?'房晚':'票数'}<b>${isHotel?roomNights(order):`${order.tickets||0} 张`}</b></span></div><div class="mobile-order-money"><div><strong>${compactCurrency(order.gmv)}</strong><small>GMV · ${order.location||'—'}</small></div><div><small>${order.paymentPlatform||'未填付款平台'}</small><small>${invoiceText(order)}</small></div></div></article>`}).join('') || '<div class="empty-state">未找到订单</div>';
  const first= list.length ? (orderPage-1)*ORDER_PAGE_SIZE+1 : 0; const last=Math.min(orderPage*ORDER_PAGE_SIZE,list.length);
  byId('orderCountLabel').textContent=list.length?`共 ${list.length} 笔订单 · 显示 ${first}-${last}`:'共 0 笔订单';
  byId('orderPagination').innerHTML=pageCount>1?`<button class="page-button" data-order-page="${orderPage-1}" ${orderPage===1?'disabled':''}>上一页</button><span>第 ${orderPage} / ${pageCount} 页</span><button class="page-button" data-order-page="${orderPage+1}" ${orderPage===pageCount?'disabled':''}>下一页</button>`:'';
}
function renderLedger() {
  const rows=transactionRows(); const received=rows.filter(r=>r.amount>0).reduce((n,r)=>n+r.amount,0); const paid=Math.abs(rows.filter(r=>r.amount<0).reduce((n,r)=>n+r.amount,0));
  byId('ledgerSummary').innerHTML=`<article><p>已收款</p><strong class="profit-positive">${compactCurrency(received)}</strong></article><article><p>已付成本</p><strong class="profit-negative">${compactCurrency(paid)}</strong></article><article><p>现金净流入</p><strong>${compactCurrency(received-paid)}</strong></article>`;
  byId('ledgerTable').innerHTML=rows.map(r=>`<tr><td>${dateFmt(r.date)}</td><td><span class="status ${r.amount>=0?'paid':'unpaid'}">${r.kind}</span></td><td>${r.order.id}</td><td>${r.party}</td><td>${r.note}</td><td class="money amount ${r.amount>=0?'income':'expense'}">${r.amount>=0?'+':'−'}${compactCurrency(Math.abs(r.amount))}</td></tr>`).join('') || '<tr><td colspan="6"><div class="empty-state">暂无资金流水</div></td></tr>';
}
function renderOtherIncome(){const total=otherIncomes.reduce((n,item)=>n+Number(item.amount||0),0),expense=otherIncomes.reduce((n,item)=>n+Number(item.expense||0),0);byId('otherIncomeSummary').innerHTML=`<article><p>其它收入</p><strong class="profit-positive">${compactCurrency(total)}</strong></article><article><p>其它支出</p><strong class="profit-negative">${compactCurrency(expense)}</strong></article><article><p>净额</p><strong>${compactCurrency(total-expense)}</strong></article>`;byId('otherIncomeTable').innerHTML=otherIncomes.slice().sort((a,b)=>b.date.localeCompare(a.date)).map(item=>{const linked=orders.find(order=>order.id===item.orderId);const net=Number(item.amount||0)-Number(item.expense||0);return `<tr><td>${dateFmt(item.date)}</td><td><strong>${item.name}</strong></td><td>${linked?`<span class="order-code">${orderCode(linked)}</span>`:'未关联订单'}</td><td class="money">${compactCurrency(item.amount)}</td><td class="money profit-negative">${compactCurrency(item.expense)}</td><td class="money ${net>=0?'profit-positive':'profit-negative'}">${compactCurrency(net)}</td><td class="row-actions"><button class="button quiet" data-edit-income="${item.id}" aria-label="编辑">编辑</button><button class="button quiet danger" data-delete-income="${item.id}" aria-label="删除">删除</button></td></tr>`}).join('')||'<tr><td colspan="7"><div class="empty-state">还没有其它收入记录</div></td></tr>';}
function renderQuality() {
  const issues=issueEntries(); const groups=[['待收款',issues.filter(i=>i.issue==='存在待收款'),'记录客户实收金额或补齐收款流水。'],['成本异常',issues.filter(i=>i.issue==='成本金额为 0'),'确认是否为赠送、未结算，或遗漏成本。'],['资料缺失',issues.filter(i=>i.issue.includes('缺少')),'补齐业务日期、确认号或出票说明。']];
  byId('issueGrid').innerHTML=groups.map(([title,list,desc])=>`<article class="issue-card"><strong class="issue-count">${list.length}</strong><h3>${title}</h3><p>${desc}</p>${list.slice(0,4).map(({order,issue})=>`<button class="text-button" data-detail="${order.id}">${order.id} · ${order.customer} ›</button>`).join('<br>')||'<span class="muted">暂无异常</span>'}</article>`).join('');
}
function renderAll(){renderDashboard();renderOrders();renderLedger();renderQuality();renderCityDistribution();renderOtherIncome();}

function populateOtherIncomeOrders(selectedId='') {
  byId('otherIncomeOrder').innerHTML='<option value="">不关联订单</option>'+orders.map(order=>`<option value="${order.id}">${orderCode(order)} · ${order.supplier} · ${order.customer}</option>`).join('');
  byId('otherIncomeOrder').value=selectedId || '';
}
function openOtherIncomeForm(item=null) {
  byId('otherIncomeForm').reset();
  byId('otherIncomeDate').value=item?.date || today;
  byId('otherIncomeName').value=item?.name || '';
  byId('otherIncomeAmount').value=item?.amount ?? '';
  byId('otherIncomeExpense').value=item?.expense ?? '';
  populateOtherIncomeOrders(item?.orderId || '');
  byId('otherIncomeNet').textContent=compactCurrency(Number(item?.amount||0)-Number(item?.expense||0));
  byId('otherIncomeHeading').textContent=item?'编辑其它收入':'新增其它收入';
  byId('otherIncomeForm').dataset.editId=item?.id || '';
  byId('otherIncomeForm').dataset.saving='false';
  const submitButton=byId('otherIncomeForm').querySelector('button.primary');
  submitButton.disabled=false;
  submitButton.textContent='保存';
  byId('otherIncomeDialog').showModal();
}

function showView(view){activeView=view;document.querySelectorAll('.view').forEach(el=>el.classList.toggle('active',el.id===`${view}View`));document.querySelectorAll('.nav-item').forEach(el=>el.classList.toggle('active',el.dataset.view===view));document.querySelectorAll('.dashboard-only').forEach(el=>el.classList.toggle('hidden',view!=='dashboard'));byId('viewTitle').textContent={dashboard:'经营总览',orders:'订单台账',ledger:'资金流水',otherIncome:'其它收入',quality:'数据待办'}[view];}
function openDetails(id){const o=orders.find(x=>x.id===id);if(!o)return;selectedOrderId=id;const isHotel=o.type==='hotel';const transactions=transactionRows().filter(r=>r.order.id===id);byId('detailContent').innerHTML=`<div class="detail-header"><div><p class="eyebrow">${isHotel?'HOTEL ORDER':'FLIGHT ORDER'} · ${o.id}</p><h2>${o.supplier}</h2><span class="status ${payment(o)} detail-status">${paymentText(o)} · ${statusText(o)}</span></div><button class="icon-button" data-close="detailDialog" aria-label="关闭">×</button></div><div class="detail-info"><div><span>客户</span><b>${o.customer}</b></div><div><span>预订人</span><b>${o.booker||'—'}</b></div><div><span>下单日期</span><b>${o.orderDate||'—'}</b></div><div><span>${isHotel?'入住日期':'出发日期'}</span><b>${o.serviceDate||'—'}</b></div><div><span>${isHotel?'城市':'航线'}</span><b>${o.location||'—'}</b></div><div><span>${isHotel?'房型':'航班'}</span><b>${o.product||'—'}</b></div><div><span>确认号 / 票号</span><b>${o.confirmation||'—'}</b></div><div><span>订单状态</span><b>${statusText(o)}</b></div><div><span>付款平台</span><b>${o.paymentPlatform||'—'}</b></div><div><span>开票状态</span><b>${invoiceText(o)}${invoiceStatus(o)==='issued'&&o.invoiceCompany?` · ${o.invoiceCompany}`:''}</b></div><div><span>${isHotel?'住宿':'票数'}</span><b>${isHotel?`${o.rooms||1} 间 × ${o.nights||0} 晚 = ${roomNights(o)} 房晚`:`${o.tickets||0} 张`}</b></div></div><div class="detail-amounts"><div><span>GMV</span><strong>${compactCurrency(o.gmv)}</strong></div><div><span>成本</span><strong>${compactCurrency(o.cost)}</strong></div><div><span>利润</span><strong class="${profit(o)>=0?'profit-positive':'profit-negative'}">${compactCurrency(profit(o))}</strong></div><div><span>待收款</span><strong>${compactCurrency(o.gmv-o.received)}</strong></div></div><section class="detail-section"><h3>资金流水</h3><div class="detail-ledger">${transactions.map(r=>`<div><span>${dateFmt(r.date)}</span><span>${r.kind}</span><span>${r.note}</span><b class="amount ${r.amount>=0?'income':'expense'}">${r.amount>=0?'+':'−'}${compactCurrency(Math.abs(r.amount))}</b></div>`).join('')||'<div>暂无流水</div>'}</div></section><div class="detail-actions"><div><button class="button quiet" id="editOrder" data-id="${o.id}">编辑订单</button><button class="button quiet" id="addPayment" data-id="${o.id}">+ 登记收款</button></div><div><button class="button quiet danger" id="deleteOrder" data-id="${o.id}">删除订单</button><button class="button primary" data-close="detailDialog">关闭</button></div></div>`;byId('detailDialog').showModal();}
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
  byId('profitPreview').textContent=compactCurrency(gmv-cost);
}
function evaluateCalculation(expression){const normalized=expression.replaceAll('×','*').replaceAll('÷','/').replaceAll('−','-').replaceAll('，',',').replaceAll(',','').trim();if(!normalized||!/^[0-9+\-*/().\s]+$/.test(normalized))throw new Error('请输入有效的算式');const result=Function(`"use strict"; return (${normalized})`)();if(!Number.isFinite(result))throw new Error('计算结果无效');return Math.round((result+Number.EPSILON)*100)/100;}
function openCalculator(target){calculatorTarget=target;const input=byId(target);byId('calculatorTitle').textContent=`计算 ${target==='gmv'?'GMV / 售价':target==='cost'?'成本金额':'已收金额'}`;byId('calcExpression').value=input.value||'';byId('calcHint').textContent='支持 + − × ÷ 和括号';byId('calcHint').classList.remove('error');byId('calculatorDialog').showModal();byId('calcExpression').focus();}
function calculateAndPreview(){try{const result=evaluateCalculation(byId('calcExpression').value);byId('calcExpression').value=String(result);byId('calcHint').textContent=`结果：${compactCurrency(result)}`;byId('calcHint').classList.remove('error');return result;}catch(error){byId('calcHint').textContent=error.message;byId('calcHint').classList.add('error');return null;}}
function setOrderType(type){byId('formType').value=type;document.querySelectorAll('[data-order-type]').forEach(b=>b.classList.toggle('selected',b.dataset.orderType===type));document.querySelectorAll('.hotel-only').forEach(e=>e.classList.toggle('hidden',type!=='hotel'));document.querySelectorAll('.flight-only').forEach(e=>e.classList.toggle('hidden',type!=='flight'));byId('locationLabel').firstChild.textContent=type==='hotel'?'城市':'航线';byId('supplierLabel').firstChild.textContent=type==='hotel'?'酒店':'航司';byId('productLabel').firstChild.textContent=type==='hotel'?'房型':'航班';byId('serviceDateLabel').firstChild.textContent=type==='hotel'?'入住日期':'出发日期';byId('supplier').placeholder=type==='hotel'?'如：广州瑰丽':'如：全日空 ANA';byId('product').placeholder=type==='hotel'?'如：豪华大床':'如：NH934 · 经济舱';const current=byId('orderStatus').value;const statuses=type==='hotel'?[['booked','预订中'],['confirming','确认中'],['confirmed','已确认'],['cancelled','已取消']]:[['pending','待出票'],['ticketed','已出票'],['refunded','已退票']];byId('orderStatus').innerHTML=statuses.map(([value,label])=>`<option value="${value}">${label}</option>`).join('');if(statuses.some(([value])=>value===current))byId('orderStatus').value=current;refreshFormPreview();}
function excelDate(value){if(!value)return '';if(value instanceof Date)return value.toISOString().slice(0,10);if(typeof value==='number'&&window.XLSX){const parts=XLSX.SSF.parse_date_code(value);if(parts)return `${parts.y}-${String(parts.m).padStart(2,'0')}-${String(parts.d).padStart(2,'0')}`;}const parsed=new Date(value);return Number.isNaN(parsed.getTime())?'':parsed.toISOString().slice(0,10);}
function excelNumber(value){const number=Number(value);return Number.isFinite(number)?number:0;}
function isFlightRow(row){const source=`${row['酒店/机票']||''} ${row['房型']||''} ${row['城市']||''}`.toLowerCase();return /航空|airways?|airlines?|flight|航班|机票|航司/.test(source);}
function mapExcelRow(row,index){const source=row.map(value=>String(value??'')).join(' ');const type=/[\u673a\u822a]\u7968|\u822a\u73ed|airways?|airlines?|flight/i.test(source)?'flight':'hotel';const rawGmv=row[14],rawCost=row[8],rawProfit=row[15],rawPaymentStatus=String(row[11]||'').trim(),rawInvoice=String(row[10]||'').trim(),rawPaymentPlatform=String(row[12]||'').trim();const paymentStatus=/\u672a\u4ed8|\u5f85\u6536/.test(rawPaymentStatus)?'unpaid':/\u90e8\u5206/.test(rawPaymentStatus)?'partial':/\u9000\u6b3e/.test(rawPaymentStatus)?'refunded':'paid';const gmv=excelNumber(rawGmv),cost=excelNumber(rawCost),count=excelNumber(row[5]);const issues=[];if(!row[0])issues.push('缺少下单日期');if(!row[1])issues.push('缺少业务日期');if(!row[3])issues.push('缺少供应商');if(rawCost===null||rawCost===undefined||rawCost==='')issues.push('缺少成本金额');if(rawGmv===null||rawGmv===undefined||rawGmv==='')issues.push('缺少收款金额');if(String(row[3]||'').trim()==='发票')issues.push('需要核对业务类型');return {id:`IM-${String(index+2).padStart(4,'0')}`,orderCode:`ORD-${String(index+1).padStart(5,'0')}`,type,customer:String(row[7]||'').replace(/\s+/g,' ').trim()||'待补客户',booker:String(row[9]||'').trim(),orderDate:excelDate(row[0]),serviceDate:excelDate(row[1]),location:String(row[2]||'').trim(),supplier:String(row[3]||'').trim()||'待确认',product:String(row[4]||'').trim(),confirmation:String(row[6]||'').trim(),rooms:type==='hotel'?1:0,nights:type==='hotel'?count:0,tickets:type==='flight'?count:0,gmv,cost,received:paymentStatus==='paid'?gmv:0,paymentStatus,paymentPlatform:rawPaymentPlatform,invoiceStatus:rawInvoice?'issued':'unissued',invoiceCompany:rawInvoice,profitOverride:rawProfit===null||rawProfit===undefined||rawProfit===''?null:excelNumber(rawProfit),status:type==='hotel'?'confirmed':'ticketed',issues};}
async function importExcel(file){if(!window.XLSX){window.alert('Excel 解析组件尚未加载，请检查网络后刷新页面重试。');return;}const button=byId('importExcel');button.textContent='正在导入…';button.disabled=true;try{const buffer=await file.arrayBuffer();const workbook=XLSX.read(buffer,{type:'array',cellDates:true});const sheetName=workbook.SheetNames.includes('酒店销售')?'酒店销售':workbook.SheetNames[0];const rows=XLSX.utils.sheet_to_json(workbook.Sheets[sheetName],{defval:null,raw:true});const imported=rows.filter(row=>Object.values(row).some(value=>value!==null&&value!=='')) .map(mapExcelOrder);if(!imported.length)throw new Error('未在工作表中找到可导入的订单记录。');orders=imported;save();renderAll();showView('orders');window.alert(`已导入 ${imported.length} 笔真实订单（来源：${sheetName}）。\n\n说明：旧表未提供房间数，因此酒店订单暂按 1 间房换算房晚；付款状态为空的记录暂按“已收款”保留收款金额，待收款和异常数据会进入“数据待办”。`);}catch(error){window.alert(`导入失败：${error.message}`);}finally{button.textContent='导入 Excel';button.disabled=false;byId('excelFile').value='';}}
async function importExcelFixed(file){if(!window.XLSX){window.alert('Excel 解析组件未加载，请检查网络后刷新重试。');return;}const button=byId('importExcel');button.textContent='正在导入…';button.disabled=true;try{const workbook=XLSX.read(await file.arrayBuffer(),{type:'array',cellDates:true});const sheet=workbook.Sheets[workbook.SheetNames[0]];const matrix=XLSX.utils.sheet_to_json(sheet,{header:1,defval:null,raw:true});const imported=matrix.slice(1).filter(row=>Array.isArray(row)&&row.some(value=>value!==null&&value!=='')) .map(mapExcelRow).filter(order=>order.orderDate||order.serviceDate||order.supplier!=='待确认'||order.gmv!==0);if(imported.length<10||!imported.some(order=>order.supplier!=='待确认'&&order.gmv>0))throw new Error('没有识别到“酒店销售”订单数据，请确认选择的是导出的订单汇总文件。');orders=imported;save();renderAll();showView('orders');byId('importStatus').textContent=`已导入 ${imported.length} 笔订单 · 来源：${file.name} · 真实数据已替换本地示例`;byId('importStatus').classList.add('success');window.alert(`已成功导入 ${imported.length} 笔真实订单。`);}catch(error){byId('importStatus').textContent=`导入失败：${error.message}`;byId('importStatus').classList.remove('success');window.alert(`导入失败：${error.message}`);}finally{button.textContent='导入 Excel';button.disabled=false;byId('excelFile').value='';}}
function openEditOrder(id){const o=orders.find(order=>order.id===id);if(!o)return;byId('detailDialog').close();byId('orderForm').dataset.editId=id;byId('orderForm').dataset.saving='false';byId('formKicker').textContent=`EDIT ORDER · ${id}`;byId('formHeading').textContent='编辑订单';byId('formSubmit').disabled=false;byId('formSubmit').textContent='保存修改';setOrderType(o.type);byId('orderStatus').value=o.status|| (o.type==='hotel'?'booked':'pending');byId('customer').value=o.customer||'';byId('booker').value=o.booker||'';byId('orderDate').value=o.orderDate||o.serviceDate||today;byId('serviceDate').value=o.serviceDate||today;byId('confirmation').value=o.confirmation||'';byId('location').value=o.location||'';byId('supplier').value=o.supplier||'';byId('product').value=o.product||'';byId('rooms').value=o.rooms||1;byId('nights').value=o.nights||1;byId('tickets').value=o.tickets||1;byId('gmv').value=o.gmv||0;byId('cost').value=o.cost||0;byId('paymentStatus').value=payment(o);byId('paymentPlatform').value=o.paymentPlatform||'';byId('received').value=o.received||0;byId('invoiceStatus').value=invoiceStatus(o);byId('invoiceCompany').value=o.invoiceCompany||'';refreshFormPreview();byId('orderDialog').showModal();}

document.addEventListener('click', event=>{const nav=event.target.closest('[data-view]');if(nav)showView(nav.dataset.view);const go=event.target.closest('[data-go]');if(go)showView(go.dataset.go);const detail=event.target.closest('[data-detail]');if(detail)openDetails(detail.dataset.detail);const close=event.target.closest('[data-close]');if(close)byId(close.dataset.close).close();const page=event.target.closest('[data-order-page]');if(page&&!page.disabled){orderPage=Number(page.dataset.orderPage);renderOrders();}const type=event.target.closest('[data-order-type]');if(type)setOrderType(type.dataset.orderType);const filter=event.target.closest('[data-type-filter]');if(filter){activeType=filter.dataset.typeFilter;orderPage=1;document.querySelectorAll('[data-type-filter]').forEach(b=>b.classList.toggle('selected',b===filter));renderOrders();}const calcTrigger=event.target.closest('[data-calc-for]');if(calcTrigger)openCalculator(calcTrigger.dataset.calcFor);const calcKey=event.target.closest('[data-calc-key]');if(calcKey){const input=byId('calcExpression'),key=calcKey.dataset.calcKey;if(key==='C')input.value='';else if(key==='⌫')input.value=input.value.slice(0,-1);else input.value+=key;byId('calcHint').textContent='支持 + − × ÷ 和括号';byId('calcHint').classList.remove('error');}if(event.target.id==='calcEquals')calculateAndPreview();if(event.target.id==='applyCalculation'){const result=calculateAndPreview();if(result!==null&&calculatorTarget){byId(calculatorTarget).value=String(result);refreshFormPreview();byId('calculatorDialog').close();}}if(event.target.id==='clearFilters'){activeType='all';searchTerm='';orderPage=1;byId('orderSearch').value='';document.querySelectorAll('[data-type-filter]').forEach(b=>b.classList.toggle('selected',b.dataset.typeFilter==='all'));renderOrders();}if(event.target.id==='importExcel')byId('excelFile').click();if(event.target.id==='openOrderDialog'){byId('orderForm').reset();delete byId('orderForm').dataset.editId;byId('orderForm').dataset.saving='false';byId('formKicker').textContent='NEW TRANSACTION';byId('formHeading').textContent='新增业务订单';byId('formSubmit').disabled=false;byId('formSubmit').textContent='保存订单';byId('orderDate').value=today;byId('serviceDate').value=today;byId('paymentStatus').value='paid';setOrderType('hotel');byId('orderStatus').value='booked';byId('orderDialog').showModal();}if(event.target.id==='editOrder')openEditOrder(event.target.dataset.id);if(event.target.id==='deleteOrder')deleteOrder(event.target.dataset.id);if(event.target.id==='migrateLocalData')migrateLocalData();if(event.target.id==='signOut')signOut();if(event.target.id==='addPayment'){const order=orders.find(o=>o.id===event.target.dataset.id);const outstanding=order.gmv-order.received;const value=window.prompt(`登记收款（当前待收 ${compactCurrency(outstanding)}）`,outstanding);if(value!==null&&!Number.isNaN(Number(value))){order.received=Math.min(order.gmv,order.received+Number(value));order.paymentStatus=order.received>=order.gmv?'paid':'partial';save().then(()=>{renderAll();openDetails(order.id);}).catch(error=>window.alert(`保存收款失败：${error.message}`));}}});
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
['gmv','cost','rooms','nights','tickets'].forEach(id=>byId(id).addEventListener('input',refreshFormPreview));
byId('orderForm').addEventListener('submit',async event=>{
  event.preventDefault();
  const submitButton=byId('formSubmit');
  if(submitButton.disabled)return;
  submitButton.disabled=true;
  const originalSubmitText=submitButton.textContent;
  submitButton.textContent='保存中…';
  const type=byId('formType').value, editId=byId('orderForm').dataset.editId, sequence=String(orders.length+1).padStart(3,'0'), existing=orders.find(order=>order.id===editId);
  const paymentStatus=byId('paymentStatus').value, paymentPlatform=byId('paymentPlatform').value.trim(), invoiceStatusValue=byId('invoiceStatus').value, invoiceCompany=byId('invoiceCompany').value.trim();
  const gmv=Number(byId('gmv').value||0); let received=Number(byId('received').value||0);
  if(paymentStatus==='paid')received=gmv; if(paymentStatus==='unpaid'||paymentStatus==='refunded')received=0;
  const order={id:editId||`${type==='hotel'?'HT':'FL'}-${today.replaceAll('-','')}-${sequence}`,orderCode:existing?.orderCode||`ORD-${String(orders.length+1).padStart(5,'0')}`,type,customer:byId('customer').value.trim(),booker:byId('booker').value.trim(),orderDate:byId('orderDate').value,serviceDate:byId('serviceDate').value,location:byId('location').value.trim(),supplier:byId('supplier').value.trim(),product:byId('product').value.trim(),confirmation:byId('confirmation').value.trim(),rooms:type==='hotel'?Number(byId('rooms').value||1):0,nights:type==='hotel'?Number(byId('nights').value||0):0,tickets:type==='flight'?Number(byId('tickets').value||1):0,gmv,cost:Number(byId('cost').value||0),received,paymentStatus,paymentPlatform,invoiceStatus:invoiceStatusValue,invoiceCompany:invoiceStatusValue==='issued'?invoiceCompany:'',profitOverride:existing?.profitOverride ?? null,status:byId('orderStatus').value,issues:existing?.issues};
  if(existing)Object.assign(existing,order);else orders.unshift(order);
  try { await save(); delete byId('orderForm').dataset.editId; byId('orderDialog').close(); renderAll(); showView('orders'); openDetails(order.id); }
  catch(error) { submitButton.disabled=false; submitButton.textContent=originalSubmitText; window.alert(`保存订单失败：${error.message}`); }
});
byId('openOtherIncomeDialog').addEventListener('click',()=>openOtherIncomeForm());
['otherIncomeAmount','otherIncomeExpense'].forEach(id=>byId(id).addEventListener('input',()=>byId('otherIncomeNet').textContent=compactCurrency(Number(byId('otherIncomeAmount').value||0)-Number(byId('otherIncomeExpense').value||0))));
byId('otherIncomeForm').addEventListener('submit',async event=>{event.preventDefault();const submitButton=byId('otherIncomeForm').querySelector('button[type="submit"],button.primary');if(submitButton.disabled)return;submitButton.disabled=true;const originalSubmitText=submitButton.textContent;submitButton.textContent='保存中…';const editId=byId('otherIncomeForm').dataset.editId;const item={id:editId||`OI-${Date.now()}`,date:byId('otherIncomeDate').value,name:byId('otherIncomeName').value.trim(),orderId:byId('otherIncomeOrder').value,amount:Number(byId('otherIncomeAmount').value||0),expense:Number(byId('otherIncomeExpense').value||0)};const index=otherIncomes.findIndex(record=>record.id===editId);if(index>=0)otherIncomes[index]=item;else otherIncomes.unshift(item);try{await saveOtherIncomes();delete byId('otherIncomeForm').dataset.editId;byId('otherIncomeDialog').close();renderAll();showView('otherIncome');}catch(error){submitButton.disabled=false;submitButton.textContent=originalSubmitText;window.alert(`保存其它收入失败：${error.message}`);}});
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
    orders=imported;await save();
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
byId('authSignUp').addEventListener('click',()=>signUp());
async function initApp(){
  if(!supabaseClient){setAuthStatus('Supabase 客户端未加载，请检查网络后刷新页面。','error');return;}
  const {data,error}=await supabaseClient.auth.getSession();
  if(error){setAuthStatus(`无法读取登录状态：${error.message}`,'error');return;}
  await handleSession(data.session);
  supabaseClient.auth.onAuthStateChange((_event,session)=>{setTimeout(()=>handleSession(session),0);});
}
initApp();
