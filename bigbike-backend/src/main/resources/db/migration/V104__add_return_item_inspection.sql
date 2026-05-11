-- V104: Add inspection columns to return_items.
--
-- Adds an explicit quality-check step between receiving returned goods and
-- finalising the return as COMPLETED/REFUNDED. Each return item can be marked
-- PASS or FAIL by an admin during the INSPECTING phase. Stock restoration
-- skips items marked FAIL so defective/customer-damaged goods are not put
-- back into sellable inventory.
--
-- Inspection is optional for backward compatibility: returns may still
-- transition RECEIVED → COMPLETED/REFUNDED directly without entering
-- INSPECTING, in which case all items behave as before (no filtering).

ALTER TABLE return_items
    ADD COLUMN inspection_result    VARCHAR(20),
    ADD COLUMN inspection_note      TEXT,
    ADD COLUMN inspected_at         TIMESTAMP WITH TIME ZONE,
    ADD COLUMN inspected_by_admin_id UUID;

-- Restrict inspection_result values at DB level.
ALTER TABLE return_items
    ADD CONSTRAINT chk_return_items_inspection_result
    CHECK (inspection_result IS NULL OR inspection_result IN ('PASS', 'FAIL'));

-- Index for filtering items by inspection result on a given return.
CREATE INDEX idx_return_items_return_inspection
    ON return_items (return_id, inspection_result);
