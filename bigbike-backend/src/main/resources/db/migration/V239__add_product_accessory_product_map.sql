-- V239: Admin-curated "Phụ kiện" (accessories sold alongside) shown on the product
-- detail page. Self-referential many-to-many, ordered. Schema mirrors
-- product_related_product_map (V135). The relation starts empty — no backfill. When a
-- product has no curated entries the PDP hides the "Phụ kiện" section entirely.

create table if not exists product_accessory_product_map (
    product_id varchar(64) not null,
    accessory_product_id varchar(64) not null,
    sort_order integer not null,
    primary key (product_id, accessory_product_id),
    constraint fk_product_accessory_product_map_product_id
        foreign key (product_id) references products (id) on delete cascade,
    constraint fk_product_accessory_product_map_accessory_id
        foreign key (accessory_product_id) references products (id) on delete cascade
);

-- PK (product_id, accessory_product_id) already covers product_id lookups;
-- index accessory_product_id for the reverse lookup and the FK delete check.
create index if not exists idx_product_accessory_product_map_product_id
    on product_accessory_product_map (product_id);
create index if not exists idx_product_accessory_product_map_accessory_id
    on product_accessory_product_map (accessory_product_id);
