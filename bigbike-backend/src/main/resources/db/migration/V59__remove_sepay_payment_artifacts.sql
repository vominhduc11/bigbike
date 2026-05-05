drop table if exists unmatched_payments cascade;

delete from site_settings
where setting_key like 'payment_sepay.%';

alter table orders
    drop column if exists pending_payment_expires_at;

drop index if exists idx_orders_onhold_sepay_placed;
alter table payments
    drop constraint if exists uq_payments_transaction_id_sepay;
drop index if exists uq_payments_transaction_id_sepay;
