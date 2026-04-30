create table orders (
    id uuid primary key,
    legacy_id bigint unique,
    order_number varchar(100) unique,
    order_key varchar(100) unique,
    customer_id uuid references customers (id),
    status varchar(50) not null,
    payment_status varchar(50) not null,
    fulfillment_status varchar(50),
    customer_email varchar(255),
    customer_phone varchar(50),
    customer_note text,
    currency varchar(10) not null default 'VND',
    subtotal_amount numeric(19,2) not null default 0,
    discount_amount numeric(19,2) not null default 0,
    shipping_amount numeric(19,2) not null default 0,
    fee_amount numeric(19,2) not null default 0,
    tax_amount numeric(19,2) not null default 0,
    total_amount numeric(19,2) not null default 0,
    paid_amount numeric(19,2) not null default 0,
    source varchar(100),
    ip_address varchar(45),
    user_agent text,
    placed_at timestamp with time zone,
    paid_at timestamp with time zone,
    completed_at timestamp with time zone,
    cancelled_at timestamp with time zone,
    created_at timestamp with time zone not null,
    updated_at timestamp with time zone not null
);

create index idx_orders_legacy_id on orders (legacy_id);
create index idx_orders_order_number on orders (order_number);
create index idx_orders_order_key on orders (order_key);
create index idx_orders_customer_id on orders (customer_id);
create index idx_orders_status on orders (status);
create index idx_orders_payment_status on orders (payment_status);
create index idx_orders_customer_email on orders (customer_email);
create index idx_orders_customer_phone on orders (customer_phone);
create index idx_orders_placed_at on orders (placed_at);
create index idx_orders_created_at on orders (created_at);

create table order_line_items (
    id uuid primary key,
    order_id uuid not null references orders (id) on delete cascade,
    legacy_item_id bigint,
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
    line_tax numeric(19,2) not null default 0,
    line_total numeric(19,2) not null default 0,
    metadata text,
    created_at timestamp with time zone not null,
    updated_at timestamp with time zone not null,
    constraint ck_order_line_items_quantity check (quantity > 0)
);

create index idx_order_line_items_order_id on order_line_items (order_id);
create index idx_order_line_items_legacy_item_id on order_line_items (legacy_item_id);
create index idx_order_line_items_product_id on order_line_items (product_id);
create index idx_order_line_items_product_variant_id on order_line_items (product_variant_id);
create index idx_order_line_items_sku on order_line_items (sku);

create table order_shipping_items (
    id uuid primary key,
    order_id uuid not null references orders (id) on delete cascade,
    legacy_item_id bigint,
    shipping_method_id uuid references shipping_methods (id),
    method_code varchar(100),
    method_title text not null,
    amount numeric(19,2) not null default 0,
    metadata text,
    created_at timestamp with time zone not null,
    updated_at timestamp with time zone not null
);

create index idx_order_shipping_items_order_id on order_shipping_items (order_id);
create index idx_order_shipping_items_shipping_method_id on order_shipping_items (shipping_method_id);
create index idx_order_shipping_items_legacy_item_id on order_shipping_items (legacy_item_id);
create index idx_order_shipping_items_method_code on order_shipping_items (method_code);

create table order_fee_items (
    id uuid primary key,
    order_id uuid not null references orders (id) on delete cascade,
    legacy_item_id bigint,
    name text not null,
    amount numeric(19,2) not null default 0,
    tax_amount numeric(19,2) not null default 0,
    metadata text,
    created_at timestamp with time zone not null,
    updated_at timestamp with time zone not null
);

create index idx_order_fee_items_order_id on order_fee_items (order_id);
create index idx_order_fee_items_legacy_item_id on order_fee_items (legacy_item_id);

create table order_applied_coupons (
    id uuid primary key,
    order_id uuid not null references orders (id) on delete cascade,
    coupon_id uuid references coupons (id),
    code varchar(100) not null,
    discount_amount numeric(19,2) not null default 0,
    metadata text,
    created_at timestamp with time zone not null
);

create index idx_order_applied_coupons_order_id on order_applied_coupons (order_id);
create index idx_order_applied_coupons_coupon_id on order_applied_coupons (coupon_id);
create index idx_order_applied_coupons_code on order_applied_coupons (code);

create table order_addresses (
    id uuid primary key,
    order_id uuid not null references orders (id) on delete cascade,
    type varchar(50) not null,
    full_name varchar(255),
    company varchar(255),
    email varchar(255),
    phone varchar(50),
    country varchar(10) default 'VN',
    province varchar(127),
    district varchar(127),
    ward varchar(127),
    address_line1 text,
    address_line2 text,
    postcode varchar(20),
    created_at timestamp with time zone not null,
    updated_at timestamp with time zone not null
);

create index idx_order_addresses_order_id on order_addresses (order_id);
create index idx_order_addresses_type on order_addresses (type);
create index idx_order_addresses_phone on order_addresses (phone);
create index idx_order_addresses_email on order_addresses (email);

create table order_notes (
    id uuid primary key,
    order_id uuid not null references orders (id) on delete cascade,
    author_type varchar(50) not null,
    author_id uuid,
    note_type varchar(50) not null,
    content text not null,
    is_customer_visible boolean not null default false,
    created_at timestamp with time zone not null
);

create index idx_order_notes_order_id on order_notes (order_id);
create index idx_order_notes_author_type on order_notes (author_type);
create index idx_order_notes_note_type on order_notes (note_type);
create index idx_order_notes_is_customer_visible on order_notes (is_customer_visible);
create index idx_order_notes_created_at on order_notes (created_at);
