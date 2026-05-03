-- V51: Serial tracking for physical inventory units (motorcycle chassis/engine numbers)
-- Backward-compatible: track_serials = false by default, existing variants unaffected.

-- ── 1. Flag on product_variants ──────────────────────────────────────────────
ALTER TABLE product_variants
    ADD COLUMN IF NOT EXISTS track_serials BOOLEAN NOT NULL DEFAULT false;

-- ── 2. Core table: one row = one physical unit ────────────────────────────────
CREATE TABLE IF NOT EXISTS product_serials (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Which SKU/variant does this unit belong to?
    product_variant_id      VARCHAR(255) NOT NULL
                                REFERENCES product_variants(id) ON DELETE RESTRICT,

    -- Physical identifiers (at least one must be non-null — enforced below)
    chassis_number          VARCHAR(100),
    engine_number           VARCHAR(100),

    -- Lifecycle state machine: IN_STOCK → RESERVED → SOLD → RETURNED | SCRAPPED
    status                  VARCHAR(20) NOT NULL DEFAULT 'IN_STOCK',

    -- Audit: which stock movement added this unit to inventory?
    stock_movement_in_id    UUID REFERENCES stock_movements(id) ON DELETE SET NULL,
    -- Which movement recorded the outgoing sale/write-off?
    stock_movement_out_id   UUID REFERENCES stock_movements(id) ON DELETE SET NULL,

    -- Linked to which order line item once sold?
    order_line_item_id      UUID REFERENCES order_line_items(id) ON DELETE SET NULL,
    -- Linked to which return item if the unit was returned?
    return_item_id          UUID REFERENCES return_items(id) ON DELETE SET NULL,

    -- Timestamps
    received_at             TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    sold_at                 TIMESTAMP WITH TIME ZONE,
    returned_at             TIMESTAMP WITH TIME ZONE,

    -- Free-form metadata
    note                    TEXT,
    admin_id                UUID,
    created_at              TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at              TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),

    -- Constraints
    CONSTRAINT chk_serial_status CHECK (
        status IN ('IN_STOCK', 'RESERVED', 'SOLD', 'RETURNED', 'SCRAPPED')
    ),
    CONSTRAINT chk_serial_has_identifier CHECK (
        chassis_number IS NOT NULL OR engine_number IS NOT NULL
    )
);

-- ── 3. Uniqueness guards ──────────────────────────────────────────────────────
-- One chassis number can only ever belong to one physical unit.
CREATE UNIQUE INDEX IF NOT EXISTS idx_serials_chassis
    ON product_serials (chassis_number)
    WHERE chassis_number IS NOT NULL;

-- Same for engine number.
CREATE UNIQUE INDEX IF NOT EXISTS idx_serials_engine
    ON product_serials (engine_number)
    WHERE engine_number IS NOT NULL;

-- A serial can only be assigned to one order line item at a time.
CREATE UNIQUE INDEX IF NOT EXISTS idx_serials_order_line_item
    ON product_serials (order_line_item_id)
    WHERE order_line_item_id IS NOT NULL;

-- ── 4. Performance indexes ────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_serials_variant_status
    ON product_serials (product_variant_id, status);

CREATE INDEX IF NOT EXISTS idx_serials_search
    ON product_serials (chassis_number, engine_number);

-- ── 5. Trigger: keep quantity_on_hand in sync with IN_STOCK serial count ──────
--    Only fires for variants with track_serials = true.
--    Application code still manages quantity_on_hand directly; this trigger acts
--    as a reconciliation safety net.
CREATE OR REPLACE FUNCTION fn_sync_qty_from_serials()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
    v_variant_id VARCHAR(255);
    v_track      BOOLEAN;
BEGIN
    v_variant_id := COALESCE(NEW.product_variant_id, OLD.product_variant_id);

    SELECT track_serials INTO v_track
    FROM product_variants
    WHERE id = v_variant_id;

    IF v_track THEN
        UPDATE product_variants
        SET quantity_on_hand = (
            SELECT COUNT(*)
            FROM product_serials
            WHERE product_variant_id = v_variant_id
              AND status = 'IN_STOCK'
        ),
        updated_at = now()
        WHERE id = v_variant_id;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_qty_after_serial_change ON product_serials;
CREATE TRIGGER trg_sync_qty_after_serial_change
    AFTER INSERT OR UPDATE OF status OR DELETE
    ON product_serials
    FOR EACH ROW
    EXECUTE FUNCTION fn_sync_qty_from_serials();

-- ── 6. Lookup view: full history of a single physical unit ────────────────────
CREATE OR REPLACE VIEW v_serial_history AS
SELECT
    ps.id                   AS serial_id,
    ps.chassis_number,
    ps.engine_number,
    ps.status,
    pv.id                   AS variant_id,
    pv.sku                  AS variant_sku,
    pv.name                 AS variant_name,
    p.id                    AS product_id,
    p.name                  AS product_name,
    p.sku                   AS product_sku,
    ps.received_at,
    ps.sold_at,
    ps.returned_at,
    o.order_number,
    o.status                AS order_status,
    o.customer_email,
    o.customer_phone,
    r.return_number,
    r.status                AS return_status,
    ps.note,
    ps.created_at
FROM product_serials ps
JOIN product_variants pv   ON pv.id  = ps.product_variant_id
JOIN products p             ON p.id   = pv.product_id
LEFT JOIN order_line_items oli ON oli.id = ps.order_line_item_id
LEFT JOIN orders o          ON o.id   = oli.order_id
LEFT JOIN return_items ri   ON ri.id  = ps.return_item_id
LEFT JOIN returns r         ON r.id   = ri.return_id;
