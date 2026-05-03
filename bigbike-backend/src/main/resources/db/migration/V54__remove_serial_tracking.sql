-- V54: Remove serial tracking feature completely.
-- Reverses V51 (product_serials, trigger, view, track_serials column on product_variants)
-- and removes track_serials column added to stock_receipt_lines in V53.

-- ── 1. Drop view ──────────────────────────────────────────────────────────────
DROP VIEW IF EXISTS v_serial_history;

-- ── 2. Drop trigger and function ──────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_sync_qty_after_serial_change ON product_serials;
DROP FUNCTION IF EXISTS fn_sync_qty_from_serials();

-- ── 3. Drop product_serials table (cascades indexes) ─────────────────────────
DROP TABLE IF EXISTS product_serials;

-- ── 4. Remove track_serials column from product_variants ─────────────────────
ALTER TABLE product_variants
    DROP COLUMN IF EXISTS track_serials;

-- ── 5. Remove track_serials column from stock_receipt_lines ──────────────────
ALTER TABLE stock_receipt_lines
    DROP COLUMN IF EXISTS track_serials;
