-- V136: Bilingual product content — optional English columns. Vietnamese stays canonical.
-- Vietnamese content keeps the original columns (NOT NULL as before); English is stored
-- in nullable `_en` columns on the same row. No translation table: only two fixed locales,
-- and the product_specifications / product_faqs child rows are fully recreated on every
-- save, so a translation table keyed by child id would be orphaned. See PRODUCT_RULE_001/002.

alter table products
    add column name_en               varchar(255),
    add column short_description_en  text,
    add column description_en        text,
    add column content_bottom_en     text,
    add column promotion_content_en  text,
    add column installation_guide_en text,
    add column seo_title_en          varchar(255),
    add column seo_description_en    text;

alter table product_specifications
    add column name_en       varchar(255),
    add column spec_value_en text,
    add column group_name_en varchar(255);

alter table product_faqs
    add column question_en varchar(500),
    add column answer_en   text;
