-- Snapshot the product/variant image on each order line at checkout time (AUD-038).
-- Order history previously resolved the thumbnail live from the current catalog, so an
-- order's images could change or vanish when the product was edited/deleted. New orders
-- store the image URL they were placed with; legacy rows stay NULL and fall back to the
-- live lookup for backward compatibility.
ALTER TABLE order_line_items ADD COLUMN IF NOT EXISTS image_url TEXT;
