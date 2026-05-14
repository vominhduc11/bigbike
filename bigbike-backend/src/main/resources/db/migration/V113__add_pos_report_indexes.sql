-- V113: Indexes for POS reporting queries.
-- orders(channel, placed_at) speeds up daily/monthly POS revenue reports.
-- orders(created_by_admin_id, placed_at) speeds up per-staff sales reports.
CREATE INDEX IF NOT EXISTS idx_orders_channel_placed_at
    ON orders (channel, placed_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_staff_placed_at
    ON orders (created_by_admin_id, placed_at DESC)
    WHERE created_by_admin_id IS NOT NULL;
