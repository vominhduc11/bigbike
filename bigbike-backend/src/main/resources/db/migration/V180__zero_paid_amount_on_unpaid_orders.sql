-- V180: Zero out the falsely-imported paid_amount on UNPAID / CANCELLED orders.
--
-- Context (root cause confirmed in importer code, not inferred):
-- WordPressOrderMapper line 169 blindly sets `paidAmount = total` for EVERY
-- imported order, regardless of whether any money was actually collected.
-- payment_status, by contrast, is derived carefully in
-- WordPressOrderMapper.derivePaymentStatus: PAID only when the order has a paid
-- date OR a transaction id OR WC status `completed`; otherwise UNPAID. So
-- payment_status is the source of truth and paid_amount is the blind copy — it
-- is the field that is wrong, leaving 831 orders that say "not paid" while
-- claiming the full total was collected.
--
-- Evidence the UNPAID/CANCELLED rows were never paid:
--   * none has a payment with a transaction_id (would have forced PAID),
--   * none has paid_at, completed_at, or any refund_amount.
--
-- Fix: paid_amount = 0 wherever payment_status is UNPAID or CANCELLED — the
-- amount collected on a not-paid / cancelled order is, by definition, zero.
-- PAID (and REFUNDED) orders keep paid_amount = total: that is the real cash
-- collected and REPORT_RULE_002 keeps it even after refunds.
--
-- Reporting impact: none. paidRevenue / todayPaidRevenue
-- (AdminReportService, AdminDashboardService, BUSINESS_RULES.md
-- REPORT_RULE_002) sum paidAmount only for payment_status IN (PAID, REFUNDED),
-- so the UNPAID/CANCELLED rows being corrected are already excluded.
--
-- Idempotent: after this runs no UNPAID/CANCELLED order has paid_amount <> 0,
-- so a second run is a 0-row no-op.

UPDATE orders
SET paid_amount = 0
WHERE payment_status IN ('UNPAID', 'CANCELLED')
  AND paid_amount <> 0;
