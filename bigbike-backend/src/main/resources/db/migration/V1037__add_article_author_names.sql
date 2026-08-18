-- ARTICLE_RULE_007: optional bilingual author names for articles.
alter table articles
    add column if not exists author_name varchar(255),
    add column if not exists author_name_en varchar(255);
