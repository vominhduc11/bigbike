-- 2026-09-09: COD-only payment cutover.
--
-- This migration is deliberately fail-closed. The two named orders were measured as
-- PROCESSING/BANK_TRANSFER with one pending, unpaid payment each. Any drift aborts the
-- migration before a row is changed. Historical payment methods and payment details are
-- otherwise retained for accounting.

DO $$
DECLARE
    target_count bigint;
BEGIN
    -- A clean database has no historical orders to convert. It still continues through
    -- the settings and notification cleanup below so a fresh install is COD-only too.
    IF NOT EXISTS (SELECT 1 FROM orders) THEN
        RAISE NOTICE 'COD cutover: no orders exist; skipping historical order conversion';
        RETURN;
    END IF;

    SELECT count(*) INTO target_count
    FROM orders
    WHERE order_number IN ('BB-20260907-8D3C36', 'BB-20260909-471115');

    IF target_count <> 2 THEN
        RAISE EXCEPTION 'COD cutover stopped: expected exactly 2 target orders, found %', target_count;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM orders
        WHERE order_number IN ('BB-20260907-8D3C36', 'BB-20260909-471115')
          AND (
              status IS DISTINCT FROM 'PROCESSING'
              OR payment_method IS DISTINCT FROM 'BANK_TRANSFER'
              OR paid_amount IS DISTINCT FROM 0::numeric
              OR paid_at IS NOT NULL
              OR (order_number = 'BB-20260907-8D3C36' AND total_amount IS DISTINCT FROM 5450000::numeric)
              OR (order_number = 'BB-20260909-471115' AND total_amount IS DISTINCT FROM 1550000::numeric)
          )
    ) THEN
        RAISE EXCEPTION 'COD cutover stopped: target order baseline does not match the recorded unpaid PROCESSING state';
    END IF;

    SELECT count(*) INTO target_count
    FROM payments p
    JOIN orders o ON o.id = p.order_id
    WHERE o.order_number IN ('BB-20260907-8D3C36', 'BB-20260909-471115');

    IF target_count <> 2 THEN
        RAISE EXCEPTION 'COD cutover stopped: expected exactly 2 target payment rows, found %', target_count;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM payments p
        JOIN orders o ON o.id = p.order_id
        WHERE o.order_number IN ('BB-20260907-8D3C36', 'BB-20260909-471115')
          AND (
              p.payment_method IS DISTINCT FROM 'BANK_TRANSFER'
              OR p.status IS DISTINCT FROM 'PENDING'
              OR p.amount IS DISTINCT FROM o.total_amount
              OR p.currency IS DISTINCT FROM 'VND'
              OR p.paid_at IS NOT NULL
          )
    ) THEN
        RAISE EXCEPTION 'COD cutover stopped: target payment baseline does not match the recorded pending unpaid state';
    END IF;

    IF EXISTS (
        SELECT o.order_number
        FROM payments p
        JOIN orders o ON o.id = p.order_id
        WHERE o.order_number IN ('BB-20260907-8D3C36', 'BB-20260909-471115')
        GROUP BY o.order_number
        HAVING count(*) <> 1
    ) THEN
        RAISE EXCEPTION 'COD cutover stopped: each target order must have exactly one payment row';
    END IF;
END
$$;

DO $$
DECLARE
    changed_count bigint;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM orders) THEN
        RETURN;
    END IF;

    UPDATE payments p
    SET payment_method = 'COD'
    FROM orders o
    WHERE o.id = p.order_id
      AND o.order_number IN ('BB-20260907-8D3C36', 'BB-20260909-471115')
      AND p.payment_method = 'BANK_TRANSFER'
      AND p.status = 'PENDING'
      AND p.amount = o.total_amount
      AND p.currency = 'VND'
      AND p.paid_at IS NULL;

    GET DIAGNOSTICS changed_count = ROW_COUNT;
    IF changed_count <> 2 THEN
        RAISE EXCEPTION 'COD cutover stopped: expected 2 payment methods to change, changed %', changed_count;
    END IF;
END
$$;

DO $$
DECLARE
    changed_count bigint;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM orders) THEN
        RETURN;
    END IF;

    UPDATE orders
    SET payment_method = 'COD'
    WHERE order_number IN ('BB-20260907-8D3C36', 'BB-20260909-471115')
      AND status = 'PROCESSING'
      AND payment_method = 'BANK_TRANSFER'
      AND paid_amount = 0
      AND paid_at IS NULL;

    GET DIAGNOSTICS changed_count = ROW_COUNT;
    IF changed_count <> 2 THEN
        RAISE EXCEPTION 'COD cutover stopped: expected 2 order methods to change, changed %', changed_count;
    END IF;
END
$$;

DO $$
DECLARE
    setting_count bigint;
BEGIN
    SELECT count(*) INTO setting_count
    FROM site_settings
    WHERE setting_group = 'payment'
      AND setting_key IN ('bank_account_holder', 'bank_account_number', 'bank_name', 'bank_branch');

    IF setting_count <> 4 THEN
        RAISE EXCEPTION 'COD cutover stopped: expected 4 bank settings in group payment, found %', setting_count;
    END IF;
END
$$;

DO $$
DECLARE
    deleted_count bigint;
BEGIN
    DELETE FROM site_settings
    WHERE setting_group = 'payment'
      AND setting_key IN ('bank_account_holder', 'bank_account_number', 'bank_name', 'bank_branch');

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    IF deleted_count <> 4 THEN
        RAISE EXCEPTION 'COD cutover stopped: expected 4 bank settings to be deleted, deleted %', deleted_count;
    END IF;
END
$$;

-- Retire any notification rows from the removed assistant payment path. No order or inventory
-- notification row matches this type.
DELETE FROM admin_notifications
WHERE type = 'CHAT_BANK_TRANSFER_RECEIPT';

-- V1082 added this column solely for the removed assistant payment notification relationship.
ALTER TABLE admin_notifications DROP COLUMN IF EXISTS chat_message_id CASCADE;
