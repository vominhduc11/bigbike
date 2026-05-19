-- V135: Admin-curated "Sản phẩm liên quan" shown on the product detail page.
-- Self-referential many-to-many, ordered. Schema mirrors article_product_map (V130).
-- The relation starts empty — no backfill. When a product has no curated entries
-- the PDP hides the "Sản phẩm liên quan" section entirely (no category fallback).

create table if not exists product_related_product_map (
    product_id varchar(64) not null,
    related_product_id varchar(64) not null,
    sort_order integer not null,
    primary key (product_id, related_product_id),
    constraint fk_product_related_product_map_product_id
        foreign key (product_id) references products (id) on delete cascade,
    constraint fk_product_related_product_map_related_id
        foreign key (related_product_id) references products (id) on delete cascade
);

-- PK (product_id, related_product_id) already covers product_id lookups;
-- index related_product_id for the reverse lookup and the FK delete check.
create index if not exists idx_product_related_product_map_product_id
    on product_related_product_map (product_id);
create index if not exists idx_product_related_product_map_related_id
    on product_related_product_map (related_product_id);
