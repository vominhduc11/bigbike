create table unmatched_payments (
    id uuid primary key,
    sepay_transaction_id varchar(255),
    transaction_code varchar(512) not null,
    amount numeric(19,2) not null,
    sender_info text,
    content text,
    order_number_hint varchar(128),
    received_at timestamp with time zone not null,
    reason varchar(64) not null,
    status varchar(32) not null default 'PENDING',
    resolution text,
    resolved_by varchar(255),
    resolved_at timestamp with time zone,
    matched_order_id uuid references orders (id),
    raw_payload text,
    created_at timestamp with time zone not null default now()
);

create index idx_unmatched_payments_status on unmatched_payments (status);
create index idx_unmatched_payments_reason on unmatched_payments (reason);
create index idx_unmatched_payments_received_at on unmatched_payments (received_at desc);
create unique index uq_unmatched_payments_sepay_id
    on unmatched_payments (sepay_transaction_id)
    where sepay_transaction_id is not null;
