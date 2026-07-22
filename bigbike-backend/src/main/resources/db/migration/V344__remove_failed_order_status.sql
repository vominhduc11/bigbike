-- V344: Remove the FAILED order status.
--
-- Owner decision (2026-07-21): bỏ hẳn trạng thái đơn "Thất bại" (FAILED) — chỉ còn
-- "Đã huỷ" (CANCELLED) làm kết cục âm duy nhất cho đơn hàng. Mirrors the REFUNDED
-- removal in V261 (2026-06-23): data is preserved, existing FAILED orders are
-- converted to CANCELLED so no order is lost.

-- ── 1. Backfill: FAILED → CANCELLED ────────────────────────────────────────────
UPDATE orders
   SET status = 'CANCELLED',
       cancelled_at = COALESCE(cancelled_at, updated_at)
 WHERE status = 'FAILED';

-- ── 2. Refresh CHECK constraint to drop FAILED ─────────────────────────────────
ALTER TABLE orders DROP CONSTRAINT IF EXISTS ck_orders_status;
ALTER TABLE orders
    ADD CONSTRAINT ck_orders_status
        CHECK (status IN ('PENDING','PROCESSING','ON_HOLD','COMPLETED','CANCELLED'));
