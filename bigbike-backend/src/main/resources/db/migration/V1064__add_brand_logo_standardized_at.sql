-- Brand logo quality is opt-in for newly saved/replaced logos.
-- NULL intentionally preserves the legacy status of every existing brand logo.
ALTER TABLE brands
    ADD COLUMN logo_standardized_at TIMESTAMPTZ NULL;
