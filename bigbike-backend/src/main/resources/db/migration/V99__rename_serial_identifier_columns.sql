-- V99: Rename chassis_number / engine_number → serial_number.
-- BigBike sells motorcycle protective gear (helmets, jackets, gloves…),
-- not vehicles. A single serial_number per item is the correct model.

-- 1. Add the new column
ALTER TABLE product_serials
    ADD COLUMN IF NOT EXISTS serial_number VARCHAR(100);

-- 2. Migrate existing data (chassis_number takes precedence, fallback to engine_number)
UPDATE product_serials
SET serial_number = COALESCE(chassis_number, engine_number)
WHERE serial_number IS NULL;

-- 3. Enforce NOT NULL now that data is migrated
ALTER TABLE product_serials
    ALTER COLUMN serial_number SET NOT NULL;

-- 4. Drop old check constraint and columns
ALTER TABLE product_serials
    DROP CONSTRAINT IF EXISTS chk_ps_has_identifier;

ALTER TABLE product_serials
    DROP COLUMN IF EXISTS chassis_number,
    DROP COLUMN IF EXISTS engine_number;

-- 5. Replace old unique indexes with one on serial_number
DROP INDEX IF EXISTS idx_ps_chassis;
DROP INDEX IF EXISTS idx_ps_engine;

CREATE UNIQUE INDEX IF NOT EXISTS idx_ps_serial_number
    ON product_serials (serial_number);

-- 6. Add new NOT NULL check constraint
ALTER TABLE product_serials
    ADD CONSTRAINT chk_ps_has_serial CHECK (serial_number IS NOT NULL AND serial_number <> '');
