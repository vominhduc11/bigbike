create table payments (
    id uuid primary key,
    order_id uuid not null references orders (id) on delete cascade,
    payment_method varchar(100) not null,
    provider varchar(100),
    status varchar(50) not null,
    amount numeric(19,2) not null default 0,
    currency varchar(10) not null default 'VND',
    transaction_id varchar(255),
    provider_reference varchar(255),
    paid_at timestamp with time zone,
    failed_at timestamp with time zone,
    metadata text,
    created_at timestamp with time zone not null,
    updated_at timestamp with time zone not null
);

create index idx_payments_order_id on payments (order_id);
create index idx_payments_payment_method on payments (payment_method);
create index idx_payments_provider on payments (provider);
create index idx_payments_status on payments (status);
create index idx_payments_transaction_id on payments (transaction_id);
create index idx_payments_provider_reference on payments (provider_reference);

create table payment_events (
    id uuid primary key,
    payment_id uuid references payments (id) on delete cascade,
    order_id uuid references orders (id) on delete cascade,
    provider varchar(100),
    event_type varchar(100) not null,
    event_id varchar(255),
    payload text,
    received_at timestamp with time zone not null,
    processed_at timestamp with time zone,
    status varchar(50) not null,
    error_message text
);

create index idx_payment_events_payment_id on payment_events (payment_id);
create index idx_payment_events_order_id on payment_events (order_id);
create index idx_payment_events_provider on payment_events (provider);
create index idx_payment_events_event_type on payment_events (event_type);
create index idx_payment_events_event_id on payment_events (event_id);
create index idx_payment_events_status on payment_events (status);
create index idx_payment_events_received_at on payment_events (received_at);
