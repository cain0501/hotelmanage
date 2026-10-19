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
5. 新增、修改、收款、返佣和批量操作只生成 draft_accounting，不直接写订单或收入表；需要关联已有订单时使用 search_text 提供确认号、订单编号或客户线索。
6. 没有实时天气、库存、价格、航班或签证工具时，必须明确说明当前没有对应实时查询能力。
7. 最终只输出 JSON：{"answer":"中文回答","needs_clarification":false,"unsupported":false}。统计回答必须引用工具返回的范围、日期口径和结果，不得自行重算。`;

const chatTools = [
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
          group_by: { type: 'string', enum: ['none', 'location', 'supplier', 'booker'] },
          include_failed: { type: 'boolean' },
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

  if (toolName === 'draft_accounting') return { draft: args };
  if (toolName !== 'summarize_business') throw new Error(`未知工具：${toolName}`);

  const dateField = args.date_field === 'service_date' ? 'service_date' : 'order_date';
  const start = String(args.start || '');
  const end = String(args.end || '');
  const type = ['hotel', 'flight'].includes(String(args.type)) ? String(args.type) : 'all';
  const includeFailed = args.include_failed === true;
  const [ordersResult, incomeResult] = await Promise.all([
    client.from('orders').select('id,order_code,type,customer,booker,location,supplier,service_date,order_date,rooms,nights,tickets,gmv,cost,received,status,settlement_mode,commission_expected,commission_received,direct_cost,profit_override').limit(10000),
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
  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) return json({ error: '登录已过期，请重新登录' }, 401);

  try {
    const body = await request.json();
    const mode = String(body?.mode || 'accounting');
    const text = String(body?.text || '').trim();
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

    if (mode === 'chat') {
      const chatMessages: any[] = [
        { role: 'system', content: chatPrompt(today) },
        { role: 'user', content: JSON.stringify({ question: text, context: body?.context_state || {}, history: Array.isArray(body?.history) ? body.history.slice(-8) : [] }) },
      ];
      let analysis: Record<string, unknown> | null = null;
      let draft: Record<string, unknown> | null = null;
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
          return json({ data: { ...finalData, analysis, draft }, model, mode, tool_calls: toolCalls });
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
    return json({ error: error instanceof Error ? error.message : 'AI 处理失败' }, 500);
  }
});
