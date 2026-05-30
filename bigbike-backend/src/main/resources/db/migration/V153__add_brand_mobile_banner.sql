-- V153: Add mobile_banner_url / mobile_banner_alt columns to brands table.
-- Art direction for PageHero contact variant: mobile (≤767px) h-[300px], desktop h-[450px].
-- AR mobile≈1.3, AR desktop≈3.2 — difference 1.9 warrants a separate portrait image.

ALTER TABLE brands
    ADD COLUMN IF NOT EXISTS mobile_banner_url text,
    ADD COLUMN IF NOT EXISTS mobile_banner_alt varchar(255);
