-- Owner decision 2026-08-31: track when manual Còn/Hết availability becomes out
-- and deliver at most one aggregate out-of-stock digest per Vietnam calendar date.

ALTER TABLE products
    ADD COLUMN IF NOT EXISTS out_of_stock_since TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS out_of_stock_since_estimated BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE product_variants
    ADD COLUMN IF NOT EXISTS out_of_stock_since TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS out_of_stock_since_estimated BOOLEAN NOT NULL DEFAULT FALSE;

-- Runtime history before this rollout is unavailable. Seed only a lower-bound marker;
-- the UI/email must label these rows as estimated and must not claim an earlier date.
UPDATE product_variants
SET out_of_stock_since = now(),
    out_of_stock_since_estimated = TRUE
WHERE is_available = FALSE
  AND out_of_stock_since IS NULL;

UPDATE products
SET out_of_stock_since = now(),
    out_of_stock_since_estimated = TRUE
WHERE stock_state = 'OUT_OF_STOCK'
  AND out_of_stock_since IS NULL;

CREATE TABLE IF NOT EXISTS inventory_out_of_stock_digest_runs (
    digest_date DATE PRIMARY KEY,
    outcome VARCHAR(16) NOT NULL CHECK (outcome IN ('EMPTY', 'NOTIFIED')),
    notification_id UUID NULL REFERENCES admin_notifications(id) ON DELETE SET NULL,
    email_attempted_at TIMESTAMPTZ NULL,
    email_accepted BOOLEAN NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_inventory_digest_notification CHECK (
        (outcome = 'EMPTY' AND notification_id IS NULL)
        OR outcome = 'NOTIFIED'
    )
);

CREATE INDEX IF NOT EXISTS idx_inventory_digest_notification_id
    ON inventory_out_of_stock_digest_runs(notification_id)
    WHERE notification_id IS NOT NULL;

INSERT INTO site_settings
    (id, setting_key, setting_value, setting_group, is_public, description, created_at, updated_at)
VALUES
    (gen_random_uuid(), 'inventory_out_of_stock_digest_enabled', 'true', 'inventory', FALSE,
     'Bật/tắt bản tin hết hàng hằng ngày / Enable or disable the daily out-of-stock digest.', now(), now()),
    (gen_random_uuid(), 'inventory_out_of_stock_digest_time', '08:00', 'inventory', FALSE,
     'Giờ gửi bản tin theo giờ Việt Nam (HH:mm) / Digest time in Vietnam (HH:mm).', now(), now())
ON CONFLICT (setting_key) DO NOTHING;

-- Track exact future transitions for variant rows even when a maintenance/import path
-- writes the boolean directly. Existing estimated markers remain untouched until restock.
CREATE OR REPLACE FUNCTION fn_track_variant_out_of_stock_since()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.is_available THEN
        NEW.out_of_stock_since := NULL;
        NEW.out_of_stock_since_estimated := FALSE;
    ELSE
        IF TG_OP = 'INSERT' THEN
            NEW.out_of_stock_since := COALESCE(NEW.out_of_stock_since, now());
            NEW.out_of_stock_since_estimated := FALSE;
        ELSE
            NEW.out_of_stock_since := COALESCE(NEW.out_of_stock_since, OLD.out_of_stock_since, now());
        END IF;
        IF TG_OP = 'UPDATE'
                AND NEW.out_of_stock_since IS DISTINCT FROM OLD.out_of_stock_since
                AND OLD.is_available THEN
            NEW.out_of_stock_since_estimated := FALSE;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_variant_out_of_stock_since ON product_variants;
CREATE TRIGGER trg_variant_out_of_stock_since
    BEFORE INSERT OR UPDATE OF is_available, out_of_stock_since
    ON product_variants
    FOR EACH ROW
    EXECUTE FUNCTION fn_track_variant_out_of_stock_since();

-- Observe the existing derived product stock_state only. This trigger records age;
-- it deliberately does not derive or change the shop's availability policy.
CREATE OR REPLACE FUNCTION fn_track_product_out_of_stock_since()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.stock_state = 'OUT_OF_STOCK' THEN
        IF TG_OP = 'INSERT' THEN
            IF NEW.out_of_stock_since IS NULL THEN
                NEW.out_of_stock_since := now();
                NEW.out_of_stock_since_estimated := FALSE;
            END IF;
        ELSIF OLD.stock_state IS DISTINCT FROM 'OUT_OF_STOCK' THEN
            NEW.out_of_stock_since := COALESCE(NEW.out_of_stock_since, now());
            NEW.out_of_stock_since_estimated := FALSE;
        ELSE
            NEW.out_of_stock_since := COALESCE(
                NEW.out_of_stock_since,
                OLD.out_of_stock_since,
                now()
            );
        END IF;
    ELSE
        NEW.out_of_stock_since := NULL;
        NEW.out_of_stock_since_estimated := FALSE;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_product_out_of_stock_since ON products;
CREATE TRIGGER trg_product_out_of_stock_since
    BEFORE INSERT OR UPDATE OF stock_state, out_of_stock_since
    ON products
    FOR EACH ROW
    EXECUTE FUNCTION fn_track_product_out_of_stock_since();
