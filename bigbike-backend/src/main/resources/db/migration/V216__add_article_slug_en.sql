-- V216: Optional English URL slug for articles (blog).
-- Vietnamese `slug` stays canonical (NOT NULL, unique). English slug is stored in a
-- nullable `slug_en` column on the same row. Partial-unique index allows many NULLs
-- but blocks duplicate en-vs-en slugs at the DB level; cross-column (vi-vs-en)
-- uniqueness is enforced in AdminContentMutationService.
-- Scope: articles only — static pages keep PAGE_RULE_003 (no slug_en).
-- See BUSINESS_RULES.md ARTICLE_RULE_003 and DATA_CONTRACT.md "English URL slug".

alter table articles
    add column slug_en varchar(100);

create unique index ux_articles_slug_en
    on articles (slug_en)
    where slug_en is not null;
