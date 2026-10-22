-- Backfill profile records for users that existed before the access-control migration.
-- Existing profile rows are intentionally preserved so an administrator's prior
-- approval or suspension decision is not overwritten.
insert into public.profiles (user_id, email, role, account_status)
select
  u.id,
  lower(coalesce(u.email, '')),
  case when lower(coalesce(u.email, '')) = 'zzljb520@hotmail.com' then 'admin' else 'user' end,
  case when lower(coalesce(u.email, '')) = 'zzljb520@hotmail.com' then 'approved' else 'pending' end
from auth.users u
on conflict (user_id) do nothing;

-- Keep the configured administrator usable even if the account was created by
-- an earlier migration or the initial seed was skipped.
update public.profiles
set role = 'admin',
    account_status = 'approved',
    email = lower(coalesce(email, 'zzljb520@hotmail.com')),
    updated_at = now()
where lower(email) = 'zzljb520@hotmail.com';
