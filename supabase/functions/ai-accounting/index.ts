import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
  });

const schema = {
  intent: 'order | other_income | other_expense | payment | commission | unknown',
  confidence: 'number from 0 to 1',
  missing_fields: 'array of Chinese field names that must be confirmed',
  notes: 'array of short Chinese notes',
  order: {
    type: 'hotel | flight', customer: 'string', booker: 'string', order_date: 'YYYY-MM-DD', service_date: 'YYYY-MM-DD',
    location: 'string', supplier: 'string', product: 'string', confirmation: 'string', rooms: 'number', nights: 'number',
    tickets: 'number', gmv: 'number', cost: 'number', payment_status: 'paid | partial | unpaid | refunded', payment_platform: 'string',
    status: 'booked | confirming | confirmed | cancelled | pending | ticketed | refunded', commission_platform: 'string', commission_expected: 'number', commission_received: 'number', direct_cost: 'number', guest_payment_to: 'string',
  },
  income: { date: 'YYYY-MM-DD', name: 'string', payer: 'string', payee: 'string', amount: 'number', expense: 'number', search_text: 'string' },
};

const systemPrompt = (today: string) => `你是酒店和机票运营台账助手。今天是 ${today}。把用户的中文自然语言转换成可审核的结构化记账草稿。
只输出一个 JSON 对象，不要 Markdown，不要解释文字。严格遵守以下结构：${JSON.stringify(schema)}。
规则：
1. 不要臆造金额、日期、客户、供应商、房型、确认号。缺失且会影响入账的字段放进 missing_fields。
2. “今天、明天、后天”按今天 ${today} 计算；没有明确的下单日期时可用今天，但在 notes 标记“下单日期按今天填入”。
3. 酒店的“住2晚、2晚”填 nights，房晚由系统按 rooms × nights 计算；机票数量填 tickets。
4. “客人前台付款、平台返佣”属于 commission，订单成本填 0；识别返佣平台、预计佣金、已收佣金、直接费用时填入对应字段，不要把 GMV 当利润。
5. “收到、收款、返佣到账”不要创建新订单，优先识别为 payment 或 commission，并把搜索线索放入 income.search_text。
6. 付款状态为空时不要默认已付款，放入 missing_fields。
7. 无法判断时 intent=unknown。所有数字必须是数字，无法确定时为 0。空字符串代表没有识别到。`;

const analysisPrompt = `你是酒店运营分析说明助手。用户的问题已经由前端白名单规则完成统计，下面会提供确定性的统计口径和结果。
只根据 context 中的事实组织中文回答，不要重新计算、补造数据、生成 SQL，也不要修改任何订单。
只输出 JSON：{"answer":"简洁但完整的中文回答","key_points":["不超过3条要点"],"limitations":["必要时说明口径或数据限制"]}。
回答必须明确统计范围、日期口径和关键金额；如果数据不足，直接说明“当前数据不足以判断”，不要猜测。`;

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

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: '只支持 POST' }, 405);

  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return json({ error: '请先登录' }, 401);
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) return json({ error: '登录已过期，请重新登录' }, 401);

  try {
    const body = await request.json();
    const mode = String(body?.mode || 'accounting');
    const text = String(body?.text || '').trim();
    if (!text || text.length > 2000) return json({ error: '请输入 1 到 2000 字的记账内容' }, 400);
    if (mode === 'analysis' && (!body?.context || JSON.stringify(body.context).length > 16000)) return json({ error: '经营分析上下文无效或过长' }, 400);
    const { data: settings } = await userClient.from('ai_settings').select('provider,base_url,model,temperature,enabled').eq('user_id', user.id).maybeSingle();
    if (settings && settings.enabled === false) return json({ error: 'AI功能尚未启用，请先在模型配置中启用' }, 400);
    const apiKey = Deno.env.get('AI_API_KEY');
    if (!apiKey) return json({ error: '后台尚未配置 AI_API_KEY' }, 503);
    const baseUrl = safeBaseUrl(settings?.base_url || '');
    const model = settings?.model || Deno.env.get('AI_MODEL') || 'gpt-4o-mini';
    const temperature = Math.min(0.5, Math.max(0, Number(settings?.temperature ?? 0.1)));
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, temperature, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: mode === 'analysis' ? analysisPrompt : systemPrompt(new Date().toISOString().slice(0, 10)) }, { role: 'user', content: mode === 'analysis' ? JSON.stringify({ question: text, context: body.context }) : text }] }),
    });
    const result = await response.json();
    if (!response.ok) return json({ error: result?.error?.message || `模型接口错误（${response.status}）` }, 502);
    const content = result?.choices?.[0]?.message?.content;
    if (typeof content !== 'string') return json({ error: '模型没有返回识别结果' }, 502);
    return json({ data: parseModelJson(content), model, mode });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'AI记账失败' }, 500);
  }
});
