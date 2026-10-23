-- 先预览重复导入流水，确认后再执行下面的删除语句。
select user_id, order_id, kind, count(*) as duplicate_count,
       min(created_at) as keep_created_at
from public.ledger_transactions
where source = 'import'
group by user_id, order_id, kind
having count(*) > 1
order by duplicate_count desc;

-- 人工确认预览结果后执行：每组只保留最早写入的一条。
with ranked as (
  select id,
         row_number() over (
           partition by user_id, order_id, kind
           order by created_at asc, id asc
         ) as row_number
  from public.ledger_transactions
  where source = 'import'
)
delete from public.ledger_transactions
where id in (select id from ranked where row_number > 1);
