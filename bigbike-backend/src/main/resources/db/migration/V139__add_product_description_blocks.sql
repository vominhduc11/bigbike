-- Add structured content blocks column to products (V139).
-- Stores the raw block JSON array (nullable). The rendered HTML continues to live in
-- the existing description TEXT column — written by DescriptionBlockRenderer on upsert.
ALTER TABLE products
    ADD COLUMN IF NOT EXISTS description_blocks jsonb;
