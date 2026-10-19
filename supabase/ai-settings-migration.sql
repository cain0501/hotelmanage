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

alter table public.ai_settings enable row level security;
drop policy if exists "ai_settings_select_own" on public.ai_settings;
drop policy if exists "ai_settings_insert_own" on public.ai_settings;
drop policy if exists "ai_settings_update_own" on public.ai_settings;
drop policy if exists "ai_settings_delete_own" on public.ai_settings;
create policy "ai_settings_select_own" on public.ai_settings for select to authenticated using (user_id = auth.uid());
create policy "ai_settings_insert_own" on public.ai_settings for insert to authenticated with check (user_id = auth.uid());
create policy "ai_settings_update_own" on public.ai_settings for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "ai_settings_delete_own" on public.ai_settings for delete to authenticated using (user_id = auth.uid());

create or replace function public.set_updated_at()
returns trigger language plpgsql security invoker as $$
begin new.updated_at = now(); return new; end;
$$;
drop trigger if exists ai_settings_set_updated_at on public.ai_settings;
create trigger ai_settings_set_updated_at before update on public.ai_settings for each row execute function public.set_updated_at();
