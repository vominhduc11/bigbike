-- V66: Add CHECK constraints for returns and return_items tables.
-- These guard against invalid status/reason values being inserted by buggy code,
-- and enforce non-negative amount/quantity invariants at DB level.
--
-- Pre-flight assumption: all existing rows must already satisfy these constraints.
-- The DO block below aborts the migration with a clear message if any violations exist,
-- so the DBA can investigate and clean up before re-running.
-- In a clean/new deployment this block completes instantly (0 violations).

DO $$
DECLARE
    bad_status   BIGINT;
    bad_reason   BIGINT;
    bad_amount   BIGINT;
    bad_qty      BIGINT;
    bad_price    BIGINT;
BEGIN
    SELECT COUNT(*) INTO bad_status  FROM returns       WHERE status NOT IN ('PENDING','APPROVED','REJECTED','RECEIVED','COMPLETED','REFUNDED');
    SELECT COUNT(*) INTO bad_reason  FROM returns       WHERE reason NOT IN ('DEFECTIVE','WRONG_ITEM','NOT_AS_DESCRIBED','CHANGED_MIND','OTHER');
    SELECT COUNT(*) INTO bad_amount  FROM returns       WHERE refund_amount < 0;
    SELECT COUNT(*) INTO bad_qty     FROM return_items  WHERE quantity <= 0;
    SELECT COUNT(*) INTO bad_price   FROM return_items  WHERE unit_price < 0;

    IF bad_status > 0 THEN
        RAISE EXCEPTION 'V66 pre-flight: % returns have invalid status. Fix before applying migration.', bad_status;
    END IF;
    IF bad_reason > 0 THEN
        RAISE EXCEPTION 'V66 pre-flight: % returns have invalid reason. Fix before applying migration.', bad_reason;
    END IF;
    IF bad_amount > 0 THEN
        RAISE EXCEPTION 'V66 pre-flight: % returns have negative refund_amount. Fix before applying migration.', bad_amount;
    END IF;
    IF bad_qty > 0 THEN
        RAISE EXCEPTION 'V66 pre-flight: % return_items have quantity <= 0. Fix before applying migration.', bad_qty;
    END IF;
    IF bad_price > 0 THEN
        RAISE EXCEPTION 'V66 pre-flight: % return_items have negative unit_price. Fix before applying migration.', bad_price;
    END IF;
END $$;

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
