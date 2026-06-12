-- V179: Normalize the WP-imported payments vocabulary (status + method) and
--       backfill orders.payment_method from the payment record.
--
-- Context:
-- The legacy WordPress importer wrote the payments table with two mixed
-- vocabularies and inconsistent casing, while orders.payment_method was left
-- empty for every imported order (the method only survived on the payment row).
-- None of these two columns is read by value anywhere in the backend — the
-- PaymentRecordStatus enum is unused dead code, PaymentJpaRepository.findByStatus
-- has no callers, and revenue reporting reads orders.paymentStatus, not
-- payments.status (BUSINESS_RULES.md REPORT_RULE_001/002). They are
-- record-keeping / order-detail display fields, so this normalization is safe.
--
-- Canonical target = the vocabulary the LIVE code actually writes:
--   * payment record status: CheckoutService writes "PENDING", ReceivableService
--     and PosOrderService write "PAID", RefundService writes "REFUNDED"
--     → {PENDING, PAID, REFUNDED, CANCELLED}. The importer's "UNPAID" (an
--     order-level word) and "SUCCEEDED" (the unused enum spelling) are folded in.
--   * payment method: CheckoutService.ALLOWED_PAYMENT_METHODS = {COD, BACS}
--     (uppercase). WooCommerce gateway ids are mapped: bacs→BACS, cod→COD,
--     cashondelivery→COD (same "cash on delivery" gateway). checkmo (cheque) and
--     ccsave (credit card) have no live equivalent and are preserved as the
--     readable labels CHECK / CARD rather than folded into COD/BACS, which would
--     falsify how those orders were actually paid.
--
-- Idempotent: every guard matches only the exact legacy spellings, so a second
-- run is a 0-row no-op. The orders backfill only fills empty payment_method, so
-- the 6 natively-created orders (already COD/BACS) are never overwritten.

-- ── 1. Payment record status → live vocabulary ───────────────────────────────
UPDATE payments SET status = 'PENDING' WHERE status = 'UNPAID';
UPDATE payments SET status = 'PAID'    WHERE status = 'SUCCEEDED';

-- ── 2. Payment method → uppercase canonical / readable labels ────────────────
UPDATE payments
SET payment_method = CASE payment_method
        WHEN 'bacs'           THEN 'BACS'
        WHEN 'cod'            THEN 'COD'
        WHEN 'cashondelivery' THEN 'COD'
        WHEN 'checkmo'        THEN 'CHECK'
        WHEN 'ccsave'         THEN 'CARD'
    END
WHERE payment_method IN ('bacs', 'cod', 'cashondelivery', 'checkmo', 'ccsave');

-- ── 3. Backfill orders.payment_method from the (now-normalized) payment row ───
-- Exactly one payment per order (1:1, no order has multiple distinct methods),
-- so the source is unambiguous. Only fills orders left empty by the import.
UPDATE orders o
SET payment_method = p.payment_method
FROM payments p
WHERE p.order_id = o.id
  AND (o.payment_method IS NULL OR o.payment_method = '')
  AND p.payment_method IS NOT NULL
  AND p.payment_method <> '';
