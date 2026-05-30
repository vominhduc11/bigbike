-- V155: Add hero banner image columns to categories table.
-- Mirrors the brand banner pattern (banner_url/alt + mobile_banner_url/alt).
-- Used by ProductArchiveHero on /danh-muc-san-pham/[slug] pages.

alter table categories
    add column if not exists banner_url          text,
    add column if not exists banner_alt          varchar(255),
    add column if not exists mobile_banner_url   text,
    add column if not exists mobile_banner_alt   varchar(255);
