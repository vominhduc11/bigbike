-- Add WordPress migration metadata + WooCommerce-style inventory fields to products,
-- and broaden the publish_status check constraint to cover PENDING / PRIVATE / TRASH.

alter table products add column legacy_id varchar(64);
alter table products add column stock_quantity integer;
alter table products add column manage_stock boolean;
alter table products add column backorders varchar(16);

create unique index idx_products_legacy_id on products (legacy_id);

alter table products
    add constraint ck_products_backorders
        check (backorders is null or backorders in ('no', 'notify', 'yes'));

-- Expand publish_status enum to match domain.catalog.PublishStatus.
alter table products
    drop constraint ck_products_publish_status;

alter table products
    add constraint ck_products_publish_status
        check (publish_status in ('DRAFT', 'PUBLISHED', 'HIDDEN', 'ARCHIVED', 'PENDING', 'PRIVATE', 'TRASH'));

-- articles and pages share the same enum; keep them in sync so future migrations
-- can move records between PublishStatus values without per-table CHECK drift.
alter table articles
    drop constraint ck_articles_publish_status;
alter table articles
    add constraint ck_articles_publish_status
        check (publish_status in ('DRAFT', 'PUBLISHED', 'HIDDEN', 'ARCHIVED', 'PENDING', 'PRIVATE', 'TRASH'));

alter table pages
    drop constraint ck_pages_publish_status;
alter table pages
    add constraint ck_pages_publish_status
        check (publish_status in ('DRAFT', 'PUBLISHED', 'HIDDEN', 'ARCHIVED', 'PENDING', 'PRIVATE', 'TRASH'));
