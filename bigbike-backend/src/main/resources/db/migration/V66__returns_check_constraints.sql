-- V66: Add CHECK constraints for returns and return_items tables.
-- These guard against invalid status/reason values being inserted by buggy code,
-- and enforce non-negative amount/quantity invariants at DB level.

ALTER TABLE returns
    ADD CONSTRAINT chk_returns_status
        CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'RECEIVED', 'COMPLETED', 'REFUNDED'));

ALTER TABLE returns
    ADD CONSTRAINT chk_returns_reason
        CHECK (reason IN ('DEFECTIVE', 'WRONG_ITEM', 'NOT_AS_DESCRIBED', 'CHANGED_MIND', 'OTHER'));

ALTER TABLE returns
    ADD CONSTRAINT chk_returns_refund_amount_nonneg
        CHECK (refund_amount >= 0);

ALTER TABLE return_items
    ADD CONSTRAINT chk_return_items_quantity_positive
        CHECK (quantity > 0);

ALTER TABLE return_items
    ADD CONSTRAINT chk_return_items_unit_price_nonneg
        CHECK (unit_price >= 0);
