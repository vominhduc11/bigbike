-- V261: Remove the Return (RMA) + Refund feature from the entire stack.
--
-- Owner decision (2026-06-23): gỡ hoàn toàn chức năng đổi trả VÀ mọi hoàn tiền
-- (hoàn tiền khi huỷ đơn, hoàn tiền POS, hoàn tiền thủ công). Trạng thái REFUNDED
-- của đơn/thanh toán bị bỏ. Đơn đã thanh toán giờ được huỷ thẳng — admin tự đối
-- soát tiền ngoài hệ thống. Chữ chính sách đổi trả/đổi size trên web được GIỮ
-- (nội dung admin tự soạn, không phải tính năng hệ thống).
--
-- Data is preserved: existing REFUNDED orders are converted to CANCELLED so no
-- order is lost. Returns/refund bookkeeping tables are dropped.

-- ── 1. Backfill: REFUNDED → CANCELLED (orders + payments) ─────────────────────
-- Keep the order, drop the refunded vocabulary. cancelled_at is set from the best
-- available timestamp so the cancel date stays meaningful.
UPDATE orders
   SET status = 'CANCELLED',
       cancelled_at = COALESCE(cancelled_at, refunded_at, updated_at)
 WHERE status = 'REFUNDED';

UPDATE orders   SET payment_status = 'CANCELLED' WHERE payment_status = 'REFUNDED';
UPDATE payments SET status         = 'CANCELLED' WHERE status         = 'REFUNDED';

-- ── 2. Refresh CHECK constraints to drop REFUNDED ─────────────────────────────
ALTER TABLE orders DROP CONSTRAINT IF EXISTS ck_orders_status;
ALTER TABLE orders
    ADD CONSTRAINT ck_orders_status
        CHECK (status IN ('PENDING','PROCESSING','ON_HOLD','COMPLETED','CANCELLED','FAILED'));

ALTER TABLE orders DROP CONSTRAINT IF EXISTS ck_orders_payment_status;
ALTER TABLE orders
    ADD CONSTRAINT ck_orders_payment_status
        CHECK (payment_status IN ('UNPAID','PAID','CANCELLED'));

-- ── 3. Drop returns (RMA) tables + sequence ───────────────────────────────────
-- return_items / return_history FK → returns (children first).
DROP TABLE IF EXISTS return_history;
DROP TABLE IF EXISTS return_items;
DROP TABLE IF EXISTS returns;
DROP SEQUENCE IF EXISTS return_number_seq;

-- ── 4. Drop refund transactions ledger ────────────────────────────────────────
DROP TABLE IF EXISTS refund_transactions;

-- ── 5. Drop refund columns from orders + payments ─────────────────────────────
ALTER TABLE orders   DROP COLUMN IF EXISTS refund_amount;
ALTER TABLE orders   DROP COLUMN IF EXISTS refund_reason;
ALTER TABLE orders   DROP COLUMN IF EXISTS refunded_at;
ALTER TABLE payments DROP COLUMN IF EXISTS refund_amount;
ALTER TABLE payments DROP COLUMN IF EXISTS refunded_at;

-- ── 6. Remove the pos.refund permission grant ─────────────────────────────────
DELETE FROM role_permissions WHERE permission = 'pos.refund';
