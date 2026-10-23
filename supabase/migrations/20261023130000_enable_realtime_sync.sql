-- 确保前端订阅的业务表加入 Supabase Realtime publication。
-- 幂等执行，兼容已有项目中部分表已经加入 publication 的情况。
do $$
declare
  table_name text;
begin
  if not exists (
    select 1 from pg_publication where pubname = 'supabase_realtime'
  ) then
    return;
  end if;

  foreach table_name in array array['orders', 'other_income', 'ledger_transactions'] loop
    if to_regclass(format('public.%s', table_name)) is not null
      and not exists (
        select 1
        from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = table_name
      ) then
      execute format('alter publication supabase_realtime add table public.%I', table_name);
    end if;
  end loop;
end $$;
