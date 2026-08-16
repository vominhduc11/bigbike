-- Product gender is now two independent optional flags.
-- Preserve the old scalar exactly: Nam -> male, Nữ -> female, and NULL/blank/legacy
-- Unisex -> neither. No inference from product names, categories or variants is allowed.
ALTER TABLE products
    ADD COLUMN IF NOT EXISTS gender_male BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE products
    ADD COLUMN IF NOT EXISTS gender_female BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE products
SET gender_male = CASE
                      WHEN lower(trim(gender)) = 'nam' THEN TRUE
                      ELSE FALSE
                  END,
    gender_female = CASE
                        WHEN lower(trim(gender)) = 'nữ' THEN TRUE
                        ELSE FALSE
                    END;

ALTER TABLE products
    DROP COLUMN IF EXISTS gender;

CREATE INDEX IF NOT EXISTS idx_products_gender_male
    ON products (gender_male)
    WHERE gender_male = TRUE;

CREATE INDEX IF NOT EXISTS idx_products_gender_female
    ON products (gender_female)
    WHERE gender_female = TRUE;
