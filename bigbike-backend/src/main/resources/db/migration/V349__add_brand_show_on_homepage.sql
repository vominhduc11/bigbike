ALTER TABLE brands
    ADD COLUMN IF NOT EXISTS show_on_homepage BOOLEAN NOT NULL DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS idx_brands_show_on_homepage
    ON brands (show_on_homepage);
