-- V90: Serial bridge tables + warranty records
-- Allows multiple serials per order line item (qty > 1 use case)
-- and tracks serial lifecycle through returns.

-- ── 1. order_line_item_serials bridge ────────────────────────────────────────
-- One row per (line item, serial) pair. serial_id is unique → one serial per sale only.
CREATE TABLE IF NOT EXISTS order_line_item_serials (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_line_item_id  UUID NOT NULL REFERENCES order_line_items(id) ON DELETE CASCADE,
    serial_id           UUID NOT NULL REFERENCES product_serials(id) ON DELETE RESTRICT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_olis_serial UNIQUE (serial_id)
);

CREATE INDEX IF NOT EXISTS idx_olis_line_item  ON order_line_item_serials (order_line_item_id);
CREATE INDEX IF NOT EXISTS idx_olis_serial     ON order_line_item_serials (serial_id);

-- ── 2. return_item_serials bridge ────────────────────────────────────────────
-- Links a return item to the specific serials being returned.
CREATE TABLE IF NOT EXISTS return_item_serials (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    return_item_id  UUID NOT NULL REFERENCES return_items(id) ON DELETE CASCADE,
    serial_id       UUID NOT NULL REFERENCES product_serials(id) ON DELETE RESTRICT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_ris_serial_return UNIQUE (serial_id, return_item_id)
);

CREATE INDEX IF NOT EXISTS idx_ris_return_item ON return_item_serials (return_item_id);
CREATE INDEX IF NOT EXISTS idx_ris_serial      ON return_item_serials (serial_id);

-- ── 3. warranty_records ───────────────────────────────────────────────────────
-- One warranty record per serial sold. Created automatically when serial → SOLD.
CREATE TABLE IF NOT EXISTS warranty_records (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    serial_id           UUID NOT NULL REFERENCES product_serials(id) ON DELETE RESTRICT,
    order_line_item_id  UUID REFERENCES order_line_items(id) ON DELETE SET NULL,
    customer_id         UUID,
    customer_email      VARCHAR(255),
    customer_phone      VARCHAR(50),
    start_date          DATE NOT NULL,
    end_date            DATE NOT NULL,
    status              VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_wr_serial UNIQUE (serial_id),
    CONSTRAINT chk_wr_status CHECK (status IN ('ACTIVE', 'EXPIRED', 'VOIDED'))
);

CREATE INDEX IF NOT EXISTS idx_wr_serial         ON warranty_records (serial_id);
CREATE INDEX IF NOT EXISTS idx_wr_customer_id    ON warranty_records (customer_id);
CREATE INDEX IF NOT EXISTS idx_wr_status_end     ON warranty_records (status, end_date);

-- ── 4. site_settings seed: serial_inventory_only & warranty_period_months ────
INSERT INTO site_settings (id, setting_key, setting_value, setting_group, is_public, description, created_at, updated_at)
VALUES
    (gen_random_uuid(), 'serial_inventory_only',  'false', 'inventory', false, 'Enable serial-number-only inventory mode',    now(), now()),
    (gen_random_uuid(), 'default_warranty_months', '12',   'inventory', false, 'Default warranty duration in months',          now(), now())
ON CONFLICT (setting_key) DO NOTHING;

-- ── 5. Deprecation note on product_serials legacy FK columns ──────────────────
-- order_line_item_id and return_item_id on product_serials are kept for
-- backward compatibility but NEW code uses the bridge tables above.
-- They will be dropped in a future migration after data verification.
COMMENT ON COLUMN product_serials.order_line_item_id
    IS 'DEPRECATED: use order_line_item_serials bridge table instead';
COMMENT ON COLUMN product_serials.return_item_id
    IS 'DEPRECATED: use return_item_serials bridge table instead';
