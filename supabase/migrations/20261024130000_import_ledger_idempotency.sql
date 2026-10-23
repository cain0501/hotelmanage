-- 导入流水幂等约束。只约束新增的 import_key，不影响历史手工流水或已有导入流水。
alter table public.ledger_transactions
  add column if not exists import_key text;

create unique index if not exists ledger_transactions_import_key_unique_idx
  on public.ledger_transactions (user_id, import_key)
  where source = 'import' and import_key is not null and import_key <> '';
