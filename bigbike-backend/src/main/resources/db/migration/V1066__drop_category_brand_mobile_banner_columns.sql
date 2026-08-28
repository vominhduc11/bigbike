-- Retire the unused mobile hero-banner contract from Category and Brand.
-- Owner-confirmed on 2026-08-28: 0 Category and 0 Brand records use either field.
DO $$
DECLARE
    category_mobile_values BIGINT;
    brand_mobile_values BIGINT;
BEGIN
    SELECT COUNT(*)
      INTO category_mobile_values
      FROM categories
     WHERE mobile_banner_url IS NOT NULL
        OR mobile_banner_alt IS NOT NULL;

    SELECT COUNT(*)
      INTO brand_mobile_values
      FROM brands
     WHERE mobile_banner_url IS NOT NULL
        OR mobile_banner_alt IS NOT NULL;

    IF category_mobile_values > 0 OR brand_mobile_values > 0 THEN
        RAISE EXCEPTION
            'Cannot drop mobile banner columns: categories=% brands=% still contain values',
            category_mobile_values,
            brand_mobile_values;
    END IF;
END
$$;

ALTER TABLE categories
    DROP COLUMN IF EXISTS mobile_banner_url,
    DROP COLUMN IF EXISTS mobile_banner_alt;

ALTER TABLE brands
    DROP COLUMN IF EXISTS mobile_banner_url,
    DROP COLUMN IF EXISTS mobile_banner_alt;
