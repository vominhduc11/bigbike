-- Partial unique index for SePay transaction IDs — prevents double-processing webhooks
create unique index if not exists uq_payments_transaction_id_sepay
    on payments (transaction_id)
    where provider = 'SEPAY' and transaction_id is not null;
