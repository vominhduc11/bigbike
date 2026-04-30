-- V31: Create returns/RMA management tables.

-- ── 1. Returns ────────────────────────────────────────────────────────────────

create table if not exists returns (
    id              uuid primary key default gen_random_uuid(),
    return_number   varchar(32) unique not null,
    order_id        uuid not null references orders(id) on delete restrict,
    customer_id     uuid references customers(id) on delete set null,
    status          varchar(32) not null default 'PENDING',
    -- PENDING → APPROVED / REJECTED
    -- APPROVED → RECEIVED → COMPLETED / REFUNDED
    reason          varchar(64) not null,  -- DEFECTIVE, WRONG_ITEM, NOT_AS_DESCRIBED, CHANGED_MIND, OTHER
    customer_note   text,
    admin_note      text,
    refund_amount   numeric(19,2) not null default 0,
    created_at      timestamp with time zone not null default now(),
    updated_at      timestamp with time zone not null default now()
);

create index if not exists idx_returns_order_id     on returns (order_id);
create index if not exists idx_returns_customer_id  on returns (customer_id);
create index if not exists idx_returns_status       on returns (status);

-- ── 2. Return items ───────────────────────────────────────────────────────────

create table if not exists return_items (
    id                  uuid primary key default gen_random_uuid(),
    return_id           uuid not null references returns(id) on delete cascade,
    order_line_item_id  uuid references order_line_items(id) on delete set null,
    product_name        text not null,
    variant_name        text,
    sku                 varchar(255),
    quantity            integer not null default 1,
    unit_price          numeric(19,2) not null default 0,
    reason              text,
    created_at          timestamp with time zone not null default now()
);

create index if not exists idx_return_items_return_id on return_items (return_id);

-- ── 3. Return history / audit trail ──────────────────────────────────────────

create table if not exists return_history (
    id          uuid primary key default gen_random_uuid(),
    return_id   uuid not null references returns(id) on delete cascade,
    from_status varchar(32),
    to_status   varchar(32) not null,
    note        text,
    admin_id    uuid,
    created_at  timestamp with time zone not null default now()
);

create index if not exists idx_return_history_return_id on return_history (return_id);

-- ── 4. Sequence for return numbers ───────────────────────────────────────────

create sequence if not exists return_number_seq start with 1000 increment by 1;
