-- Deduplicate: keep the most recently updated ACTIVE cart per customer; mark the rest MERGED.
-- This cleans up any duplicate ACTIVE carts created by a race condition before the unique index existed.
WITH ranked AS (
    SELECT id,
           ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY updated_at DESC) AS rn
    FROM carts
    WHERE customer_id IS NOT NULL
      AND status = 'ACTIVE'
),
to_close AS (
    SELECT id FROM ranked WHERE rn > 1
)
UPDATE carts
SET status = 'MERGED', updated_at = NOW()
WHERE id IN (SELECT id FROM to_close);

-- Partial unique index: at most one ACTIVE cart per customer.
CREATE UNIQUE INDEX IF NOT EXISTS idx_carts_one_active_per_customer
    ON carts (customer_id)
    WHERE status = 'ACTIVE' AND customer_id IS NOT NULL;
