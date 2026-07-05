-- English translation column for origin_brand_country ("Thương hiệu [nước]").
-- origin_brand_country was single-column (vi only) — public EN pages rendered the
-- raw vi text verbatim. Mirrors the *_en pattern used by every other bilingual
-- product field (see V136__add_product_bilingual_content.sql).
alter table products
    add column origin_brand_country_en varchar(120);
