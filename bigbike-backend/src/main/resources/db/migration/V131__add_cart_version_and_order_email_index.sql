-- V131: Add optimistic-lock version column to carts + functional index on orders.customer_email
--
-- (1) carts.version — supports JPA @Version optimistic locking on CartEntity.
--     Concurrent cart mutations (add item, apply coupon) now raise OptimisticLockException
--     instead of silently overwriting each other.
--
-- (2) orders lower(customer_email) index — speeds up guest-order linking on customer login.
--     Flagged as TODO in OrderJpaRepository since early development.

ALTER TABLE carts
    ADD COLUMN IF NOT EXISTS version BIGINT NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_orders_lower_customer_email
    ON orders (lower(customer_email));
