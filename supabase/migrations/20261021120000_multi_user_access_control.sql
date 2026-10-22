-- 多用户账户、注册审核、功能权限和公共知识库隔离。
-- 默认不授予新用户任何业务权限；管理员通过后台显式分配。

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null default '',
  display_name text not null default '',
  role text not null default 'user' check (role in ('admin', 'user')),
  account_status text not null default 'pending' check (account_status in ('pending', 'approved', 'rejected', 'suspended')),
  approved_at timestamptz,
  approved_by uuid references auth.users(id) on delete set null,
  rejected_reason text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.feature_catalog (
  feature_key text primary key,
  label text not null,
  description text not null default '',
  default_enabled boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.user_feature_permissions (
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  feature_key text not null references public.feature_catalog(feature_key) on delete cascade,
  enabled boolean not null default false,
  granted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, feature_key)
);

create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  target_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

insert into public.feature_catalog (feature_key, label, description, default_enabled, sort_order) values
  ('dashboard.view', '经营总览', '查看经营总览和统计图表', false, 10),
  ('orders.view', '订单台账', '查看订单台账', false, 20),
  ('orders.edit', '新增和编辑订单', '新增、编辑和登记订单', false, 30),
  ('orders.delete', '删除订单', '删除订单记录', false, 40),
  ('orders.import', '导入订单', '导入 Excel 订单', false, 50),
  ('orders.export', '导出订单', '导出订单数据', false, 60),
  ('ledger.view', '资金流水', '查看资金流水', false, 70),
  ('other_income.manage', '其它收入', '管理其它收入和支出', false, 80),
  ('quality.view', '数据待办', '查看和处理数据待办', false, 90),
  ('ai.use', 'AI 工作台', '使用 AI 查询、分析和记账', false, 100),
  ('knowledge.read', '阅读知识库', '阅读已发布公共知识', false, 110),
  ('knowledge.submit', '提交知识库草稿', '提交专业知识草稿', false, 120),
  ('knowledge.publish', '发布知识库', '审核和发布公共知识', false, 130),
  ('settings.manage', '模型配置', '管理个人 AI 模型配置', false, 140),
  ('users.manage', '用户管理', '审核和暂停用户', false, 150),
  ('permissions.manage', '权限分配', '分配用户功能权限', false, 160)
on conflict (feature_key) do update set label=excluded.label, description=excluded.description, sort_order=excluded.sort_order;

create or replace function public.is_current_user_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where user_id = auth.uid() and role = 'admin' and account_status = 'approved'
  );
$$;

create or replace function public.is_current_user_approved()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where user_id = auth.uid() and account_status = 'approved'
  );
$$;

create or replace function public.has_feature(required_feature text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_current_user_admin()
    or (
      public.is_current_user_approved()
      and exists (
        select 1 from public.user_feature_permissions
        where user_id = auth.uid() and feature_key = required_feature and enabled
      )
    );
$$;

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, email, role, account_status, approved_at)
  values (
    new.id,
    lower(coalesce(new.email, '')),
    case when lower(coalesce(new.email, '')) = 'zzljb520@hotmail.com' then 'admin' else 'user' end,
    case when lower(coalesce(new.email, '')) = 'zzljb520@hotmail.com' then 'approved' else 'pending' end,
    case when lower(coalesce(new.email, '')) = 'zzljb520@hotmail.com' then now() else null end
  )
  on conflict (user_id) do update set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
  after insert on auth.users
  for each row execute function public.handle_new_user_profile();

-- 为已存在的管理员账号补建资料；如果账号尚未注册，此语句不产生任何记录。
insert into public.profiles (user_id, email, role, account_status, approved_at)
select id, lower(coalesce(email, '')), 'admin', 'approved', now()
from auth.users
where lower(email) = 'zzljb520@hotmail.com'
on conflict (user_id) do update set role='admin', account_status='approved', approved_at=coalesce(profiles.approved_at, now());

create or replace function public.profiles_set_updated_at()
returns trigger language plpgsql security invoker set search_path = public
as $$ begin new.updated_at = now(); return new; end; $$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.profiles_set_updated_at();
drop trigger if exists user_feature_permissions_set_updated_at on public.user_feature_permissions;
create trigger user_feature_permissions_set_updated_at before update on public.user_feature_permissions for each row execute function public.profiles_set_updated_at();

alter table public.assistant_knowledge drop constraint if exists assistant_knowledge_scope_check;
alter table public.assistant_knowledge add constraint assistant_knowledge_scope_check check (scope in ('personal', 'team', 'global'));
update public.assistant_knowledge set scope='global' where status='published';

alter table public.profiles enable row level security;
alter table public.feature_catalog enable row level security;
alter table public.user_feature_permissions enable row level security;
alter table public.admin_audit_logs enable row level security;

