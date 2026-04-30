create table media (
    id uuid primary key,
    legacy_id bigint unique,
    file_path text not null,
    public_url text,
    storage_provider varchar(50) not null,
    bucket varchar(255),
    mime_type varchar(127),
    file_size bigint,
    width integer,
    height integer,
    alt_text text,
    title text,
    caption text,
    metadata text,
    sizes text,
    status varchar(50) not null,
    created_at timestamp with time zone not null,
    updated_at timestamp with time zone not null
);

create index idx_media_legacy_id on media (legacy_id);
create index idx_media_storage_provider on media (storage_provider);
create index idx_media_mime_type on media (mime_type);
create index idx_media_status on media (status);

create table redirects (
    id uuid primary key,
    source_pattern text not null,
    target_url text not null,
    redirect_type varchar(50) not null,
    status_code integer not null default 301,
    enabled boolean not null default true,
    hit_count bigint not null default 0,
    last_hit_at timestamp with time zone,
    notes text,
    legacy_id bigint,
    created_at timestamp with time zone not null,
    updated_at timestamp with time zone not null,
    constraint ck_redirects_status_code check (status_code in (301, 302, 307, 308))
);

create index idx_redirects_source_pattern on redirects (source_pattern);
create index idx_redirects_enabled on redirects (enabled);
create index idx_redirects_status_code on redirects (status_code);
create index idx_redirects_legacy_id on redirects (legacy_id);

create table menus (
    id uuid primary key,
    location varchar(100) not null unique,
    name varchar(255) not null,
    status varchar(50) not null,
    created_at timestamp with time zone not null,
    updated_at timestamp with time zone not null
);

create table menu_items (
    id uuid primary key,
    menu_id uuid not null references menus (id) on delete cascade,
    parent_id uuid references menu_items (id),
    label varchar(255) not null,
    url text,
    target_type varchar(50),
    target_id uuid,
    sort_order integer not null default 0,
    open_in_new_tab boolean not null default false,
    css_class varchar(255),
    status varchar(50) not null,
    legacy_id bigint,
    created_at timestamp with time zone not null,
    updated_at timestamp with time zone not null
);

create index idx_menu_items_menu_id on menu_items (menu_id);
create index idx_menu_items_parent_id on menu_items (parent_id);
create index idx_menu_items_sort_order on menu_items (sort_order);
create index idx_menu_items_legacy_id on menu_items (legacy_id);
