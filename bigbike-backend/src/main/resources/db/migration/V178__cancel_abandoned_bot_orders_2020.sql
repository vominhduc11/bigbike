-- V178: Cancel 132 abandoned bot/duplicate-checkout orders from the 2020 WP import.
--
-- Context:
-- The WordPress import carried 132 PENDING orders placed 2020-10-08..09 by two
-- numeric-only "customers" (4848: 103 orders in 29 min; 10616: 29 orders in
-- 7 min) — 127/131 consecutive orders less than 60s apart, each a single line of
-- the SAME product (PINLOCK 120 AGV / ÁO NỮ APRO PARIS LADY). This is the
-- signature of an abandoned bot / broken checkout loop, not real demand. Each
-- order has a real line item (line_subtotal 890,000 or 2,650,000) but
-- total_amount = 0 because WooCommerce never finalised the total for a checkout
-- that never reached payment. paid_amount = 0, payment_status = UNPAID.
--
-- Why cancel (not backfill the total): PENDING orders are counted in GMV
-- (BUSINESS_RULES.md REPORT_RULE_001 — GMV = SUM(totalAmount) for status NOT IN
-- CANCELLED/FAILED). Setting their total to the line value would inject ~168M
-- VND of fake demand into reports. Leaving total = 0 keeps GMV correct but
-- leaves 132 junk rows in the pending-order queue. Cancelling removes them from
-- both the work queue and every report while preserving the audit trail.
--
-- Safety:
--   * PENDING -> CANCELLED is an allowed transition
--     (AdminOrderService.ALLOWED_TRANSITIONS: PENDING ->
--      {PROCESSING, ON_HOLD, CANCELLED, FAILED}).
--   * ORDER_RULE_004 only blocks paymentStatus = PAID from direct cancel; these
--     are all UNPAID / paid_amount = 0, so no refund/void path is required.
--   * These orders hold zero stock_movements and zero serials, so there is no
--     inventory or serial to restore.
--   * Representation matches the 26 pre-existing CANCELLED orders exactly:
--     orders.status = CANCELLED, payment_status = CANCELLED, cancelled_at set,
--     and the payment record status = CANCELLED.
--
-- Idempotent: the status = 'PENDING' guard makes a second run a 0-row no-op.
-- The clause is bounded (UNPAID, paid_amount = 0, total = 0, placed before 2021,
-- real line item present) and was verified to match exactly these 132 orders.

-- ── 1. Cancel the payment records first (while the orders are still PENDING) ──
UPDATE payments p
SET status = 'CANCELLED'
WHERE p.order_id IN (
    SELECT o.id FROM orders o
    WHERE o.status = 'PENDING'
      AND o.payment_status = 'UNPAID'
      AND o.paid_amount = 0
      AND o.total_amount = 0
      AND o.placed_at < TIMESTAMP '2021-01-01'
      AND EXISTS (SELECT 1 FROM order_line_items x WHERE x.order_id = o.id AND x.line_subtotal > 0)
);

-- ── 2. Cancel the orders ─────────────────────────────────────────────────────
UPDATE orders o
SET status = 'CANCELLED',
    payment_status = 'CANCELLED',
    cancelled_at = now()
WHERE o.status = 'PENDING'
  AND o.payment_status = 'UNPAID'
  AND o.paid_amount = 0
  AND o.total_amount = 0
  AND o.placed_at < TIMESTAMP '2021-01-01'
  AND EXISTS (SELECT 1 FROM order_line_items x WHERE x.order_id = o.id AND x.line_subtotal > 0);
