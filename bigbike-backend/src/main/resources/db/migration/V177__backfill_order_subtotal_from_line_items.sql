-- V177: Backfill orders.subtotal_amount for WP-imported orders.
--
-- Context:
-- The legacy WordPress order importer never populated orders.subtotal_amount
-- (OrderImporter#L97 stores `safe(mo.subtotalAmount())`, and the WooCommerce
-- export carried no subtotal line), so 1660 of 1666 imported orders kept the
-- column default 0 while total_amount and the order_line_items were correct.
-- Effect for staff: the order detail screens (OrderDetailResponse,
-- AdminOrderDetailResponse, checkout OrderSummaryResponse all expose
-- subtotalAmount straight from the entity) show "Tạm tính 0₫" next to a real,
-- non-zero total. Only the 6 orders created natively on the new platform had a
-- correct subtotal.
--
-- Canonical formula (source of truth in code — NOT invented here):
--   orders.subtotal_amount = SUM(order_line_items.line_subtotal)
-- where line_subtotal is the pre-line-discount amount (unit_price * quantity).
-- Confirmed in CartCalculator#recalculateCart (sums getLineSubtotal into
-- cart.setSubtotalAmount) and CheckoutService / PosOrderService which carry the
-- same `subtotal` into order.setSubtotalAmount. Verified against the 6 native
-- orders: every one already has subtotal_amount == SUM(line_subtotal) exactly.
--
-- Scope: this only restores the subtotal field. total_amount is left untouched —
-- it is already correct for 1528 orders, and the ~132 orders whose total does
-- not reconcile with their line items are a separate source-data problem (the
-- WooCommerce total itself was inconsistent) tracked independently. Backfilling
-- their subtotal to SUM(line_subtotal) is still the correct subtotal value.
--
-- Idempotent: the `subtotal_amount = 0` guard makes a second run a 0-row no-op.
-- The `s.sub <> 0` guard leaves genuinely-zero orders (free orders) at 0.
-- updated_at is intentionally NOT touched so this silent correction does not
-- disturb order history or admin sort-by-last-modified.

UPDATE orders o
SET subtotal_amount = s.sub
FROM (
    SELECT order_id, SUM(line_subtotal) AS sub
    FROM order_line_items
    GROUP BY order_id
) s
WHERE s.order_id = o.id
  AND o.subtotal_amount = 0
  AND s.sub <> 0;
