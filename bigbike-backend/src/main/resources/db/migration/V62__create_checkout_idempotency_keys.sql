create table checkout_idempotency_keys (
    id uuid primary key,
    flow_type varchar(50) not null,
    scope_key varchar(255) not null,
    customer_id uuid references customers (id),
    guest_session_id varchar(255),
    idempotency_key varchar(255) not null,
    request_hash varchar(64) not null,
    order_id uuid references orders (id) on delete set null,
    created_at timestamp with time zone not null,
    updated_at timestamp with time zone not null,
    constraint uk_checkout_idempotency_flow_scope_key
        unique (flow_type, scope_key, idempotency_key)
);

create index idx_checkout_idempotency_customer_id on checkout_idempotency_keys (customer_id);
create index idx_checkout_idempotency_guest_session_id on checkout_idempotency_keys (guest_session_id);
create index idx_checkout_idempotency_order_id on checkout_idempotency_keys (order_id);
