-- V213: Optional English URL slug for categories.
-- Vietnamese `slug` stays canonical (NOT NULL, unique). English slug is stored in a
-- nullable `slug_en` column on the same row. Partial-unique index allows many NULLs
-- but blocks duplicate en-vs-en slugs at the DB level; cross-column (vi-vs-en)
-- uniqueness is enforced in AdminCatalogMutationService.
-- See BUSINESS_RULES.md CATEGORY_RULE_003 and DATA_CONTRACT.md "English URL slug".

alter table categories
    add column slug_en varchar(100);

create unique index ux_categories_slug_en
    on categories (slug_en)
    where slug_en is not null;
