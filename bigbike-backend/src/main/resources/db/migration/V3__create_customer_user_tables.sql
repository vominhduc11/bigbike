create table customers (
    id uuid primary key,
    legacy_id bigint unique,
    email varchar(255),
    phone varchar(50),
    password_hash varchar(255),
    display_name varchar(255),
    first_name varchar(127),
    last_name varchar(127),
    status varchar(50) not null,
    is_synthetic boolean not null default false,
    email_verified_at timestamp with time zone,
    phone_verified_at timestamp with time zone,
    last_login_at timestamp with time zone,
    created_at timestamp with time zone not null,
    updated_at timestamp with time zone not null
);

create index idx_customers_legacy_id on customers (legacy_id);
create index idx_customers_email on customers (email);
create index idx_customers_phone on customers (phone);
create index idx_customers_status on customers (status);
create index idx_customers_is_synthetic on customers (is_synthetic);

create table customer_addresses (
    id uuid primary key,
    customer_id uuid not null references customers (id) on delete cascade,
    type varchar(50) not null,
    full_name varchar(255),
    phone varchar(50),
    country varchar(10) not null default 'VN',
    province varchar(127),
    district varchar(127),
    ward varchar(127),
    address_line1 text,
    address_line2 text,
    is_default boolean not null default false,
    legacy_meta_key varchar(255),
    created_at timestamp with time zone not null,
    updated_at timestamp with time zone not null
);

create index idx_customer_addresses_customer_id on customer_addresses (customer_id);
create index idx_customer_addresses_type on customer_addresses (type);
create index idx_customer_addresses_is_default on customer_addresses (is_default);
