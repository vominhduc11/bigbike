-- V138: Add optional English-language columns to articles and pages tables.
-- Vietnamese columns remain NOT NULL (canonical). English columns are nullable.
-- Per-field fallback: if EN value is null/blank, storefront serves VI value.
-- See ARTICLE_RULE_001/002 and PAGE_RULE_001/002 in docs/business/BUSINESS_RULES.md.

alter table articles
    add column title_en       varchar(255),
    add column excerpt_en     text,
    add column body_en        text,
    add column seo_title_en   varchar(255),
    add column seo_description_en text;

alter table pages
    add column title_en           varchar(255),
    add column body_en            text,
    add column hero_title_en      varchar(255),
    add column hero_description_en text,
    add column hero_kicker_en     varchar(255),
    add column seo_title_en       varchar(255),
    add column seo_description_en text;
