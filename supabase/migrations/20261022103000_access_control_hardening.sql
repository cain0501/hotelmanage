-- Explicit hardening pass for the multi-user access-control migration.
-- This migration is idempotent and repairs security state independently of
-- comment encoding or the order in which the older migrations were authored.

alter table public.assistant_conversations enable row level security;
alter table public.assistant_messages enable row level security;
alter table public.assistant_context enable row level security;
alter table public.assistant_runs enable row level security;
alter table public.assistant_tool_calls enable row level security;
alter table public.assistant_pending_actions enable row level security;
alter table public.assistant_memories enable row level security;
alter table public.assistant_knowledge enable row level security;

drop policy if exists assistant_knowledge_select_shared on public.assistant_knowledge;
create policy assistant_knowledge_select_shared on public.assistant_knowledge
for select to authenticated
using (
  public.has_feature('knowledge.read')
  and (
    public.is_current_user_admin()
    or user_id = auth.uid()
    or (scope = 'global' and status = 'published')
  )
);

-- Keep the configured administrator recoverable if a profile was edited by
-- mistake. Existing ordinary-user approval decisions are not touched.
update public.profiles
set role = 'admin',
    account_status = 'approved',
    email = lower(coalesce(email, 'zzljb520@hotmail.com')),
    updated_at = now()
where lower(email) = 'zzljb520@hotmail.com';
