-- V137: Bilingual content for categories and brands.
-- Vietnamese stays canonical (NOT NULL columns unchanged); English is stored
-- in nullable `_en` columns on the same row. Pattern follows V136 (product bilingual).
-- See BUSINESS_RULES.md CATEGORY_RULE_001/002 and BRAND_RULE_001/002.

alter table categories
    add column name_en            varchar(255),
    add column description_en     text,
    add column seo_title_en       varchar(255),
    add column seo_description_en text;

alter table brands
    add column name_en            varchar(255),
    add column description_en     text,
    add column seo_title_en       varchar(255),
    add column seo_description_en text;
