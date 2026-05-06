-- Expand the partial unique index on returns(order_id) to also cover RECEIVED status.
-- Previously only PENDING and APPROVED were guarded, allowing a second return request
-- to be opened while the first was already in RECEIVED state.

DROP INDEX IF EXISTS idx_returns_order_active;

CREATE UNIQUE INDEX idx_returns_order_active
    ON returns (order_id)
    WHERE status IN ('PENDING', 'APPROVED', 'RECEIVED');
