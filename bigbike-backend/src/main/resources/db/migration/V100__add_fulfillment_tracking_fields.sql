-- V100: Add shipping tracking fields to orders table.
-- Allows admin to record tracking number and carrier when dispatching an order,
-- and surfaces this to the customer in order status emails.

ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS tracking_number  VARCHAR(200),
    ADD COLUMN IF NOT EXISTS shipping_carrier VARCHAR(100),
    ADD COLUMN IF NOT EXISTS shipped_at       TIMESTAMP WITH TIME ZONE;
