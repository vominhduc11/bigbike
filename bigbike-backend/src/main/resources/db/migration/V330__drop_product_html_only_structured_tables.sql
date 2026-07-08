-- specifications/specStats/trustBadges are now HTML-only (specifications_html/spec_stats_html/
-- trust_badges_html, added at V255/V256/V257) — same model as suitability_section/size_guide_section
-- (V327/V328). V329 backfilled any product missing HTML from these tables; safe to drop now.
DROP TABLE IF EXISTS product_specifications;
DROP TABLE IF EXISTS product_spec_stats;
DROP TABLE IF EXISTS product_trust_badges;
