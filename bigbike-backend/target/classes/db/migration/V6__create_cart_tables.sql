create table carts (
    id uuid primary key,
    customer_id uuid references customers (id),
    session_id varchar(255),
    status varchar(50) not null,
    currency varchar(10) not null default 'VND',
    subtotal_amount numeric(19,2) not null default 0,
    discount_amount numeric(19,2) not null default 0,
    shipping_amount numeric(19,2) not null default 0,
    fee_amount numeric(19,2) not null default 0,
    total_amount numeric(19,2) not null default 0,
    expires_at timestamp with time zone,
    created_at timestamp with time zone not null,
    updated_at timestamp with time zone not null
);

create index idx_carts_customer_id on carts (customer_id);
create index idx_carts_session_id on carts (session_id);
create index idx_carts_status on carts (status);
create index idx_carts_expires_at on carts (expires_at);

create table cart_items (
    id uuid primary key,
    cart_id uuid not null references carts (id) on delete cascade,
    product_id uuid,
    product_variant_id uuid,
    sku varchar(255),
    product_name text not null,
    variant_name text,
    quantity integer not null,
    unit_price numeric(19,2) not null default 0,
    regular_price numeric(19,2),
    sale_price numeric(19,2),
    line_subtotal numeric(19,2) not null default 0,
    line_discount numeric(19,2) not null default 0,
    line_total numeric(19,2) not null default 0,
    metadata text,
    created_at timestamp with time zone not null,
    updated_at timestamp with time zone not null,
    constraint ck_cart_items_quantity check (quantity > 0)
);

create index idx_cart_items_cart_id on cart_items (cart_id);
create index idx_cart_items_product_id on cart_items (product_id);
create index idx_cart_items_product_variant_id on cart_items (product_variant_id);
create index idx_cart_items_sku on cart_items (sku);
