-- V171: Re-add article product overlay image columns dropped in V170.
-- The ACF product_image field on WP review posts drives the ExperienceCarousel
-- overlay in bigbike-web — see template-parts/content-review-swipe-item.php.
-- Backfill runs via the WP migration ArticleImporter (re-run or standalone backfill).
alter table articles
    add column if not exists product_image_url text;

alter table articles
    add column if not exists product_image_alt varchar(500);