drop policy if exists profiles_select_self_or_admin on public.profiles;
create policy profiles_select_self_or_admin on public.profiles for select to authenticated using (user_id=auth.uid() or public.is_current_user_admin());
drop policy if exists profiles_update_admin on public.profiles;
create policy profiles_update_admin on public.profiles for update to authenticated using (public.is_current_user_admin()) with check (public.is_current_user_admin());

drop policy if exists feature_catalog_select_approved on public.feature_catalog;
create policy feature_catalog_select_approved on public.feature_catalog for select to authenticated using (public.is_current_user_approved());
drop policy if exists feature_catalog_admin on public.feature_catalog;
create policy feature_catalog_admin on public.feature_catalog for all to authenticated using (public.is_current_user_admin()) with check (public.is_current_user_admin());

drop policy if exists user_feature_permissions_select_self_or_admin on public.user_feature_permissions;
create policy user_feature_permissions_select_self_or_admin on public.user_feature_permissions for select to authenticated using (user_id=auth.uid() or public.is_current_user_admin());
drop policy if exists user_feature_permissions_admin on public.user_feature_permissions;
create policy user_feature_permissions_admin on public.user_feature_permissions for all to authenticated using (public.is_current_user_admin()) with check (public.is_current_user_admin());

drop policy if exists admin_audit_logs_admin on public.admin_audit_logs;
create policy admin_audit_logs_admin on public.admin_audit_logs for all to authenticated using (public.is_current_user_admin()) with check (public.is_current_user_admin());

alter table public.orders enable row level security;
drop policy if exists orders_select_own on public.orders;
drop policy if exists orders_insert_own on public.orders;
drop policy if exists orders_update_own on public.orders;
drop policy if exists orders_delete_own on public.orders;
create policy orders_select_own on public.orders for select to authenticated using (user_id=auth.uid() and (public.has_feature('orders.view') or public.has_feature('dashboard.view') or public.has_feature('ledger.view') or public.has_feature('ai.use')));
create policy orders_insert_own on public.orders for insert to authenticated with check (user_id=auth.uid() and (public.has_feature('orders.edit') or public.has_feature('ai.use')));
create policy orders_update_own on public.orders for update to authenticated using (user_id=auth.uid() and (public.has_feature('orders.edit') or public.has_feature('ai.use'))) with check (user_id=auth.uid() and (public.has_feature('orders.edit') or public.has_feature('ai.use')));
create policy orders_delete_own on public.orders for delete to authenticated using (user_id=auth.uid() and public.has_feature('orders.delete'));

alter table public.other_income enable row level security;
drop policy if exists other_income_select_own on public.other_income;
drop policy if exists other_income_insert_own on public.other_income;
drop policy if exists other_income_update_own on public.other_income;
drop policy if exists other_income_delete_own on public.other_income;
create policy other_income_select_own on public.other_income for select to authenticated using (user_id=auth.uid() and (public.has_feature('other_income.manage') or public.has_feature('dashboard.view') or public.has_feature('ledger.view') or public.has_feature('ai.use')));
create policy other_income_insert_own on public.other_income for insert to authenticated with check (user_id=auth.uid() and (public.has_feature('other_income.manage') or public.has_feature('ai.use')));
create policy other_income_update_own on public.other_income for update to authenticated using (user_id=auth.uid() and (public.has_feature('other_income.manage') or public.has_feature('ai.use'))) with check (user_id=auth.uid() and (public.has_feature('other_income.manage') or public.has_feature('ai.use')));
create policy other_income_delete_own on public.other_income for delete to authenticated using (user_id=auth.uid() and public.has_feature('other_income.manage'));

create table if not exists public.quality_issue_actions (
  id text not null,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  order_id text not null,
  issue_kind text not null,
  status text not null default 'open' check (status in ('open', 'processed', 'ignored')),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);
alter table public.quality_issue_actions enable row level security;
drop policy if exists quality_issue_actions_select_own on public.quality_issue_actions;
drop policy if exists quality_issue_actions_insert_own on public.quality_issue_actions;
drop policy if exists quality_issue_actions_update_own on public.quality_issue_actions;
drop policy if exists quality_issue_actions_delete_own on public.quality_issue_actions;
create policy quality_issue_actions_select_own on public.quality_issue_actions for select to authenticated using (user_id=auth.uid() and (public.has_feature('quality.view') or public.has_feature('dashboard.view')));
create policy quality_issue_actions_insert_own on public.quality_issue_actions for insert to authenticated with check (user_id=auth.uid() and public.has_feature('quality.view'));
create policy quality_issue_actions_update_own on public.quality_issue_actions for update to authenticated using (user_id=auth.uid() and public.has_feature('quality.view')) with check (user_id=auth.uid() and public.has_feature('quality.view'));
create policy quality_issue_actions_delete_own on public.quality_issue_actions for delete to authenticated using (user_id=auth.uid() and public.has_feature('quality.view'));

