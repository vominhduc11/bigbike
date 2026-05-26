-- V1013 dev: Undo V1009 RECOMMENDED_CAROUSEL seed after V149 removed the enum value.
UPDATE products
SET homepage_block = 'NONE',
    homepage_order = NULL,
    updated_at     = now()
WHERE homepage_block = 'RECOMMENDED_CAROUSEL';
