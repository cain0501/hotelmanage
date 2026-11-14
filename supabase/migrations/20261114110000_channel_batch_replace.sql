-- Allow the AI confirmation flow to replace order channels in one scoped batch.
-- __ANY__ is only valid for channel changes and means "any current channel".

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
    raise exception using errcode = '42501', message = 'Not authenticated';
  end if;

  select * into action_row
  from public.assistant_pending_actions
  where id = p_action_id and user_id = auth.uid()
  for update;

  if not found then
    raise exception using errcode = '42501', message = 'Pending action not found';
  end if;

  if action_row.status = 'confirmed' then
    return jsonb_build_object('status', 'already_confirmed', 'updated_count', 0);
  end if;
  if action_row.status <> 'pending' then
    raise exception 'Pending action is not executable: %', action_row.status;
  end if;
  if action_row.expires_at is not null and action_row.expires_at <= now() then
    update public.assistant_pending_actions set status = 'expired' where id = action_row.id;
    raise exception 'Pending action has expired';
  end if;
  if action_row.action_type <> 'batch_replace' then
    raise exception 'Unsupported action type: %', action_row.action_type;
  end if;

  target_field := action_row.preview ->> 'target';
  from_value := trim(coalesce(action_row.preview ->> 'from_value', ''));
  to_value := trim(coalesce(action_row.preview ->> 'to_value', ''));

  if target_field not in ('channel', 'supplier', 'product', 'location', 'booker', 'customer', 'payment_platform', 'confirmation', 'status') then
    raise exception 'Unsupported target field: %', target_field;
  end if;
  if to_value = '' or from_value = '' or (from_value = '__ANY__' and target_field <> 'channel') then
    raise exception 'Pending action is missing a valid source or target value';
  end if;

  select coalesce(array_agg(value), '{}'::text[])
    into affected_ids
  from jsonb_array_elements_text(coalesce(action_row.affected_record_ids, '[]'::jsonb));
  expected_count := coalesce(cardinality(affected_ids), 0);
  if expected_count = 0 then
    raise exception 'Pending action has no affected orders';
  end if;

  select count(*)::integer into matched_count
  from public.orders o
  where o.user_id = auth.uid()
    and o.id = any(affected_ids)
    and (
      (from_value = '__ANY__' and target_field = 'channel')
      or lower(trim(coalesce(case target_field
        when 'channel' then o.channel
        when 'supplier' then o.supplier
        when 'product' then o.product
        when 'location' then o.location
        when 'booker' then o.booker
        when 'customer' then o.customer
        when 'payment_platform' then o.payment_platform
        when 'confirmation' then o.confirmation
        when 'status' then o.status
      end, ''))) = lower(from_value)
    );

  if matched_count <> expected_count then
    raise exception 'Orders changed before confirmation; generate a new preview';
  end if;

  if target_field = 'channel' then
    update public.orders set channel = to_value where user_id = auth.uid() and id = any(affected_ids);
  elsif target_field = 'supplier' then
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

revoke all on function public.confirm_assistant_batch_replace(uuid) from public;
grant execute on function public.confirm_assistant_batch_replace(uuid) to authenticated;
