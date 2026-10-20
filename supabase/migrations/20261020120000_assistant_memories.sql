-- AI 记忆：只有用户明确确认后才保存业务规则或个人偏好。
create table if not exists public.assistant_memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  conversation_id uuid references public.assistant_conversations(id) on delete set null,
  kind text not null default 'business_rule' check (kind in ('business_rule', 'preference')),
  title text not null default '',
  content text not null default '',
  source text not null default '用户确认',
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.assistant_memories enable row level security;
drop policy if exists "assistant_memories_own" on public.assistant_memories;
create policy "assistant_memories_own" on public.assistant_memories
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create index if not exists assistant_memories_user_status_idx
  on public.assistant_memories (user_id, status, updated_at desc);

drop trigger if exists assistant_memories_set_updated_at on public.assistant_memories;
create trigger assistant_memories_set_updated_at
  before update on public.assistant_memories
  for each row execute function public.set_updated_at();
