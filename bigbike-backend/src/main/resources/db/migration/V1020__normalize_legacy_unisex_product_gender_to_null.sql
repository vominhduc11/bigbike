-- Owner decision 2026-08-13: product gender is optional; legacy Unisex becomes NULL.
UPDATE products
SET gender = NULL
WHERE lower(trim(gender)) = 'unisex';
