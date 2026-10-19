-- 栖账 Supabase 数据库初始化脚本
-- 在 Supabase Dashboard -> SQL Editor 中完整粘贴并点击 Run 一次。
-- 只允许已登录用户访问自己的订单和其它收入记录。

create table if not exists public.orders (
  id text not null,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  order_code text not null,
  type text not null default 'hotel' check (type in ('hotel', 'flight')),
  customer text not null default '',
  booker text not null default '',
  order_date date,
  service_date date,
  location text not null default '',
  supplier text not null default '',
  product text not null default '',
  rooms numeric not null default 0,
  nights numeric not null default 0,
  tickets numeric not null default 0,
  confirmation text not null default '',
  gmv numeric not null default 0,
  cost numeric not null default 0,
  received numeric not null default 0,
  payment_status text not null default 'paid',
  payment_platform text not null default '',
  settlement_mode text not null default 'agency_pay',
  guest_payment_to text not null default '',
  commission_platform text not null default '',
  commission_expected numeric not null default 0,
  commission_received numeric not null default 0,
  commission_status text not null default 'none',
  direct_cost numeric not null default 0,
  commission_received_date date,
  invoice_status text not null default 'unissued',
  invoice_company text not null default '',
  profit_override numeric,
  status text not null default 'booked',
  issues jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id),
  unique (user_id, order_code)
);

