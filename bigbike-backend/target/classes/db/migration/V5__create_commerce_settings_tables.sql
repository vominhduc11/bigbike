create table coupons (
    id uuid primary key,
    legacy_id bigint unique,
    code varchar(100) not null unique,
    name varchar(255),
    description text,
    discount_type varchar(50) not null,
    amount numeric(19,2) not null default 0,
    minimum_amount numeric(19,2),
    maximum_amount numeric(19,2),
    usage_limit integer,
    usage_count integer not null default 0,
    starts_at timestamp with time zone,
    expires_at timestamp with time zone,
    status varchar(50) not null,
    metadata text,
    created_at timestamp with time zone not null,
    updated_at timestamp with time zone not null
);

create index idx_coupons_code on coupons (code);
create index idx_coupons_status on coupons (status);
create index idx_coupons_legacy_id on coupons (legacy_id);
create index idx_coupons_expires_at on coupons (expires_at);

create table shipping_zones (
    id uuid primary key,
    legacy_id bigint unique,
    name varchar(255) not null,
    region_code varchar(50),
    sort_order integer not null default 0,
    enabled boolean not null default true,
    created_at timestamp with time zone not null,
    updated_at timestamp with time zone not null
);

create index idx_shipping_zones_legacy_id on shipping_zones (legacy_id);
create index idx_shipping_zones_enabled on shipping_zones (enabled);

create table shipping_methods (
    id uuid primary key,
    zone_id uuid not null references shipping_zones (id) on delete cascade,
    legacy_id bigint,
    method_code varchar(100) not null,
    title varchar(255) not null,
    description text,
    cost numeric(19,2),
    min_order_amount numeric(19,2),
    enabled boolean not null default true,
    settings text,
    sort_order integer not null default 0,
    created_at timestamp with time zone not null,
    updated_at timestamp with time zone not null
);

create index idx_shipping_methods_zone_id on shipping_methods (zone_id);
create index idx_shipping_methods_method_code on shipping_methods (method_code);
create index idx_shipping_methods_enabled on shipping_methods (enabled);
create index idx_shipping_methods_legacy_id on shipping_methods (legacy_id);

create table site_settings (
    id uuid primary key,
    setting_key varchar(255) not null unique,
    setting_value text not null,
    setting_group varchar(100) not null,
    is_public boolean not null default false,
    description text,
    created_at timestamp with time zone not null,
    updated_at timestamp with time zone not null
);

create index idx_site_settings_setting_key on site_settings (setting_key);
create index idx_site_settings_setting_group on site_settings (setting_group);
create index idx_site_settings_is_public on site_settings (is_public);

create table audit_logs (
    id uuid primary key,
    actor_type varchar(50) not null,
    actor_id uuid,
    action varchar(100) not null,
    resource_type varchar(100) not null,
    resource_id uuid,
    before_data text,
    after_data text,
    ip_address varchar(45),
    user_agent text,
    created_at timestamp with time zone not null
);

create index idx_audit_logs_actor on audit_logs (actor_type, actor_id);
create index idx_audit_logs_resource on audit_logs (resource_type, resource_id);
create index idx_audit_logs_action on audit_logs (action);
create index idx_audit_logs_created_at on audit_logs (created_at);
