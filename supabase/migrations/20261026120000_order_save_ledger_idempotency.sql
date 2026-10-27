-- 订单保存重试幂等约束。只约束带 transaction_key 的新流水，不影响历史流水。
alter table public.ledger_transactions
  add column if not exists transaction_key text;

create unique index if not exists ledger_transactions_transaction_key_unique_idx
  on public.ledger_transactions (user_id, transaction_key)
  where transaction_key is not null and transaction_key <> '';
