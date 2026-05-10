-- V89: Restore product_serials lifecycle table (removed in V54) with 7-state machine.
-- Supports variant-level AND product-level (no-variant) serial tracking.
-- Adds track_serials flag to product_variants and products.
-- DB trigger auto-syncs quantity_on_hand / stock_quantity from IN_STOCK count.

-- ── 1. track_serials flag ─────────────────────────────────────────────────────
ALTER TABLE product_variants
    ADD COLUMN IF NOT EXISTS track_serials BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE products
    ADD COLUMN IF NOT EXISTS track_serials BOOLEAN NOT NULL DEFAULT false;

-- ── 2. product_serials lifecycle table ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS product_serials (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Scoping: always linked to product; variant link is optional
    product_id              VARCHAR(255) NOT NULL
                                REFERENCES products(id) ON DELETE RESTRICT,
    product_variant_id      VARCHAR(255)
                                REFERENCES product_variants(id) ON DELETE RESTRICT,

    -- Physical identifiers (at least one must be non-null — motorcycles always have one)
    chassis_number          VARCHAR(100),
    engine_number           VARCHAR(100),

    -- 7-state lifecycle (see STATE_MACHINES.md Section 9)
    status                  VARCHAR(20) NOT NULL DEFAULT 'IN_STOCK',

    -- TTL only meaningful when status = RESERVED; null otherwise
    reserved_until          TIMESTAMP WITH TIME ZONE,

    -- Order and return links (set when serial moves to RESERVED / SOLD / RETURNED)
    order_line_item_id      UUID REFERENCES order_line_items(id) ON DELETE SET NULL,
    return_item_id          UUID REFERENCES return_items(id) ON DELETE SET NULL,

    -- Audit timestamps
    received_at             TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    sold_at                 TIMESTAMP WITH TIME ZONE,
    returned_at             TIMESTAMP WITH TIME ZONE,

    note                    TEXT,
    admin_id                UUID,
    created_at              TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at              TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),

    CONSTRAINT chk_ps_status CHECK (
        status IN ('IN_STOCK','RESERVED','SOLD','DAMAGED','INSPECTION','RETURNED','SCRAPPED')
    ),
    CONSTRAINT chk_ps_has_identifier CHECK (
        chassis_number IS NOT NULL OR engine_number IS NOT NULL
    )
);

-- ── 3. Uniqueness guards ──────────────────────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS idx_ps_chassis
    ON product_serials (chassis_number)
    WHERE chassis_number IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_ps_engine
    ON product_serials (engine_number)
    WHERE engine_number IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_ps_order_line
    ON product_serials (order_line_item_id)
    WHERE order_line_item_id IS NOT NULL;

-- ── 4. Performance indexes ────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_ps_variant_status
    ON product_serials (product_variant_id, status)
    WHERE product_variant_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ps_product_status
    ON product_serials (product_id, status)
    WHERE product_variant_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_ps_reserved_until
    ON product_serials (reserved_until)
    WHERE status = 'RESERVED';

-- ── 5. Trigger: sync quantity_on_hand / stock_quantity from IN_STOCK count ────
--    Only fires for rows whose parent variant/product has track_serials = true.
CREATE OR REPLACE FUNCTION fn_sync_qty_from_serial_lifecycle()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
    v_variant_id VARCHAR(255);
    v_product_id VARCHAR(255);
    v_track_var  BOOLEAN;
    v_track_prod BOOLEAN;
    v_threshold  INT;
    v_qty        INT;
BEGIN
    v_variant_id := COALESCE(NEW.product_variant_id, OLD.product_variant_id);
    v_product_id := COALESCE(NEW.product_id, OLD.product_id);

    IF v_variant_id IS NOT NULL THEN
        SELECT track_serials INTO v_track_var
        FROM product_variants WHERE id = v_variant_id;

        IF v_track_var THEN
            v_qty := (
                SELECT COUNT(*) FROM product_serials
                WHERE product_variant_id = v_variant_id AND status = 'IN_STOCK'
            );
            v_threshold := COALESCE(
                (SELECT CAST(setting_value AS INT)
                 FROM site_settings WHERE setting_key = 'low_stock_threshold'
                 LIMIT 1),
                5
            );
            UPDATE product_variants
            SET quantity_on_hand = v_qty,
                stock_state = CASE
                    WHEN v_qty <= 0 THEN 'OUT_OF_STOCK'
                    WHEN v_qty <= v_threshold THEN 'LOW_STOCK'
                    ELSE 'IN_STOCK'
                END
            WHERE id = v_variant_id;
        END IF;

    ELSE
        -- Product-level serial (no variant assigned)
        SELECT track_serials INTO v_track_prod
        FROM products WHERE id = v_product_id;

        IF v_track_prod THEN
            v_qty := (
                SELECT COUNT(*) FROM product_serials
                WHERE product_id = v_product_id
                  AND product_variant_id IS NULL
                  AND status = 'IN_STOCK'
            );
            v_threshold := COALESCE(
                (SELECT CAST(setting_value AS INT)
                 FROM site_settings WHERE setting_key = 'low_stock_threshold'
                 LIMIT 1),
                5
            );
            UPDATE products
            SET stock_quantity = v_qty,
                stock_state = CASE
                    WHEN v_qty <= 0 THEN 'OUT_OF_STOCK'
                    WHEN v_qty <= v_threshold THEN 'LOW_STOCK'
                    ELSE 'IN_STOCK'
                END,
                updated_at = now()
            WHERE id = v_product_id;
        END IF;
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_serial_lifecycle_sync ON product_serials;
CREATE TRIGGER trg_serial_lifecycle_sync
    AFTER INSERT OR UPDATE OF status OR DELETE
    ON product_serials
    FOR EACH ROW
    EXECUTE FUNCTION fn_sync_qty_from_serial_lifecycle();
