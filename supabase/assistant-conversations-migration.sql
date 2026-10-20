-- AI conversation retention: archive conversations without touching orders,
-- other_income, professional knowledge, or operation records.
alter table if exists public.assistant_conversations
  add column if not exists status text not null default 'active';

alter table if exists public.assistant_conversations
  add column if not exists archived_at timestamptz;

do $$
begin
  alter table public.assistant_conversations
    add constraint assistant_conversations_status_check
    check (status in ('active', 'archived'));
exception
  when duplicate_object then null;
end;
$$;

create index if not exists assistant_conversations_user_status_updated_idx
  on public.assistant_conversations (user_id, status, updated_at desc);

