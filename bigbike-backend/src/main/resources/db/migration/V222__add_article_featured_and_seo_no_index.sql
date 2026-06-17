-- V222 — Article "featured" flag + per-article SEO noIndex flag.
--
-- featured: drives the public ?featured=true filter and the admin toggle.
-- seo_no_index: a seo_no_index column existed on `articles` in V1 but was DROPPED from every
--   table in V152 (2026-05-28, unused). It is re-added here, this time NOT NULL DEFAULT false,
--   and is actually mapped/consumed (ArticleEntity.seoNoIndex → SeoMeta.noIndex).

ALTER TABLE articles ADD COLUMN featured boolean NOT NULL DEFAULT false;
ALTER TABLE articles ADD COLUMN seo_no_index boolean NOT NULL DEFAULT false;