alter table public.ai_settings enable row level security;
drop policy if exists ai_settings_select_own on public.ai_settings;
drop policy if exists ai_settings_insert_own on public.ai_settings;
drop policy if exists ai_settings_update_own on public.ai_settings;
drop policy if exists ai_settings_delete_own on public.ai_settings;
create policy ai_settings_select_own on public.ai_settings for select to authenticated using (user_id=auth.uid() and (public.has_feature('ai.use') or public.has_feature('settings.manage')));
create policy ai_settings_insert_own on public.ai_settings for insert to authenticated with check (user_id=auth.uid() and public.has_feature('settings.manage'));
create policy ai_settings_update_own on public.ai_settings for update to authenticated using (user_id=auth.uid() and public.has_feature('settings.manage')) with check (user_id=auth.uid() and public.has_feature('settings.manage'));
create policy ai_settings_delete_own on public.ai_settings for delete to authenticated using (user_id=auth.uid() and public.has_feature('settings.manage'));

-- AI 会话、记忆、运行记录和待确认任务保持用户私有，且只有拥有 AI 权限的已审核用户可访问。
alter table public.assistant_conversations enable row level security;
alter table public.assistant_messages enable row level security;
alter table public.assistant_context enable row level security;
alter table public.assistant_runs enable row level security;
alter table public.assistant_tool_calls enable row level security;
alter table public.assistant_pending_actions enable row level security;
alter table public.assistant_memories enable row level security;

drop policy if exists assistant_conversations_own on public.assistant_conversations;
create policy assistant_conversations_own on public.assistant_conversations for all to authenticated using (user_id=auth.uid() and public.has_feature('ai.use')) with check (user_id=auth.uid() and public.has_feature('ai.use'));
drop policy if exists assistant_messages_own on public.assistant_messages;
create policy assistant_messages_own on public.assistant_messages for all to authenticated using (user_id=auth.uid() and public.has_feature('ai.use')) with check (user_id=auth.uid() and public.has_feature('ai.use'));
drop policy if exists assistant_context_own on public.assistant_context;
create policy assistant_context_own on public.assistant_context for all to authenticated using (user_id=auth.uid() and public.has_feature('ai.use')) with check (user_id=auth.uid() and public.has_feature('ai.use'));
drop policy if exists assistant_runs_own on public.assistant_runs;
create policy assistant_runs_own on public.assistant_runs for all to authenticated using (user_id=auth.uid() and public.has_feature('ai.use')) with check (user_id=auth.uid() and public.has_feature('ai.use'));
drop policy if exists assistant_tool_calls_own on public.assistant_tool_calls;
create policy assistant_tool_calls_own on public.assistant_tool_calls for all to authenticated using (user_id=auth.uid() and public.has_feature('ai.use')) with check (user_id=auth.uid() and public.has_feature('ai.use'));
drop policy if exists assistant_pending_actions_read_own on public.assistant_pending_actions;
create policy assistant_pending_actions_read_own on public.assistant_pending_actions for select to authenticated using (user_id=auth.uid() and public.has_feature('ai.use'));
drop policy if exists assistant_memories_own on public.assistant_memories;
create policy assistant_memories_own on public.assistant_memories for all to authenticated using (user_id=auth.uid() and public.has_feature('ai.use')) with check (user_id=auth.uid() and public.has_feature('ai.use'));

drop policy if exists assistant_knowledge_own on public.assistant_knowledge;
drop policy if exists assistant_knowledge_select_shared on public.assistant_knowledge;
drop policy if exists assistant_knowledge_submit on public.assistant_knowledge;
drop policy if exists assistant_knowledge_admin on public.assistant_knowledge;
create policy assistant_knowledge_select_shared on public.assistant_knowledge for select to authenticated using (
  public.is_current_user_approved() and (public.is_current_user_admin() or user_id=auth.uid() or (scope='global' and status='published'))
);
create policy assistant_knowledge_submit on public.assistant_knowledge for insert to authenticated with check (
  public.has_feature('knowledge.submit') and user_id=auth.uid() and status='draft' and scope in ('personal', 'team')
);
create policy assistant_knowledge_submit_update on public.assistant_knowledge for update to authenticated using (
  public.has_feature('knowledge.submit') and user_id=auth.uid() and status='draft'
) with check (
  public.has_feature('knowledge.submit') and user_id=auth.uid() and status='draft' and scope in ('personal', 'team')
);
create policy assistant_knowledge_admin on public.assistant_knowledge for all to authenticated using (public.is_current_user_admin()) with check (public.is_current_user_admin());

create index if not exists profiles_status_idx on public.profiles (account_status, created_at desc);
create index if not exists user_feature_permissions_user_idx on public.user_feature_permissions (user_id, enabled);
create index if not exists admin_audit_logs_target_idx on public.admin_audit_logs (target_user_id, created_at desc);
create index if not exists assistant_knowledge_scope_status_idx on public.assistant_knowledge (scope, status, updated_at desc);
