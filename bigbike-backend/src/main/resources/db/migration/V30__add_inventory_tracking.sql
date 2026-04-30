-- V30: Add quantity_on_hand to product_variants and create stock_movements table.

-- ── 1. Add quantity_on_hand column ───────────────────────────────────────────

alter table product_variants
    add column if not exists quantity_on_hand integer not null default 0;

-- ── 2. Backfill from existing stock_quantity on products (best-effort) ────────
-- Products that track stock as a single number are split to their variants.
-- Only applies where quantity_on_hand is still 0 and the product has stock data.
update product_variants pv
set quantity_on_hand = coalesce(
    (select p.stock_quantity
     from products p
     where p.id = pv.product_id
       and p.stock_quantity is not null
       and p.manage_stock = true),
    0)
where pv.quantity_on_hand = 0;

-- ── 3. Create stock_movements table ──────────────────────────────────────────

create table if not exists stock_movements (
    id                  uuid primary key default gen_random_uuid(),
    product_variant_id  varchar(255) not null references product_variants(id) on delete cascade,
    movement_type       varchar(32) not null,   -- IN, OUT, ADJUSTMENT, RETURN
    quantity_delta      integer not null,        -- positive = added, negative = removed
    quantity_before     integer not null,
    quantity_after      integer not null,
    reference_type      varchar(64),             -- ORDER, RETURN, MANUAL, IMPORT
    reference_id        uuid,
    note                text,
    admin_id            uuid,
    created_at          timestamp with time zone not null default now()
);

create index if not exists idx_stock_movements_variant_id
    on stock_movements (product_variant_id);

create index if not exists idx_stock_movements_created_at
    on stock_movements (created_at desc);