create table if not exists public.other_income (
  id text not null,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  income_date date not null,
  name text not null default '',
  payer text not null default '',
  payee text not null default '',
  order_id text,
  amount numeric not null default 0,
  expense numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.ai_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  provider text not null default 'openai-compatible',
  base_url text not null default 'https://api.openai.com/v1',
  model text not null default 'gpt-4o-mini',
  temperature numeric not null default 0.1,
  enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.quality_issue_actions (
  id text not null,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  order_id text not null,
  issue_kind text not null,
  status text not null default 'open' check (status in ('open', 'processed', 'ignored')),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

-- 对已经创建过但字段不完整的旧表补齐字段；重复执行不会报错。
alter table public.orders add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.orders add column if not exists order_code text;
alter table public.orders add column if not exists type text default 'hotel';
alter table public.orders add column if not exists customer text default '';
alter table public.orders add column if not exists booker text default '';
alter table public.orders add column if not exists order_date date;
alter table public.orders add column if not exists service_date date;
alter table public.orders add column if not exists location text default '';
alter table public.orders add column if not exists supplier text default '';
alter table public.orders add column if not exists product text default '';
alter table public.orders add column if not exists rooms numeric default 0;
alter table public.orders add column if not exists nights numeric default 0;
alter table public.orders add column if not exists tickets numeric default 0;
alter table public.orders add column if not exists confirmation text default '';
alter table public.orders add column if not exists gmv numeric default 0;
alter table public.orders add column if not exists cost numeric default 0;
alter table public.orders add column if not exists received numeric default 0;
alter table public.orders add column if not exists payment_status text default 'paid';
alter table public.orders add column if not exists payment_platform text default '';
alter table public.orders add column if not exists settlement_mode text default 'agency_pay';
alter table public.orders add column if not exists guest_payment_to text default '';
alter table public.orders add column if not exists commission_platform text default '';
alter table public.orders add column if not exists commission_expected numeric default 0;
alter table public.orders add column if not exists commission_received numeric default 0;
alter table public.orders add column if not exists commission_status text default 'none';
alter table public.orders add column if not exists direct_cost numeric default 0;
alter table public.orders add column if not exists commission_received_date date;
alter table public.orders add column if not exists invoice_status text default 'unissued';
alter table public.orders add column if not exists invoice_company text default '';
alter table public.orders add column if not exists profit_override numeric;
alter table public.orders add column if not exists status text default 'booked';
alter table public.orders add column if not exists issues jsonb default '[]'::jsonb;
alter table public.orders add column if not exists created_at timestamptz default now();
alter table public.orders add column if not exists updated_at timestamptz default now();

alter table public.other_income add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.other_income add column if not exists income_date date;
alter table public.other_income add column if not exists name text default '';
alter table public.other_income add column if not exists payer text default '';
alter table public.other_income add column if not exists payee text default '';
alter table public.other_income add column if not exists order_id text;
alter table public.other_income add column if not exists amount numeric default 0;
alter table public.other_income add column if not exists expense numeric default 0;
alter table public.other_income add column if not exists created_at timestamptz default now();
alter table public.other_income add column if not exists updated_at timestamptz default now();

alter table public.ai_settings enable row level security;
drop policy if exists "ai_settings_select_own" on public.ai_settings;
drop policy if exists "ai_settings_insert_own" on public.ai_settings;
drop policy if exists "ai_settings_update_own" on public.ai_settings;
drop policy if exists "ai_settings_delete_own" on public.ai_settings;
create policy "ai_settings_select_own" on public.ai_settings for select to authenticated using (user_id = auth.uid());
create policy "ai_settings_insert_own" on public.ai_settings for insert to authenticated with check (user_id = auth.uid());
create policy "ai_settings_update_own" on public.ai_settings for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "ai_settings_delete_own" on public.ai_settings for delete to authenticated using (user_id = auth.uid());

alter table public.quality_issue_actions enable row level security;
drop policy if exists "quality_issue_actions_select_own" on public.quality_issue_actions;
drop policy if exists "quality_issue_actions_insert_own" on public.quality_issue_actions;
drop policy if exists "quality_issue_actions_update_own" on public.quality_issue_actions;
drop policy if exists "quality_issue_actions_delete_own" on public.quality_issue_actions;
create policy "quality_issue_actions_select_own" on public.quality_issue_actions for select to authenticated using (user_id = auth.uid());
create policy "quality_issue_actions_insert_own" on public.quality_issue_actions for insert to authenticated with check (user_id = auth.uid());
create policy "quality_issue_actions_update_own" on public.quality_issue_actions for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "quality_issue_actions_delete_own" on public.quality_issue_actions for delete to authenticated using (user_id = auth.uid());

create index if not exists orders_user_order_date_idx on public.orders (user_id, order_date desc);
create index if not exists orders_user_service_date_idx on public.orders (user_id, service_date desc);
create index if not exists other_income_user_date_idx on public.other_income (user_id, income_date desc);
create index if not exists quality_issue_actions_user_updated_idx on public.quality_issue_actions (user_id, updated_at desc);
create unique index if not exists orders_user_id_id_key on public.orders (user_id, id);
create unique index if not exists other_income_user_id_id_key on public.other_income (user_id, id);

alter table public.orders enable row level security;
alter table public.other_income enable row level security;

drop policy if exists "orders_select_own" on public.orders;
drop policy if exists "orders_insert_own" on public.orders;
drop policy if exists "orders_update_own" on public.orders;
drop policy if exists "orders_delete_own" on public.orders;
create policy "orders_select_own" on public.orders for select to authenticated using (user_id = auth.uid());
create policy "orders_insert_own" on public.orders for insert to authenticated with check (user_id = auth.uid());
create policy "orders_update_own" on public.orders for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "orders_delete_own" on public.orders for delete to authenticated using (user_id = auth.uid());

drop policy if exists "other_income_select_own" on public.other_income;
drop policy if exists "other_income_insert_own" on public.other_income;
drop policy if exists "other_income_update_own" on public.other_income;
drop policy if exists "other_income_delete_own" on public.other_income;
create policy "other_income_select_own" on public.other_income for select to authenticated using (user_id = auth.uid());
create policy "other_income_insert_own" on public.other_income for insert to authenticated with check (user_id = auth.uid());
create policy "other_income_update_own" on public.other_income for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "other_income_delete_own" on public.other_income for delete to authenticated using (user_id = auth.uid());

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists orders_set_updated_at on public.orders;
create trigger orders_set_updated_at before update on public.orders for each row execute function public.set_updated_at();
drop trigger if exists other_income_set_updated_at on public.other_income;
create trigger other_income_set_updated_at before update on public.other_income for each row execute function public.set_updated_at();
drop trigger if exists ai_settings_set_updated_at on public.ai_settings;
create trigger ai_settings_set_updated_at before update on public.ai_settings for each row execute function public.set_updated_at();
drop trigger if exists quality_issue_actions_set_updated_at on public.quality_issue_actions;
create trigger quality_issue_actions_set_updated_at before update on public.quality_issue_actions for each row execute function public.set_updated_at();

-- 开启跨设备实时刷新；重复执行时忽略“已存在于 publication”的提示。
do $$
begin
  begin
    alter publication supabase_realtime add table public.orders;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.other_income;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.quality_issue_actions;
  exception when duplicate_object then null;
  end;
end;
$$;

-- AI 工作台：会话、上下文、工具调用、待确认操作和专业知识库。
-- 这些表只保存 AI 工作流状态，不改变 orders / other_income 的业务口径。
create table if not exists public.assistant_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null default 'AI 工作台',
  summary text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.assistant_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  conversation_id uuid not null references public.assistant_conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'tool', 'system')),
  content text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.assistant_context (
  conversation_id uuid primary key references public.assistant_conversations(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date_field text not null default 'order_date',
  period_start date,
  period_end date,
  order_type text not null default 'all',
  city text not null default '',
  supplier text not null default '',
  booker text not null default '',
  pending_question text not null default '',
  context jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.assistant_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  conversation_id uuid references public.assistant_conversations(id) on delete set null,
  user_message text not null default '',
  status text not null default 'running' check (status in ('running', 'completed', 'waiting_confirmation', 'failed', 'cancelled')),
  current_step text not null default '',
  error_message text not null default '',
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.assistant_tool_calls (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  run_id uuid references public.assistant_runs(id) on delete cascade,
  conversation_id uuid references public.assistant_conversations(id) on delete set null,
  tool_name text not null,
  arguments jsonb not null default '{}'::jsonb,
  result jsonb not null default '{}'::jsonb,
  status text not null default 'completed' check (status in ('started', 'completed', 'failed')),
  error_message text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.assistant_pending_actions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  run_id uuid references public.assistant_runs(id) on delete set null,
  conversation_id uuid references public.assistant_conversations(id) on delete set null,
  action_type text not null,
  affected_record_ids jsonb not null default '[]'::jsonb,
  preview jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'rejected', 'expired')),
  expires_at timestamptz,
  confirmed_by uuid references auth.users(id) on delete set null,
  confirmed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.assistant_knowledge (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null default '',
  category text not null default 'hotel_product',
  scope text not null default 'personal' check (scope in ('personal', 'team')),
  content text not null default '',
  keywords text[] not null default '{}',
  source text not null default '用户提供',
  source_type text not null default 'manual',
  effective_from date,
  expires_at date,
  version integer not null default 1,
  status text not null default 'draft' check (status in ('draft', 'published', 'expired', 'archived')),
  created_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.assistant_conversations enable row level security;
alter table public.assistant_messages enable row level security;
alter table public.assistant_context enable row level security;
alter table public.assistant_runs enable row level security;
alter table public.assistant_tool_calls enable row level security;
alter table public.assistant_pending_actions enable row level security;
alter table public.assistant_knowledge enable row level security;

drop policy if exists "assistant_conversations_own" on public.assistant_conversations;
create policy "assistant_conversations_own" on public.assistant_conversations for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "assistant_messages_own" on public.assistant_messages;
create policy "assistant_messages_own" on public.assistant_messages for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "assistant_context_own" on public.assistant_context;
create policy "assistant_context_own" on public.assistant_context for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "assistant_runs_own" on public.assistant_runs;
create policy "assistant_runs_own" on public.assistant_runs for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "assistant_tool_calls_own" on public.assistant_tool_calls;
create policy "assistant_tool_calls_own" on public.assistant_tool_calls for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "assistant_pending_actions_own" on public.assistant_pending_actions;
create policy "assistant_pending_actions_own" on public.assistant_pending_actions for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "assistant_knowledge_own" on public.assistant_knowledge;
create policy "assistant_knowledge_own" on public.assistant_knowledge for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create index if not exists assistant_conversations_user_updated_idx on public.assistant_conversations (user_id, updated_at desc);
create index if not exists assistant_messages_conversation_created_idx on public.assistant_messages (conversation_id, created_at);
create index if not exists assistant_runs_user_created_idx on public.assistant_runs (user_id, created_at desc);
create index if not exists assistant_tool_calls_run_created_idx on public.assistant_tool_calls (run_id, created_at);
create index if not exists assistant_pending_actions_user_status_idx on public.assistant_pending_actions (user_id, status, created_at desc);
create index if not exists assistant_knowledge_user_status_idx on public.assistant_knowledge (user_id, status, updated_at desc);

drop trigger if exists assistant_conversations_set_updated_at on public.assistant_conversations;
create trigger assistant_conversations_set_updated_at before update on public.assistant_conversations for each row execute function public.set_updated_at();
drop trigger if exists assistant_context_set_updated_at on public.assistant_context;
create trigger assistant_context_set_updated_at before update on public.assistant_context for each row execute function public.set_updated_at();
drop trigger if exists assistant_knowledge_set_updated_at on public.assistant_knowledge;
create trigger assistant_knowledge_set_updated_at before update on public.assistant_knowledge for each row execute function public.set_updated_at();
