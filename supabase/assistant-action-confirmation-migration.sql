-- Server-side confirmation and idempotent execution for AI-generated batch changes.
-- Run this migration in Supabase SQL Editor before deploying the updated function.

create or replace function public.confirm_assistant_batch_replace(p_action_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  action_row public.assistant_pending_actions%rowtype;
  target_field text;
  from_value text;
  to_value text;
  affected_ids text[];
  expected_count integer;
  matched_count integer;
  updated_count integer;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = '未登录或登录已过期';
  end if;

  select * into action_row
  from public.assistant_pending_actions
  where id = p_action_id and user_id = auth.uid()
  for update;

  if not found then
    raise exception using errcode = '42501', message = '待确认任务不存在或无权访问';
  end if;

  if action_row.status = 'confirmed' then
    return jsonb_build_object('status', 'already_confirmed', 'updated_count', 0);
  end if;

  if action_row.status <> 'pending' then
    raise exception '待确认任务当前状态为 %，不能执行', action_row.status;
  end if;

  if action_row.expires_at is not null and action_row.expires_at <= now() then
    update public.assistant_pending_actions
      set status = 'expired'
      where id = action_row.id;
    raise exception using errcode = 'P0001', message = '待确认任务已过期，请重新生成预览';
  end if;

  if action_row.action_type <> 'batch_replace' then
    raise exception '暂不支持执行任务类型 %', action_row.action_type;
  end if;

  target_field := action_row.preview ->> 'target';
  from_value := trim(coalesce(action_row.preview ->> 'from_value', ''));
  to_value := coalesce(action_row.preview ->> 'to_value', '');

  if target_field not in ('supplier', 'product', 'location', 'booker', 'customer', 'payment_platform', 'confirmation', 'status') then
    raise exception '不允许修改字段 %', target_field;
  end if;
  if from_value = '' or to_value = '' then
    raise exception '待确认任务缺少原值或新值';
  end if;

  select coalesce(array_agg(value), '{}'::text[])
    into affected_ids
  from jsonb_array_elements_text(coalesce(action_row.affected_record_ids, '[]'::jsonb));
  expected_count := coalesce(cardinality(affected_ids), 0);
  if expected_count = 0 then
    raise exception '待确认任务没有可修改的订单';
  end if;

  select count(*)::integer into matched_count
  from public.orders o
  where o.user_id = auth.uid()
    and o.id = any(affected_ids)
    and lower(trim(coalesce(case target_field
      when 'supplier' then o.supplier
      when 'product' then o.product
      when 'location' then o.location
      when 'booker' then o.booker
      when 'customer' then o.customer
      when 'payment_platform' then o.payment_platform
      when 'confirmation' then o.confirmation
      when 'status' then o.status
    end, ''))) = lower(from_value);

  if matched_count <> expected_count then
    raise exception using errcode = 'P0001', message = '订单在确认前已发生变化，请重新生成预览';
  end if;

  if target_field = 'supplier' then
    update public.orders set supplier = to_value where user_id = auth.uid() and id = any(affected_ids);
  elsif target_field = 'product' then
    update public.orders set product = to_value where user_id = auth.uid() and id = any(affected_ids);
  elsif target_field = 'location' then
    update public.orders set location = to_value where user_id = auth.uid() and id = any(affected_ids);
  elsif target_field = 'booker' then
    update public.orders set booker = to_value where user_id = auth.uid() and id = any(affected_ids);
  elsif target_field = 'customer' then
    update public.orders set customer = to_value where user_id = auth.uid() and id = any(affected_ids);
  elsif target_field = 'payment_platform' then
    update public.orders set payment_platform = to_value where user_id = auth.uid() and id = any(affected_ids);
  elsif target_field = 'confirmation' then
    update public.orders set confirmation = to_value where user_id = auth.uid() and id = any(affected_ids);
  elsif target_field = 'status' then
    update public.orders set status = to_value where user_id = auth.uid() and id = any(affected_ids);
  end if;
  get diagnostics updated_count = row_count;

  update public.assistant_pending_actions
    set status = 'confirmed', confirmed_by = auth.uid(), confirmed_at = now()
    where id = action_row.id;

  if action_row.run_id is not null then
    update public.assistant_runs
      set status = 'completed', current_step = 'confirmed', completed_at = now()
      where id = action_row.run_id and user_id = auth.uid();
  end if;

  return jsonb_build_object('status', 'confirmed', 'updated_count', updated_count);
end;
$$;

create or replace function public.reject_assistant_pending_action(p_action_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  action_row public.assistant_pending_actions%rowtype;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = '未登录或登录已过期';
  end if;

  select * into action_row
  from public.assistant_pending_actions
  where id = p_action_id and user_id = auth.uid()
  for update;

  if not found then
    raise exception using errcode = '42501', message = '待确认任务不存在或无权访问';
  end if;
  if action_row.status = 'rejected' then
    return jsonb_build_object('status', 'already_rejected');
  end if;
  if action_row.status <> 'pending' then
    raise exception '待确认任务当前状态为 %，不能取消', action_row.status;
  end if;

  update public.assistant_pending_actions
    set status = 'rejected'
    where id = action_row.id;
  if action_row.run_id is not null then
    update public.assistant_runs
      set status = 'cancelled', current_step = 'rejected', completed_at = now()
      where id = action_row.run_id and user_id = auth.uid();
  end if;
  return jsonb_build_object('status', 'rejected');
end;
$$;

revoke all on function public.confirm_assistant_batch_replace(uuid) from public;
revoke all on function public.reject_assistant_pending_action(uuid) from public;
grant execute on function public.confirm_assistant_batch_replace(uuid) to authenticated;
grant execute on function public.reject_assistant_pending_action(uuid) to authenticated;

-- Pending actions are created by the Edge Function with the service role.
-- Clients may only read their own actions and execute the guarded RPC above.
drop policy if exists "assistant_pending_actions_own" on public.assistant_pending_actions;
create policy "assistant_pending_actions_read_own"
  on public.assistant_pending_actions for select to authenticated
  using (user_id = auth.uid());
