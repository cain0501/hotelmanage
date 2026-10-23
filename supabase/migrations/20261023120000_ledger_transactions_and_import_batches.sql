-- 奢隐旅业助手：资金流水与 Excel 导入批次
-- 幂等执行；订单金额字段继续保留，作为迁移期间的汇总兼容字段。

create table if not exists public.ledger_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  order_id text,
  kind text not null check (kind in ('customer_receipt', 'supplier_payment', 'commission_receipt', 'refund', 'direct_cost')),
  amount numeric not null,
  occurred_at date not null default current_date,
  note text not null default '',
  source text not null default 'manual',
  created_at timestamptz not null default now()
);

create index if not exists ledger_transactions_user_date_idx
  on public.ledger_transactions (user_id, occurred_at desc);
create index if not exists ledger_transactions_user_order_idx
  on public.ledger_transactions (user_id, order_id);
create unique index if not exists ledger_transactions_backfill_unique_idx
  on public.ledger_transactions (user_id, order_id, kind, source)
  where source = 'backfill';

alter table public.orders add column if not exists import_batch_id uuid;
alter table public.orders add column if not exists source_row integer;

create table if not exists public.import_batches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  file_name text not null default '',
  sheet_name text not null default '',
  row_count integer not null default 0,
  status text not null default 'active' check (status in ('active', 'reverted')),
  created_at timestamptz not null default now(),
  reverted_at timestamptz
);

create index if not exists import_batches_user_created_idx
  on public.import_batches (user_id, created_at desc);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'orders_import_batch_id_fkey'
  ) then
    alter table public.orders
      add constraint orders_import_batch_id_fkey
      foreign key (import_batch_id) references public.import_batches(id) on delete set null;
  end if;
end $$;

alter table public.ledger_transactions enable row level security;
drop policy if exists ledger_transactions_select_own on public.ledger_transactions;
drop policy if exists ledger_transactions_insert_own on public.ledger_transactions;
drop policy if exists ledger_transactions_update_own on public.ledger_transactions;
drop policy if exists ledger_transactions_delete_own on public.ledger_transactions;
create policy ledger_transactions_select_own on public.ledger_transactions
  for select to authenticated
  using (user_id = auth.uid() and (public.has_feature('ledger.view') or public.has_feature('dashboard.view') or public.has_feature('ai.use')));
create policy ledger_transactions_insert_own on public.ledger_transactions
  for insert to authenticated
  with check (user_id = auth.uid() and (public.has_feature('orders.edit') or public.has_feature('ledger.view') or public.has_feature('ai.use')));
create policy ledger_transactions_update_own on public.ledger_transactions
  for update to authenticated
  using (user_id = auth.uid() and (public.has_feature('orders.edit') or public.has_feature('ledger.view') or public.has_feature('ai.use')))
  with check (user_id = auth.uid() and (public.has_feature('orders.edit') or public.has_feature('ledger.view') or public.has_feature('ai.use')));
create policy ledger_transactions_delete_own on public.ledger_transactions
  for delete to authenticated
  using (user_id = auth.uid() and (public.has_feature('orders.edit') or public.has_feature('ledger.view') or public.has_feature('ai.use')));

alter table public.import_batches enable row level security;
drop policy if exists import_batches_select_own on public.import_batches;
drop policy if exists import_batches_insert_own on public.import_batches;
drop policy if exists import_batches_update_own on public.import_batches;
create policy import_batches_select_own on public.import_batches
  for select to authenticated
  using (user_id = auth.uid() and public.has_feature('orders.import'));
create policy import_batches_insert_own on public.import_batches
  for insert to authenticated
  with check (user_id = auth.uid() and public.has_feature('orders.import'));
create policy import_batches_update_own on public.import_batches
  for update to authenticated
  using (user_id = auth.uid() and public.has_feature('orders.import'))
  with check (user_id = auth.uid() and public.has_feature('orders.import'));

-- 只根据现有标量汇总生成一条可追溯的历史快照；重复执行不会生成重复回填流水。
insert into public.ledger_transactions (user_id, order_id, kind, amount, occurred_at, note, source)
select o.user_id, o.id, 'customer_receipt', o.received, coalesce(o.order_date, o.service_date, current_date), '历史订单收款汇总', 'backfill'
from public.orders o
where o.received > 0
on conflict (user_id, order_id, kind, source) where source = 'backfill' do nothing;

insert into public.ledger_transactions (user_id, order_id, kind, amount, occurred_at, note, source)
select o.user_id, o.id, 'supplier_payment', -o.supplier_paid, coalesce(o.order_date, o.service_date, current_date), '历史供应商付款汇总', 'backfill'
from public.orders o
where o.supplier_paid > 0
on conflict (user_id, order_id, kind, source) where source = 'backfill' do nothing;

insert into public.ledger_transactions (user_id, order_id, kind, amount, occurred_at, note, source)
select o.user_id, o.id, 'commission_receipt', o.commission_received, coalesce(o.commission_received_date, o.order_date, o.service_date, current_date), '历史平台返佣汇总', 'backfill'
from public.orders o
where o.commission_received > 0
on conflict (user_id, order_id, kind, source) where source = 'backfill' do nothing;

insert into public.ledger_transactions (user_id, order_id, kind, amount, occurred_at, note, source)
select o.user_id, o.id, 'direct_cost', -o.direct_cost, coalesce(o.order_date, o.service_date, current_date), '历史返佣订单直接费用汇总', 'backfill'
from public.orders o
where o.direct_cost > 0
on conflict (user_id, order_id, kind, source) where source = 'backfill' do nothing;
