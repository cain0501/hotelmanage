-- 订单材料自动化切片 1：订单来源字段、取消/付款截止信息和私有附件。
-- 本迁移只扩展数据模型与访问控制，不改变现有订单数据和写入流程。

alter table public.orders add column if not exists channel text;
alter table public.orders add column if not exists platform_order_no text;
alter table public.orders add column if not exists guest_names text not null default '';
alter table public.orders add column if not exists guest_count numeric;
alter table public.orders add column if not exists meal_plan text not null default '';
alter table public.orders add column if not exists check_out_date date;
alter table public.orders add column if not exists upstream_name text not null default '';
alter table public.orders add column if not exists payment_deadline timestamptz;
alter table public.orders add column if not exists cancel_policy text not null default 'unknown';
alter table public.orders add column if not exists free_cancel_until timestamptz;

alter table public.orders drop constraint if exists orders_channel_check;
alter table public.orders add constraint orders_channel_check
  check (channel is null or channel in ('travel_agency', 'booking_desk', 'ota', 'room_card'));
alter table public.orders drop constraint if exists orders_cancel_policy_check;
alter table public.orders add constraint orders_cancel_policy_check
  check (cancel_policy in ('refundable', 'non_refundable', 'unknown'));

create unique index if not exists orders_user_platform_order_no_unique_idx
  on public.orders (user_id, lower(btrim(platform_order_no)))
  where platform_order_no is not null and btrim(platform_order_no) <> '';
create index if not exists orders_user_payment_deadline_idx
  on public.orders (user_id, payment_deadline)
  where payment_deadline is not null;

create table if not exists public.order_attachments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  order_id text not null,
  kind text not null check (kind in ('voucher_pdf', 'detail_screenshot', 'chat', 'other')),
  storage_path text not null,
  original_name text not null default '',
  content_type text not null default 'application/octet-stream',
  size_bytes bigint not null default 0 check (size_bytes >= 0),
  sha256 text not null default '',
  created_at timestamptz not null default now(),
  unique (user_id, storage_path),
  foreign key (user_id, order_id) references public.orders(user_id, id) on delete cascade
);

alter table public.order_attachments enable row level security;
drop policy if exists order_attachments_select_own on public.order_attachments;
drop policy if exists order_attachments_insert_own on public.order_attachments;
drop policy if exists order_attachments_delete_own on public.order_attachments;
create policy order_attachments_select_own on public.order_attachments
  for select to authenticated using (user_id = auth.uid());
create policy order_attachments_insert_own on public.order_attachments
  for insert to authenticated with check (user_id = auth.uid());
create policy order_attachments_delete_own on public.order_attachments
  for delete to authenticated using (user_id = auth.uid());
create index if not exists order_attachments_order_idx
  on public.order_attachments (user_id, order_id, created_at desc);

insert into storage.buckets (id, name, public)
values ('order-attachments', 'order-attachments', false)
on conflict (id) do update set public = false;

drop policy if exists order_attachments_storage_select_own on storage.objects;
drop policy if exists order_attachments_storage_insert_own on storage.objects;
drop policy if exists order_attachments_storage_delete_own on storage.objects;
create policy order_attachments_storage_select_own on storage.objects
  for select to authenticated using (
    bucket_id = 'order-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy order_attachments_storage_insert_own on storage.objects
  for insert to authenticated with check (
    bucket_id = 'order-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy order_attachments_storage_delete_own on storage.objects
  for delete to authenticated using (
    bucket_id = 'order-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
