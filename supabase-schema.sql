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

create index if not exists orders_user_order_date_idx on public.orders (user_id, order_date desc);
create index if not exists orders_user_service_date_idx on public.orders (user_id, service_date desc);
create index if not exists other_income_user_date_idx on public.other_income (user_id, income_date desc);
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
end;
$$;
