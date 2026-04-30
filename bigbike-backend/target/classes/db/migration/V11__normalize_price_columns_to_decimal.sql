-- Normalize product / product_variant price columns to DECIMAL(19,2).
-- Reason: storing currency as integer loses precision for prospective multi-currency
-- support and diverges from the existing order / cart tables that already use numeric(19,2).

alter table products
    alter column retail_price type numeric(19, 2) using retail_price::numeric(19, 2);

alter table products
    alter column compare_at_price type numeric(19, 2) using compare_at_price::numeric(19, 2);

alter table products
    alter column sale_price type numeric(19, 2) using sale_price::numeric(19, 2);

alter table product_variants
    alter column retail_price type numeric(19, 2) using retail_price::numeric(19, 2);

alter table product_variants
    alter column compare_at_price type numeric(19, 2) using compare_at_price::numeric(19, 2);

alter table product_variants
    alter column sale_price type numeric(19, 2) using sale_price::numeric(19, 2);
