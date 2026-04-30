-- Add WooCommerce physical dimension columns and BigBike-specific override flags
-- to the products table. All columns are nullable; existing rows default to NULL.

alter table products add column weight_kg            numeric(10, 4);
alter table products add column length_cm           numeric(10, 4);
alter table products add column width_cm            numeric(10, 4);
alter table products add column height_cm           numeric(10, 4);
alter table products add column force_out_of_stock  boolean;
alter table products add column discount_percent_override numeric(5, 2);

alter table products
    add constraint ck_products_discount_percent
        check (discount_percent_override is null
            or (discount_percent_override >= 0 and discount_percent_override <= 100));
