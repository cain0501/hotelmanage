import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
});

const accountingSchema = {
  intent: 'order | other_income | other_expense | payment | commission | unknown',
  confidence: 'number from 0 to 1',
  missing_fields: 'array of Chinese field names that must be confirmed',
  notes: 'array of short Chinese notes',
  order: {
    type: 'hotel | flight', customer: 'string', booker: 'string', order_date: 'YYYY-MM-DD', service_date: 'YYYY-MM-DD',
    location: 'string', supplier: 'string', product: 'string', confirmation: 'string', rooms: 'number', nights: 'number',
    tickets: 'number', gmv: 'number', cost: 'number', payment_status: 'paid | partial | unpaid | refunded', payment_platform: 'string',
    status: 'booked | confirming | confirmed | cancelled | pending | ticketed | refunded', commission_platform: 'string',
    commission_expected: 'number', commission_received: 'number', direct_cost: 'number', guest_payment_to: 'string',
  },
  income: { date: 'YYYY-MM-DD', name: 'string', payer: 'string', payee: 'string', amount: 'number', expense: 'number', search_text: 'string' },
};

const systemPrompt = (today: string) => `你是酒店和机票运营台账助手。今天是 ${today}。把用户的中文自然语言转换成可审核的结构化记账草稿。只输出一个 JSON 对象，不要 Markdown，不要解释文字。严格遵守以下结构：${JSON.stringify(accountingSchema)}。
规则：不要臆造金额、日期、客户、供应商、房型或确认号；缺失且会影响入账的字段放入 missing_fields。“今天、明天、后天”按今天 ${today} 计算。酒店“住2晚”填 nights=2，房晚由系统按 rooms × nights 计算。客人在前台付款、平台之后返佣属于 commission，订单成本填 0；返佣平台、预计佣金、已收佣金、直接费用分别填入对应字段。收到、收款、返佣到账优先识别为 payment 或 commission，不要新建订单。付款状态不明确时不要默认已付款，放入 missing_fields。无法判断时 intent=unknown。所有数字必须是数字，无法确定时不要猜。`;

const analysisPrompt = `你是酒店运营分析说明助手。前端已经用确定性规则完成统计，下面只提供统计结果和口径。只根据 context 中的事实组织简洁中文回答，不要重新计算、补造数据、生成 SQL 或修改订单。必须说明统计范围、日期口径和关键金额；数据不足时直接说明“当前数据不足以判断”。只输出 JSON：{"answer":"中文回答","key_points":["要点"],"limitations":["必要时说明限制"]}。`;

const assistantPrompt = `你是酒店运营与旅行知识助手。你可以回答一般问题、专业酒店知识、旅行建议和写作请求，但不能假装查询了实时数据。只使用已发布知识和对话上下文作为内部参考。没有实时天气、库存、价格、航班或签证工具时，明确说明当前没有实时查询能力。用户提交专业规则时，把它整理为可审核建议，不要声称已经永久记住。不要生成 SQL，不要修改订单，不要编造酒店价格、库存、预订结果或供应商政策。只输出 JSON：{"answer":"中文回答","knowledge_sources":[{"title":"来源标题","updated_at":"更新时间"}],"needs_clarification":false,"unsupported":false}。`;

const chatPrompt = (today: string) => `你是酒店运营与旅行知识工作台的统一助手。今天是 ${today}。你可以处理经营查询、自然语言记账、已审核专业知识和一般问题。
必须遵守：
1. 涉及订单数、房晚、GMV、佣金、收入或利润时，必须调用 summarize_business，不能凭对话历史估算。
2. “本月”必须转换为当前自然月的明确 start 和 end；不要因为结果为空而改查全部数据。
3. 如果用户没有说明按下单日期还是入住/出发日期，优先沿用 context_state.date_field；没有已记住的口径且两者会影响结果时，先追问，不要调用统计工具。
4. 专业酒店规则和知识问题调用 search_knowledge；没有匹配内容时说明当前知识库没有相关资料。
5. 新增、收款、返佣和记账操作只生成 draft_accounting；修改已有订单字段使用 draft_data_change。两类操作都不直接写订单或收入表。修改已有订单时，如果用户提供了唯一订单编号、确认号或客户线索，先从真实订单读取当前值，不要要求用户手工提供原值；只有匹配多笔或无法定位时才追问。
6. 用户查询订单详情、未付款、待返佣、未开票、重复订单或其它收入时，必须调用对应的只读查询工具；不要用对话历史或综合统计代替明细查询。
7. 没有实时天气、库存、价格、航班或签证工具时，必须明确说明当前没有对应实时查询能力。
8. 最终只输出 JSON：{"answer":"中文回答","needs_clarification":false,"unsupported":false}。统计和专项查询回答必须引用工具返回的范围、日期口径和结果，不得自行重算或编造明细。`;

const chatToolRoutingRule = `补充规则：用户要求修改、统一、替换、批量修改已有订单字段时，必须调用 draft_data_change，先查询并返回待确认预览；如果提供了唯一订单编号、确认号或客户线索，可以省略 from_value，由工具自动读取当前值；禁止调用 draft_accounting，也禁止直接写入数据库。用户确认后才允许服务端执行修改。酒店/航司名称归入 supplier，房型/航班归入 product，城市/航线归入 location。`;

