-- V39: Guard against concurrent return submissions for the same order.
-- Partial unique index: at most one active (PENDING or APPROVED) return per order.
CREATE UNIQUE INDEX IF NOT EXISTS idx_returns_order_active
    ON returns (order_id)
    WHERE status IN ('PENDING', 'APPROVED');
