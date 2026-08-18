-- SEO_RULE_008: replace the legacy inline FAQ microdata with plain display markup.
-- Preserve an exact before-image for every affected category before touching either locale.

create table if not exists category_intro_faq_markup_backup (
    category_id varchar(255) primary key,
    category_slug varchar(255) not null,
    intro_content text,
    intro_content_en text,
    backed_up_at timestamp not null default now()
);

insert into category_intro_faq_markup_backup
    (category_id, category_slug, intro_content, intro_content_en)
select
    id::text,
    slug,
    intro_content,
    intro_content_en
from categories
where coalesce(intro_content, '') like '%bb-ci-faq%'
   or coalesce(intro_content_en, '') like '%bb-ci-faq%'
on conflict (category_id) do nothing;

update categories
set intro_content = regexp_replace(
        regexp_replace(
            regexp_replace(
                regexp_replace(
                    regexp_replace(
                        regexp_replace(coalesce(intro_content, ''),
                            ' itemscope itemtype="https://schema.org/FAQPage"', '', 'g'),
                        ' itemscope itemprop="mainEntity" itemtype="https://schema.org/Question"', '', 'g'),
                    ' itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer"', '', 'g'),
                ' itemprop="name"', '', 'g'),
            ' itemprop="text"', '', 'g'),
        '<span class="bb-ci-qt">([^<]*)</span>', '<h3 class="bb-ci-qt">\1</h3>', 'g')
where coalesce(intro_content, '') like '%bb-ci-faq%';

update categories
set intro_content_en = regexp_replace(
        regexp_replace(
            regexp_replace(
                regexp_replace(
                    regexp_replace(
                        regexp_replace(coalesce(intro_content_en, ''),
                            ' itemscope itemtype="https://schema.org/FAQPage"', '', 'g'),
                        ' itemscope itemprop="mainEntity" itemtype="https://schema.org/Question"', '', 'g'),
                    ' itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer"', '', 'g'),
                ' itemprop="name"', '', 'g'),
            ' itemprop="text"', '', 'g'),
        '<span class="bb-ci-qt">([^<]*)</span>', '<h3 class="bb-ci-qt">\1</h3>', 'g')
where coalesce(intro_content_en, '') like '%bb-ci-faq%';