const chatTools = [
  {
    type: 'function',
    function: {
      name: 'draft_data_change',
      description: '识别用户要修改已有订单数据的请求，只生成待确认的修改预览，绝不直接写入数据库。用户提供唯一订单编号、确认号或客户线索时，可不提供旧值，工具会先读取真实订单当前值；多笔批量替换时再提供旧值筛选。',
      parameters: {
        type: 'object',
        additionalProperties: false,
        required: ['action_type', 'target', 'to_value', 'filters', 'search_text'],
        properties: {
          action_type: { type: 'string', enum: ['batch_replace'] },
          target: { type: 'string', enum: ['supplier', 'product', 'location', 'booker', 'customer', 'payment_platform', 'confirmation', 'status'] },
          from_value: { type: 'string' },
          to_value: { type: 'string', description: '目标值；订单状态请使用 booked、confirming、confirmed、cancelled、pending、ticketed 或 refunded，也可以直接使用中文状态名称' },
          filters: {
            type: 'object',
            additionalProperties: false,
            properties: {
              type: { type: 'string', enum: ['all', 'hotel', 'flight'] },
              location: { type: 'string' },
              supplier: { type: 'string' },
              booker: { type: 'string' },
              order_date_start: { type: 'string' },
              order_date_end: { type: 'string' },
              service_date_start: { type: 'string' },
              service_date_end: { type: 'string' },
            },
          },
          search_text: { type: 'string', description: '确认号、订单编号或客户线索；没有则为空字符串' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'summarize_business',
      description: '按明确日期口径查询真实订单和其它收入，并返回确定性统计结果。',
      parameters: {
        type: 'object',
        additionalProperties: false,
        required: ['date_field', 'start', 'end', 'type', 'group_by'],
        properties: {
          date_field: { type: 'string', enum: ['order_date', 'service_date'], description: '下单日期或入住/出发日期' },
          start: { type: 'string', description: '开始日期 YYYY-MM-DD；查全部时为空字符串' },
          end: { type: 'string', description: '结束日期 YYYY-MM-DD；查全部时为空字符串' },
          type: { type: 'string', enum: ['all', 'hotel', 'flight'] },
          location: { type: 'string' },
          supplier: { type: 'string' },
          booker: { type: 'string' },
          group_by: { type: 'string', enum: ['none', 'location', 'supplier', 'booker', 'payment_platform'] },
          include_failed: { type: 'boolean' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_order_detail',
      description: '按订单编号、确认号、客户、酒店或其它线索查询真实订单明细。只读，不修改数据。',
      parameters: {
        type: 'object',
        additionalProperties: false,
        required: ['search_text'],
        properties: {
          search_text: { type: 'string', description: '订单编号、确认号、客户、酒店、航司或房型等检索线索' },
          include_related_income: { type: 'boolean', description: '是否同时返回关联的其它收入记录' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'find_unpaid_orders',
      description: '查询客户尚未付款或部分付款的订单；客人前台付款后平台返佣的订单不归入此工具，应使用待返佣查询。',
      parameters: {
        type: 'object',
        additionalProperties: false,
        required: ['date_field', 'start', 'end', 'type'],
        properties: {
          date_field: { type: 'string', enum: ['order_date', 'service_date'] }, start: { type: 'string' }, end: { type: 'string' },
          type: { type: 'string', enum: ['all', 'hotel', 'flight'] }, location: { type: 'string' }, supplier: { type: 'string' }, booker: { type: 'string' },
          search_text: { type: 'string' }, limit: { type: 'number' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'find_commission_outstanding',
      description: '查询客人在前台付款、平台尚未返佣或部分返佣的订单。',
      parameters: {
        type: 'object',
        additionalProperties: false,
        required: ['date_field', 'start', 'end', 'type'],
        properties: {
          date_field: { type: 'string', enum: ['order_date', 'service_date'] }, start: { type: 'string' }, end: { type: 'string' },
          type: { type: 'string', enum: ['all', 'hotel', 'flight'] }, location: { type: 'string' }, supplier: { type: 'string' }, booker: { type: 'string' },
          search_text: { type: 'string' }, limit: { type: 'number' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'find_invoice_issues',
      description: '查询需要开票但当前仍未开票的订单。默认排除明确标记为无发票的订单。',
      parameters: {
        type: 'object',
        additionalProperties: false,
        required: ['date_field', 'start', 'end', 'type'],
        properties: {
          date_field: { type: 'string', enum: ['order_date', 'service_date'] }, start: { type: 'string' }, end: { type: 'string' },
          type: { type: 'string', enum: ['all', 'hotel', 'flight'] }, location: { type: 'string' }, supplier: { type: 'string' }, booker: { type: 'string' },
          search_text: { type: 'string' }, include_no_invoice: { type: 'boolean' }, limit: { type: 'number' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'find_duplicate_orders',
      description: '识别疑似重复订单。优先按相同确认号匹配，也可按客户、酒店/航司、房型/航班和业务日期组合匹配；只读，不自动删除。',
      parameters: {
        type: 'object',
        additionalProperties: false,
        required: ['date_field', 'start', 'end', 'type', 'match_mode'],
        properties: {
          date_field: { type: 'string', enum: ['order_date', 'service_date'] }, start: { type: 'string' }, end: { type: 'string' },
          type: { type: 'string', enum: ['all', 'hotel', 'flight'] }, match_mode: { type: 'string', enum: ['all', 'confirmation', 'same_customer_supplier_date'] },
          location: { type: 'string' }, supplier: { type: 'string' }, booker: { type: 'string' }, limit: { type: 'number' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_other_income',
      description: '查询其它收入和其它支出，返回记录、收入、支出和净额汇总。',
      parameters: {
        type: 'object',
        additionalProperties: false,
        required: ['start', 'end', 'search_text', 'kind'],
        properties: {
          start: { type: 'string' }, end: { type: 'string' }, search_text: { type: 'string' }, kind: { type: 'string', enum: ['all', 'income', 'expense'] }, limit: { type: 'number' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_knowledge',
      description: '检索当前用户已发布的专业酒店和旅行知识，不返回草稿。',
      parameters: {
        type: 'object',
        additionalProperties: false,
        required: ['query'],
        properties: { query: { type: 'string' } },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'draft_accounting',
      description: '把用户要求整理为可审核的记账草稿，不写入订单或收入表。',
      parameters: {
        type: 'object',
        additionalProperties: false,
        required: ['intent', 'missing_fields', 'notes', 'order', 'income'],
        properties: {
          intent: { type: 'string', enum: ['order', 'other_income', 'other_expense', 'payment', 'commission', 'unknown'] },
          missing_fields: { type: 'array', items: { type: 'string' } },
          notes: { type: 'array', items: { type: 'string' } },
          order: {
            type: 'object',
            additionalProperties: false,
            properties: {
              type: { type: 'string' }, customer: { type: 'string' }, booker: { type: 'string' }, order_date: { type: 'string' },
              service_date: { type: 'string' }, location: { type: 'string' }, supplier: { type: 'string' }, product: { type: 'string' },
              confirmation: { type: 'string' }, rooms: { type: 'number' }, nights: { type: 'number' }, tickets: { type: 'number' },
              gmv: { type: 'number' }, cost: { type: 'number' }, payment_status: { type: 'string' }, payment_platform: { type: 'string' },
              status: { type: 'string' }, commission_platform: { type: 'string' }, commission_expected: { type: 'number' },
              commission_received: { type: 'number' }, direct_cost: { type: 'number' }, guest_payment_to: { type: 'string' },
            },
          },
          income: {
            type: 'object',
            additionalProperties: false,
            properties: {
              date: { type: 'string' }, name: { type: 'string' }, payer: { type: 'string' }, payee: { type: 'string' },
              amount: { type: 'number' }, expense: { type: 'number' }, search_text: { type: 'string' },
            },
          },
        },
      },
    },
  },
];

const numberValue = (value: unknown) => Number.isFinite(Number(value)) ? Number(value) : 0;

function orderProfit(order: Record<string, unknown>) {
  if (order.profit_override !== null && order.profit_override !== undefined && order.profit_override !== '') {
    return numberValue(order.profit_override);
  }
  return order.settlement_mode === 'guest_pay_commission'
    ? numberValue(order.commission_received) - numberValue(order.direct_cost)
    : numberValue(order.gmv) - numberValue(order.cost);
}

function dateInRange(value: unknown, start: string, end: string) {
  const date = String(value || '');
  if (!start && !end) return true;
  return Boolean(date) && (!start || date >= start) && (!end || date <= end);
}

const orderQueryFields = 'id,order_code,type,customer,booker,location,supplier,product,confirmation,order_date,service_date,rooms,nights,tickets,gmv,cost,received,payment_status,payment_platform,settlement_mode,guest_payment_to,commission_platform,commission_expected,commission_received,commission_status,direct_cost,commission_received_date,invoice_status,invoice_company,status,profit_override';
const incomeQueryFields = 'id,income_date,name,payer,payee,order_id,amount,expense';
const statusLabelMap: Record<string, string> = { booked: '预订中', confirming: '确认中', confirmed: '已确认', cancelled: '已取消', pending: '待出票', ticketed: '已出票', refunded: '已退票' };
const paymentLabelMap: Record<string, string> = { paid: '已收款', partial: '部分付款', unpaid: '未付款', refunded: '已退款', unknown: '待核对' };

function normalizedText(value: unknown) {
  return String(value || '').trim().toLocaleLowerCase();
}

function isFailedOrder(order: Record<string, unknown>) {
  return ['cancelled', 'refunded'].includes(String(order.status || ''));
}

function isCommissionOrderRecord(order: Record<string, unknown>) {
  return order.settlement_mode === 'guest_pay_commission';
}

function commissionOutstandingRecord(order: Record<string, unknown>) {
  return Math.max(0, numberValue(order.commission_expected) - numberValue(order.commission_received));
}

function customerReceivableRecord(order: Record<string, unknown>) {
  if (isCommissionOrderRecord(order) || isFailedOrder(order)) return false;
  const gmv = numberValue(order.gmv);
  const paymentStatus = String(order.payment_status || 'unknown');
  if (paymentStatus === 'refunded') return false;
  return gmv > 0 && ['unpaid', 'partial', 'unknown'].includes(paymentStatus) || gmv > numberValue(order.received);
}

function invoiceIssueRecord(order: Record<string, unknown>, includeNoInvoice = false) {
  const status = String(order.invoice_status || 'unissued');
  const noInvoice = status === 'no_invoice' || /无发票/i.test(String(order.invoice_company || ''));
  return !isFailedOrder(order) && status !== 'issued' && (includeNoInvoice || !noInvoice);
}

function matchesOrderQuery(order: Record<string, unknown>, args: Record<string, unknown>, options: { includeSearch?: boolean; includeFailed?: boolean } = {}) {
  const dateField = args.date_field === 'service_date' ? 'service_date' : 'order_date';
  const type = ['hotel', 'flight'].includes(String(args.type || '')) ? String(args.type) : 'all';
  if (!options.includeFailed && isFailedOrder(order)) return false;
  if (!dateInRange(order[dateField], String(args.start || ''), String(args.end || ''))) return false;
  if (type !== 'all' && order.type !== type) return false;
  for (const key of ['location', 'supplier', 'booker']) {
    if (args[key] && !normalizedText(order[key]).includes(normalizedText(args[key]))) return false;
  }
  if (options.includeSearch && args.search_text) {
    const haystack = `${order.id || ''} ${order.order_code || ''} ${order.confirmation || ''} ${order.customer || ''} ${order.booker || ''} ${order.location || ''} ${order.supplier || ''} ${order.product || ''}`.toLocaleLowerCase();
    if (!haystack.includes(normalizedText(args.search_text))) return false;
  }
  return true;
}

function formatOrderQueryRow(order: Record<string, unknown>) {
  const isCommission = isCommissionOrderRecord(order);
  const paymentStatus = isCommission ? (commissionOutstandingRecord(order) > 0 ? (numberValue(order.commission_received) > 0 ? 'partial' : 'unpaid') : 'paid') : String(order.payment_status || 'unknown');
  return {
    id: order.id,
    order_code: order.order_code || order.id,
    type: order.type,
    customer: order.customer || '',
    booker: order.booker || '',
    location: order.location || '',
    supplier: order.supplier || '',
    product: order.product || '',
    confirmation: order.confirmation || '',
    order_date: order.order_date || '',
    service_date: order.service_date || '',
    rooms: numberValue(order.rooms),
    nights: numberValue(order.nights),
    room_nights: order.type === 'hotel' ? numberValue(order.rooms || 1) * numberValue(order.nights) : 0,
    tickets: numberValue(order.tickets),
    gmv: numberValue(order.gmv),
    cost: numberValue(order.cost),
    received: numberValue(order.received),
    payment_status: paymentStatus,
    payment_status_label: paymentLabelMap[paymentStatus] || paymentStatus,
    payment_platform: order.payment_platform || '',
    settlement_mode: order.settlement_mode || 'agency_pay',
    commission_platform: order.commission_platform || '',
    commission_expected: numberValue(order.commission_expected),
    commission_received: numberValue(order.commission_received),
    commission_outstanding: commissionOutstandingRecord(order),
    invoice_status: order.invoice_status || 'unissued',
    invoice_company: order.invoice_company || '',
    status: order.status || '',
    status_label: statusLabelMap[String(order.status || '')] || order.status || '',
    profit: orderProfit(order),
  };
}

async function loadOrderQueryRows(client: any) {
  const { data, error } = await client.from('orders').select(orderQueryFields).limit(10000);
  if (error) throw error;
  return (data || []) as Record<string, unknown>[];
}

function queryLimit(args: Record<string, unknown>, fallback = 20) {
  return Math.min(100, Math.max(1, Math.floor(numberValue(args.limit) || fallback)));
}

async function createAssistantRun(adminClient: any, userId: string, conversationId: string | null, userMessage: string) {
  if (!adminClient) return null;
  const { data, error } = await adminClient
    .from('assistant_runs')
    .insert({ user_id: userId, conversation_id: conversationId, user_message: userMessage, status: 'running', current_step: 'routing' })
    .select('id')
    .single();
  if (error) {
    console.warn('assistant run log unavailable', error.message);
    return null;
  }
  return data?.id || null;
}

async function updateAssistantRun(adminClient: any, runId: string | null, payload: Record<string, unknown>) {
  if (!adminClient || !runId) return;
  const { error } = await adminClient.from('assistant_runs').update(payload).eq('id', runId);
  if (error) console.warn('assistant run update unavailable', error.message);
}

async function recordAssistantToolCall(adminClient: any, userId: string, conversationId: string | null, runId: string | null, toolName: string, args: Record<string, unknown>, result: Record<string, unknown>) {
  if (!adminClient) return;
  const { error } = await adminClient.from('assistant_tool_calls').insert({
    user_id: userId,
    run_id: runId,
    conversation_id: conversationId,
    tool_name: toolName,
    arguments: args,
    result,
    status: result.error ? 'failed' : 'completed',
    error_message: result.error ? String(result.error) : '',
  });
  if (error) console.warn('assistant tool log unavailable', error.message);
}

async function persistPendingAction(adminClient: any, userId: string, conversationId: string | null, runId: string | null, action: Record<string, unknown>) {
  if (!adminClient) throw new Error('服务端暂未启用待确认任务存储，请先完成数据库迁移');
  const { data, error } = await adminClient
    .from('assistant_pending_actions')
    .insert({
      user_id: userId,
      conversation_id: conversationId,
      run_id: runId,
      action_type: action.action_type || 'batch_replace',
      affected_record_ids: action.affected_record_ids || [],
      preview: action,
      status: 'pending',
      expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    })
    .select('id')
    .single();
  if (error) throw error;
  return { ...action, pending_action_id: data.id, status: 'pending_confirmation' };
}

async function executeChatTool(toolName: string, args: Record<string, unknown>, client: any, today: string) {
  if (toolName === 'search_knowledge') {
    const query = String(args.query || '').toLowerCase();
    const { data, error } = await client
      .from('assistant_knowledge')
      .select('title,category,content,source,updated_at,expires_at')
      .eq('status', 'published')
      .order('updated_at', { ascending: false })
      .limit(50);
    if (error) throw error;
    const tokens = query.split(/[^\p{L}\p{N}]+/u).filter((token) => token.length >= 2);
    const knowledge = (data || []).filter((row: Record<string, unknown>) => {
      if (row.expires_at && String(row.expires_at) < today) return false;
      const haystack = `${row.title || ''} ${row.category || ''} ${row.content || ''} ${row.source || ''}`.toLowerCase();
      return !tokens.length || tokens.some((token) => haystack.includes(token));
    }).slice(0, 8);
    return { knowledge };
  }

  if (toolName === 'get_order_detail') {
    const searchText = String(args.search_text || '').trim();
    if (!searchText) throw new Error('请提供订单编号、确认号、客户或酒店线索');
    const rows = await loadOrderQueryRows(client);
    const needle = normalizedText(searchText);
    const matches = rows.filter((order) => `${order.id || ''} ${order.order_code || ''} ${order.confirmation || ''} ${order.customer || ''} ${order.booker || ''} ${order.location || ''} ${order.supplier || ''} ${order.product || ''}`.toLocaleLowerCase().includes(needle));
    let relatedIncome: Record<string, unknown>[] = [];
    if (args.include_related_income === true && matches.length) {
      const { data, error } = await client.from('other_income').select(incomeQueryFields).limit(10000);
      if (error) throw error;
      const ids = new Set(matches.flatMap((order) => [String(order.id || ''), String(order.order_code || '')]));
      relatedIncome = (data || []).filter((income: Record<string, unknown>) => String(income.order_id || '').split(',').map((id) => id.trim()).some((id) => ids.has(id))).map((income: Record<string, unknown>) => ({
        id: income.id, date: income.income_date || '', name: income.name || '', payer: income.payer || '', payee: income.payee || '', order_id: income.order_id || '', amount: numberValue(income.amount), expense: numberValue(income.expense), net: numberValue(income.amount) - numberValue(income.expense),
      }));
    }
    return { query_result: { kind: 'order_detail', title: '订单详情', search_text: searchText, matched_count: matches.length, orders: matches.slice(0, queryLimit(args)).map(formatOrderQueryRow), related_income: relatedIncome, truncated: matches.length > queryLimit(args) } };
  }

  if (toolName === 'find_unpaid_orders') {
    const rows = (await loadOrderQueryRows(client)).filter((order) => matchesOrderQuery(order, args, { includeSearch: true }) && customerReceivableRecord(order));
    const orders = rows.slice(0, queryLimit(args)).map(formatOrderQueryRow);
    return { query_result: { kind: 'unpaid_orders', title: '未付款订单', date_field: args.date_field === 'service_date' ? '入住/出发日期' : '下单日期', start: String(args.start || ''), end: String(args.end || ''), matched_count: rows.length, outstanding_total: rows.reduce((sum, order) => sum + Math.max(0, numberValue(order.gmv) - numberValue(order.received)), 0), orders, truncated: rows.length > orders.length } };
  }

  if (toolName === 'find_commission_outstanding') {
    const rows = (await loadOrderQueryRows(client)).filter((order) => matchesOrderQuery(order, args, { includeSearch: true }) && isCommissionOrderRecord(order) && commissionOutstandingRecord(order) > 0);
    const orders = rows.slice(0, queryLimit(args)).map(formatOrderQueryRow);
    return { query_result: { kind: 'commission_outstanding', title: '待返佣订单', date_field: args.date_field === 'service_date' ? '入住/出发日期' : '下单日期', start: String(args.start || ''), end: String(args.end || ''), matched_count: rows.length, outstanding_total: rows.reduce((sum, order) => sum + commissionOutstandingRecord(order), 0), orders, truncated: rows.length > orders.length } };
  }

  if (toolName === 'find_invoice_issues') {
    const rows = (await loadOrderQueryRows(client)).filter((order) => matchesOrderQuery(order, args, { includeSearch: true }) && invoiceIssueRecord(order, args.include_no_invoice === true));
    const orders = rows.slice(0, queryLimit(args)).map(formatOrderQueryRow);
    return { query_result: { kind: 'invoice_issues', title: '待开票订单', date_field: args.date_field === 'service_date' ? '入住/出发日期' : '下单日期', start: String(args.start || ''), end: String(args.end || ''), matched_count: rows.length, orders, truncated: rows.length > orders.length } };
  }

  if (toolName === 'find_duplicate_orders') {
    const matchMode = ['confirmation', 'same_customer_supplier_date'].includes(String(args.match_mode)) ? String(args.match_mode) : 'all';
    const rows = (await loadOrderQueryRows(client)).filter((order) => matchesOrderQuery(order, args));
    const groups = new Map<string, { reason: string; orders: Record<string, unknown>[] }>();
    const addGroup = (key: string, reason: string, order: Record<string, unknown>) => {
      if (!key) return;
      const group = groups.get(key) || { reason, orders: [] };
      if (!group.orders.some((item) => item.id === order.id)) group.orders.push(order);
      groups.set(key, group);
    };
    for (const order of rows) {
      const confirmation = normalizedText(order.confirmation);
      if (matchMode !== 'same_customer_supplier_date' && confirmation) addGroup(`confirmation:${confirmation}`, '确认号相同', order);
      if (matchMode !== 'confirmation') {
        const customer = normalizedText(order.customer), supplier = normalizedText(order.supplier), serviceDate = String(order.service_date || ''), product = normalizedText(order.product);
        if (customer && supplier && serviceDate) addGroup(`detail:${customer}|${supplier}|${product}|${serviceDate}`, '客户、酒店/航司、产品和业务日期相同', order);
      }
    }
    const duplicateGroups = [...groups.values()].filter((group) => group.orders.length > 1).slice(0, queryLimit(args, 20)).map((group) => ({ reason: group.reason, orders: group.orders.map(formatOrderQueryRow) }));
    return { query_result: { kind: 'duplicate_orders', title: '疑似重复订单', date_field: args.date_field === 'service_date' ? '入住/出发日期' : '下单日期', start: String(args.start || ''), end: String(args.end || ''), matched_count: duplicateGroups.length, groups: duplicateGroups } };
  }

  if (toolName === 'search_other_income') {
    const start = String(args.start || ''), end = String(args.end || ''), searchText = normalizedText(args.search_text), kind = ['income', 'expense'].includes(String(args.kind)) ? String(args.kind) : 'all';
    const { data, error } = await client.from('other_income').select(incomeQueryFields).limit(10000);
    if (error) throw error;
    const matches = (data || []).filter((income: Record<string, unknown>) => {
      if (!dateInRange(income.income_date, start, end)) return false;
      if (kind === 'income' && numberValue(income.amount) <= 0) return false;
      if (kind === 'expense' && numberValue(income.expense) <= 0) return false;
      if (searchText && !`${income.id || ''} ${income.income_date || ''} ${income.name || ''} ${income.payer || ''} ${income.payee || ''} ${income.order_id || ''}`.toLocaleLowerCase().includes(searchText)) return false;
      return true;
    });
    const records = matches.slice(0, queryLimit(args)).map((income: Record<string, unknown>) => ({ id: income.id, date: income.income_date || '', name: income.name || '', payer: income.payer || '', payee: income.payee || '', order_id: income.order_id || '', amount: numberValue(income.amount), expense: numberValue(income.expense), net: numberValue(income.amount) - numberValue(income.expense) }));
    return { query_result: { kind: 'other_income', title: '其它收入 / 支出', start, end, matched_count: matches.length, income_total: matches.reduce((sum, income: Record<string, unknown>) => sum + numberValue(income.amount), 0), expense_total: matches.reduce((sum, income: Record<string, unknown>) => sum + numberValue(income.expense), 0), net_total: matches.reduce((sum, income: Record<string, unknown>) => sum + numberValue(income.amount) - numberValue(income.expense), 0), records, truncated: matches.length > records.length } };
  }

  if (toolName === 'draft_accounting') return { draft: args };
  if (toolName === 'draft_data_change') {
    const target = String(args.target || '');
    const statusLabels: Record<string, string> = { booked: '预订中', confirming: '确认中', confirmed: '已确认', cancelled: '已取消', pending: '待出票', ticketed: '已出票', refunded: '已退票', '预订中': '预订中', '确认中': '确认中', '已确认': '已确认', '已取消': '已取消', '待出票': '待出票', '已出票': '已出票', '已退票': '已退票', '已退款': '已退票' };
    const statusValues: Record<string, string> = { booked: 'booked', confirming: 'confirming', confirmed: 'confirmed', cancelled: 'cancelled', pending: 'pending', ticketed: 'ticketed', refunded: 'refunded', '预订中': 'booked', '确认中': 'confirming', '已确认': 'confirmed', '已取消': 'cancelled', '待出票': 'pending', '已出票': 'ticketed', '已退票': 'refunded', '已退款': 'refunded' };
    const normalizeChangeValue = (value: unknown) => target === 'status' ? (statusValues[String(value || '').trim()] || String(value || '').trim()) : String(value || '').trim();
    let fromValue = normalizeChangeValue(args.from_value);
    const requestedToValue = String(args.to_value || '').trim();
    const toValue = normalizeChangeValue(requestedToValue);
    const searchText = String(args.search_text || '').trim();
    const filters = (args.filters && typeof args.filters === 'object' ? args.filters : {}) as Record<string, unknown>;
    const allowedTargets = new Set(['supplier', 'product', 'location', 'booker', 'customer', 'payment_platform', 'confirmation', 'status']);
    if (!allowedTargets.has(target)) throw new Error('批量修改字段不受支持');
    if (!toValue) throw new Error('修改必须提供新值');
    if (!fromValue && !searchText) throw new Error('请提供订单编号、确认号或原始值');

    const { data, error } = await client
      .from('orders')
      .select('id,order_code,type,customer,booker,location,supplier,product,confirmation,payment_platform,status,order_date,service_date')
      .limit(10000);
    if (error) throw error;
    const normalized = (value: unknown) => String(value || '').trim().toLocaleLowerCase();
    const inDateRange = (value: unknown, startKey: string, endKey: string) => {
      const date = String(value || '');
      return (!filters[startKey] || date >= String(filters[startKey])) && (!filters[endKey] || date <= String(filters[endKey]));
    };
    const candidateMatches = (data || []).filter((order: Record<string, unknown>) => {
      if (filters.type && filters.type !== 'all' && order.type !== filters.type) return false;
      if (filters.location && normalized(order.location) !== normalized(filters.location)) return false;
      if (filters.supplier && normalized(order.supplier) !== normalized(filters.supplier)) return false;
      if (filters.booker && normalized(order.booker) !== normalized(filters.booker)) return false;
      if (!inDateRange(order.order_date, 'order_date_start', 'order_date_end')) return false;
      if (!inDateRange(order.service_date, 'service_date_start', 'service_date_end')) return false;
      if (searchText) {
        const haystack = `${order.order_code || ''} ${order.id || ''} ${order.confirmation || ''} ${order.customer || ''} ${order.booker || ''} ${order.location || ''} ${order.supplier || ''} ${order.product || ''}`.toLocaleLowerCase();
        if (!haystack.includes(searchText.toLocaleLowerCase())) return false;
      }
      return true;
    });
    if (!fromValue) {
      if (candidateMatches.length === 0) throw new Error(`没有找到与“${searchText}”匹配的订单`);
      if (candidateMatches.length > 1) throw new Error(`“${searchText}”匹配到 ${candidateMatches.length} 笔订单，请补充订单编号或确认号`);
      fromValue = String(candidateMatches[0][target] || '').trim();
    }
    const matches = candidateMatches.filter((order: Record<string, unknown>) => normalized(order[target]) === normalized(fromValue));
    const targetLabels: Record<string, string> = {
      supplier: '酒店 / 航司', product: '房型 / 航班', location: '城市 / 航线', booker: '预订人',
      customer: '客户', payment_platform: '付款平台', confirmation: '确认号 / 票号', status: '订单状态',
    };
    return {
      pending_action: {
        action_type: 'batch_replace',
        target,
        target_label: targetLabels[target] || target,
        from_value: fromValue,
        from_value_label: target === 'status' ? (statusLabels[fromValue] || fromValue) : fromValue,
        to_value: toValue,
        to_value_label: target === 'status' ? (statusLabels[toValue] || requestedToValue || toValue) : toValue,
        filters,
        search_text: searchText,
        matched_count: matches.length,
        affected_record_ids: matches.map((order: Record<string, unknown>) => order.id),
        sample_records: matches.slice(0, 8).map((order: Record<string, unknown>) => ({
          id: order.id,
          order_code: order.order_code || order.id,
          customer: order.customer || '',
          booker: order.booker || '',
          service_date: order.service_date || '',
          current_value: order[target] || '',
        })),
        status: 'pending_confirmation',
      },
    };
  }
  if (toolName !== 'summarize_business') throw new Error(`未知工具：${toolName}`);

  const dateField = args.date_field === 'service_date' ? 'service_date' : 'order_date';
  const start = String(args.start || '');
  const end = String(args.end || '');
  const type = ['hotel', 'flight'].includes(String(args.type)) ? String(args.type) : 'all';
  const includeFailed = args.include_failed === true;
  const [ordersResult, incomeResult] = await Promise.all([
    client.from('orders').select('id,order_code,type,customer,booker,location,supplier,payment_platform,service_date,order_date,rooms,nights,tickets,gmv,cost,received,status,settlement_mode,commission_expected,commission_received,direct_cost,profit_override').limit(10000),
    client.from('other_income').select('income_date,amount,expense').limit(10000),
  ]);
  if (ordersResult.error) throw ordersResult.error;
  if (incomeResult.error) throw incomeResult.error;

  const rows = (ordersResult.data || []).filter((order: Record<string, unknown>) => {
    if (!dateInRange(order[dateField], start, end)) return false;
    if (type !== 'all' && order.type !== type) return false;
    if (args.location && String(order.location || '') !== String(args.location)) return false;
    if (args.supplier && String(order.supplier || '') !== String(args.supplier)) return false;
    if (args.booker && String(order.booker || '') !== String(args.booker)) return false;
    if (!includeFailed && ['cancelled', 'refunded'].includes(String(order.status))) return false;
    return true;
  });
  const incomes = (incomeResult.data || []).filter((income: Record<string, unknown>) => dateInRange(income.income_date, start, end));
  const summary = {
    orders: rows.length,
    gmv: rows.reduce((sum, order) => sum + numberValue(order.gmv), 0),
    profit: rows.reduce((sum, order) => sum + orderProfit(order), 0),
    roomNights: rows.reduce((sum, order) => sum + (order.type === 'hotel' ? numberValue(order.rooms || 1) * numberValue(order.nights) : 0), 0),
    tickets: rows.reduce((sum, order) => sum + numberValue(order.tickets), 0),
    received: rows.reduce((sum, order) => sum + numberValue(order.received), 0),
    expectedCommission: rows.reduce((sum, order) => sum + numberValue(order.commission_expected), 0),
    receivedCommission: rows.reduce((sum, order) => sum + numberValue(order.commission_received), 0),
    otherIncome: incomes.reduce((sum, income) => sum + numberValue(income.amount), 0),
    otherExpense: incomes.reduce((sum, income) => sum + numberValue(income.expense), 0),
    otherNet: incomes.reduce((sum, income) => sum + numberValue(income.amount) - numberValue(income.expense), 0),
  };
  const groupBy = String(args.group_by || 'none');
  const ranking = groupBy === 'none' ? [] : Object.values(rows.reduce((groups: Record<string, any>, order: Record<string, unknown>) => {
    const name = String(order[groupBy] || '未填写');
    const current = groups[name] || { name, orders: 0, gmv: 0, profit: 0 };
    current.orders += 1;
    current.gmv += numberValue(order.gmv);
    current.profit += orderProfit(order);
    groups[name] = current;
    return groups;
  }, {})).sort((a: any, b: any) => b.profit - a.profit).slice(0, 10);
  const scopeLabel = start && end ? `${start} 至 ${end}` : '全部数据';
  return {
    analysis: {
      question: '',
      scopeLabel,
      dateFieldLabel: dateField === 'service_date' ? '入住/出发日期' : '下单日期',
      type,
      condition: includeFailed ? '包含取消/退款' : '排除取消/退款',
      summary: { ...summary, margin: summary.gmv ? summary.profit / summary.gmv * 100 : 0 },
      ranking,
      topOrders: rows.slice(0, 10).map((order: Record<string, unknown>) => ({
        code: order.order_code || order.id,
        customer: order.customer || '未填写',
        supplier: order.supplier || '未填写',
        date: order[dateField] || '',
        gmv: numberValue(order.gmv),
        profit: orderProfit(order),
      })),
    },
  };
}

function safeBaseUrl(value: string) {
  const fallback = Deno.env.get('AI_BASE_URL') || 'https://api.openai.com/v1';
  try {
    const url = new URL(value || fallback);
    if (url.protocol !== 'https:') throw new Error('模型接口必须使用 HTTPS');
    return url.toString().replace(/\/$/, '');
  } catch {
    throw new Error('模型接口地址无效');
  }
}

function parseModelJson(content: string) {
  const cleaned = content.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('模型没有返回有效 JSON');
  return JSON.parse(cleaned.slice(start, end + 1));
}

async function callModel(baseUrl: string, apiKey: string, payload: Record<string, unknown>) {
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result?.error?.message || `模型接口错误：${response.status}`);
  return result;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: '只支持 POST' }, 405);

  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return json({ error: '请先登录' }, 401);
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const adminClient = serviceRoleKey ? createClient(supabaseUrl, serviceRoleKey) : null;
  let runId: string | null = null;
  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) return json({ error: '登录已过期，请重新登录' }, 401);

  try {
    const body = await request.json();
    const mode = String(body?.mode || 'accounting');
    const text = String(body?.text || '').trim();
    if (mode === 'confirm_action' || mode === 'cancel_action') {
      const actionId = String(body?.action_id || '').trim();
      if (!actionId) return json({ error: '缺少待确认任务编号' }, 400);
      const rpcName = mode === 'confirm_action' ? 'confirm_assistant_batch_replace' : 'reject_assistant_pending_action';
      const { data, error } = await userClient.rpc(rpcName, { p_action_id: actionId });
      if (error) return json({ error: error.message }, error.code === '42883' ? 503 : 400);
      return json({ data, mode, action_id: actionId });
    }
    if (!text || text.length > 2000) return json({ error: '请输入 1 到 2000 字的内容' }, 400);
    if (mode === 'analysis' && (!body?.context || JSON.stringify(body.context).length > 16000)) {
      return json({ error: '经营分析上下文无效或过长' }, 400);
    }

    const { data: settings } = await userClient
      .from('ai_settings')
      .select('base_url,model,temperature,enabled')
      .eq('user_id', user.id)
      .maybeSingle();
    if (settings && settings.enabled === false) return json({ error: 'AI 功能尚未启用，请先在模型配置中启用' }, 400);
    const apiKey = Deno.env.get('AI_API_KEY');
    if (!apiKey) return json({ error: '后台尚未配置 AI_API_KEY' }, 503);
    const baseUrl = safeBaseUrl(settings?.base_url || '');
    const model = settings?.model || Deno.env.get('AI_MODEL') || 'gpt-4o-mini';
    const temperature = Math.min(0.5, Math.max(0, Number(settings?.temperature ?? 0.1)));
    const today = new Date().toISOString().slice(0, 10);
    const conversationId = typeof body?.conversation_id === 'string' ? body.conversation_id : null;
    runId = mode === 'chat' ? await createAssistantRun(adminClient, user.id, conversationId, text) : null;

    if (mode === 'chat') {
      const chatMessages: any[] = [
        { role: 'system', content: `${chatPrompt(today)}\n${chatToolRoutingRule}` },
        { role: 'user', content: JSON.stringify({ question: text, context: body?.context_state || {}, history: Array.isArray(body?.history) ? body.history.slice(-8) : [] }) },
      ];
      let analysis: Record<string, unknown> | null = null;
      let draft: Record<string, unknown> | null = null;
      let pendingAction: Record<string, unknown> | null = null;
      const queryResults: Record<string, unknown>[] = [];
      const toolCalls: Array<Record<string, unknown>> = [];
      for (let step = 0; step < 6; step += 1) {
        const modelResult = await callModel(baseUrl, apiKey, { model, temperature, tools: chatTools, tool_choice: 'auto', messages: chatMessages });
        const message = modelResult?.choices?.[0]?.message;
        if (!message) throw new Error('模型没有返回有效对话结果');
        if (!Array.isArray(message.tool_calls) || !message.tool_calls.length) {
          let finalData: Record<string, unknown>;
          try {
            finalData = typeof message.content === 'string' ? parseModelJson(message.content) : { answer: '当前没有可回答的内容。' };
          } catch {
            finalData = { answer: String(message.content || '当前没有可回答的内容。') };
          }
          if (analysis) analysis = { ...analysis, question: text, answer: finalData.answer || '' };
          await updateAssistantRun(adminClient, runId, pendingAction
            ? { status: 'waiting_confirmation', current_step: 'waiting_confirmation' }
            : { status: 'completed', current_step: 'completed', completed_at: new Date().toISOString() });
          return json({ data: { ...finalData, analysis, draft, pending_action: pendingAction, query_results: queryResults }, model, mode, tool_calls: toolCalls });
        }
        chatMessages.push({ role: 'assistant', content: message.content || null, tool_calls: message.tool_calls });
        for (const call of message.tool_calls) {
          const toolName = String(call?.function?.name || '');
          let args: Record<string, unknown> = {};
          try { args = JSON.parse(call?.function?.arguments || '{}'); } catch { args = {}; }
          let toolResult: Record<string, unknown>;
          try {
            toolResult = await executeChatTool(toolName, args, userClient, today);
          } catch (error) {
            toolResult = { error: error instanceof Error ? error.message : '工具执行失败' };
          }
          if (toolResult.analysis) analysis = toolResult.analysis as Record<string, unknown>;
          if (toolResult.draft) draft = toolResult.draft as Record<string, unknown>;
          if (toolResult.pending_action) {
            pendingAction = await persistPendingAction(adminClient, user.id, conversationId, runId, toolResult.pending_action as Record<string, unknown>);
            toolResult = { ...toolResult, pending_action: pendingAction };
          }
          if (toolResult.query_result) queryResults.push(toolResult.query_result as Record<string, unknown>);
          await recordAssistantToolCall(adminClient, user.id, conversationId, runId, toolName, args, toolResult);
          toolCalls.push({ name: toolName, arguments: args, status: toolResult.error ? 'failed' : 'completed' });
          chatMessages.push({ role: 'tool', tool_call_id: call.id, name: toolName, content: JSON.stringify(toolResult) });
        }
      }
      return json({ error: 'AI 工具调用超过最大步数，请缩小问题范围后重试' }, 502);
    }

    let knowledge: Record<string, unknown>[] = [];
    if (mode === 'assistant') {
      const { data: knowledgeRows } = await userClient.from('assistant_knowledge').select('title,category,content,source,updated_at,expires_at').eq('status', 'published').order('updated_at', { ascending: false }).limit(50);
      const tokens = text.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((token: string) => token.length >= 2);
      knowledge = (knowledgeRows || []).filter((row: Record<string, unknown>) => {
        if (row.expires_at && String(row.expires_at) < today) return false;
        const haystack = `${row.title || ''} ${row.category || ''} ${row.content || ''} ${row.source || ''}`.toLowerCase();
        return !tokens.length || tokens.some((token: string) => haystack.includes(token));
      }).slice(0, 8);
    }
    const memory = { context: body?.context_state || {}, history: Array.isArray(body?.history) ? body.history.slice(-8) : [], knowledge };
    const prompt = mode === 'analysis' ? analysisPrompt : mode === 'assistant' ? assistantPrompt : systemPrompt(today);
    const content = mode === 'analysis'
      ? JSON.stringify({ question: text, context: body.context, memory })
      : mode === 'assistant'
        ? JSON.stringify({ question: text, memory })
        : JSON.stringify({ text, memory });
    const result = await callModel(baseUrl, apiKey, { model, temperature, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: prompt }, { role: 'user', content }] });
    const modelContent = result?.choices?.[0]?.message?.content;
    if (typeof modelContent !== 'string') return json({ error: '模型没有返回可识别结果' }, 502);
    return json({ data: parseModelJson(modelContent), model, mode });
  } catch (error) {
    await updateAssistantRun(adminClient, runId, { status: 'failed', current_step: 'failed', error_message: error instanceof Error ? error.message : 'unknown error', completed_at: new Date().toISOString() });
    return json({ error: error instanceof Error ? error.message : 'AI 处理失败' }, 500);
  }
});
