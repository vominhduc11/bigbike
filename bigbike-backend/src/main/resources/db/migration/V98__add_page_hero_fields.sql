-- V98: Page hero banner fields for CMS pages
-- See docs/engineering/DATA_CONTRACT.md "Page hero fields" for shape.
-- Listing pages without a PageEntity (san-pham, brands, tin-tuc) use the
-- public_hero settings group instead — registered in SettingDefinitionRegistry.

ALTER TABLE pages
    ADD COLUMN IF NOT EXISTS hero_image_url   VARCHAR(1024),
    ADD COLUMN IF NOT EXISTS hero_image_alt   VARCHAR(512),
    ADD COLUMN IF NOT EXISTS hero_title       VARCHAR(256),
    ADD COLUMN IF NOT EXISTS hero_description VARCHAR(1024),
    ADD COLUMN IF NOT EXISTS hero_kicker      VARCHAR(128);
