-- Product-category is an ordered many-to-many relation. The first row is the
-- product's primary category for breadcrumb/SEO compatibility.
CREATE TABLE product_category_map (
    product_id varchar(64) NOT NULL,
    category_id varchar(64) NOT NULL,
    sort_order integer NOT NULL,
    CONSTRAINT pk_product_category_map PRIMARY KEY (product_id, category_id),
    CONSTRAINT fk_product_category_map_product_id
        FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE,
    CONSTRAINT fk_product_category_map_category_id
        FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE CASCADE,
    CONSTRAINT ck_product_category_map_sort_order CHECK (sort_order >= 0)
);

-- Every current product has one non-null canonical category. Preserve it as the
-- first ordered mapping before retiring the scalar column.
INSERT INTO product_category_map (product_id, category_id, sort_order)
SELECT id, category_id, 0
FROM products;

DO $$
DECLARE
    product_count bigint;
    mapping_count bigint;
BEGIN
    SELECT count(*) INTO product_count FROM products;
    SELECT count(*) INTO mapping_count FROM product_category_map;
    IF product_count <> mapping_count THEN
        RAISE EXCEPTION 'Product-category backfill failed: % products, % mappings', product_count, mapping_count;
    END IF;
END $$;

CREATE INDEX idx_product_category_map_category_product
    ON product_category_map (category_id, product_id);

ALTER TABLE products DROP CONSTRAINT IF EXISTS fk_products_category_id;
ALTER TABLE products DROP COLUMN category_id;
