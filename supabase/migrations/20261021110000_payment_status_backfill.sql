-- 修复拆分字段迁移中历史客户收款状态的回填。
-- 供应商付款状态保持 unknown，不根据旧字段猜测。
update public.orders
set customer_payment_status = nullif(payment_status, '')
where payment_status is not null
  and payment_status <> ''
  and (customer_payment_status is null or customer_payment_status = 'paid');
