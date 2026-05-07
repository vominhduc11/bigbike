-- Composite index for revenue range queries on the reports endpoints.
-- Avoids a sequential scan on the status filter when scoped to a placed_at range.
CREATE INDEX IF NOT EXISTS idx_orders_placed_at_status
    ON orders (placed_at, status);

-- Partial index for refundAmount aggregation queries.
-- Only covers rows that have actually been refunded, keeping index size small.
CREATE INDEX IF NOT EXISTS idx_orders_refunded_amount_placed_at
    ON orders (placed_at)
    WHERE refund_amount IS NOT NULL AND refund_amount > 0;
