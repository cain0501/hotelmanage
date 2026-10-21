-- 将原“付款状态”拆成客户收款和供应商 / 平台付款两个方向。
alter table if exists public.orders add column if not exists customer_payment_status text default 'paid';
alter table if exists public.orders add column if not exists supplier_paid numeric default 0;
alter table if exists public.orders add column if not exists supplier_payment_status text default 'unknown';

update public.orders
set customer_payment_status = nullif(payment_status, '')
where payment_status is not null
  and payment_status <> ''
  and (customer_payment_status is null or customer_payment_status = 'paid');

update public.orders
set supplier_paid = coalesce(supplier_paid, 0),
    supplier_payment_status = coalesce(nullif(supplier_payment_status, ''), 'unknown')
where supplier_paid is null or supplier_payment_status is null or supplier_payment_status = '';

alter table public.orders alter column customer_payment_status set default 'paid';
alter table public.orders alter column supplier_paid set default 0;
alter table public.orders alter column supplier_payment_status set default 'unknown';

create index if not exists orders_user_customer_payment_status_idx
  on public.orders (user_id, customer_payment_status);
create index if not exists orders_user_supplier_payment_status_idx
  on public.orders (user_id, supplier_payment_status);
