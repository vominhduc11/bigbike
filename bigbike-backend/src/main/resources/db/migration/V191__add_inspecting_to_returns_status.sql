-- V191: Make the returns INSPECTING status DB-reachable.
--
-- V104 added per-item inspection columns and the code transition map allows
-- RECEIVED -> INSPECTING, but the chk_returns_status CHECK constraint (V66) was
-- never extended to include 'INSPECTING'. Persisting a return as INSPECTING
-- therefore failed at the DB level, leaving the QC sub-workflow unreachable
-- end-to-end (flagged in docs/business/STATE_MACHINES.md). This migration aligns
-- the DB invariants with the documented state machine (RETURN_RULE_002 / V104).

-- 1) Allow INSPECTING as a valid return status.
ALTER TABLE returns
    DROP CONSTRAINT IF EXISTS chk_returns_status;

ALTER TABLE returns
    ADD CONSTRAINT chk_returns_status
        CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'RECEIVED', 'INSPECTING', 'COMPLETED', 'REFUNDED'));

-- 2) Extend the "at most one active return per order" partial unique index to
--    include INSPECTING (RETURN_RULE_002: active = PENDING/APPROVED/RECEIVED/INSPECTING).
DROP INDEX IF EXISTS idx_returns_order_active;

CREATE UNIQUE INDEX idx_returns_order_active
    ON returns (order_id)
    WHERE status IN ('PENDING', 'APPROVED', 'RECEIVED', 'INSPECTING');
