-- V15: Normalize WordPress-backed relations and attribute/value schema
-- Keeps legacy flat tables as archival sources while introducing canonical relations.

-- Page hierarchy
alter table pages
    add column if not exists parent_id varchar(64);
alter table pages
    add constraint fk_pages_parent_id
    foreign key (parent_id) references pages (id);

create index if not exists idx_pages_parent_id on pages (parent_id);

-- Blog tags and article tag relations
create table if not exists blog_tags (
    id   varchar(64) primary key,
    slug varchar(160) not null unique,
    name varchar(255) not null
);

create table if not exists article_category_map (
    article_id  varchar(64) not null,
    category_id varchar(64) not null,
    sort_order  integer not null,
    primary key (article_id, category_id),
    constraint fk_article_category_map_article_id
        foreign key (article_id) references articles (id) on delete cascade,
    constraint fk_article_category_map_category_id
        foreign key (category_id) references content_categories (id)
);

create table if not exists article_tag_map (
    article_id varchar(64) not null,
    tag_id     varchar(64) not null,
    sort_order integer not null,
    primary key (article_id, tag_id),
    constraint fk_article_tag_map_article_id
        foreign key (article_id) references articles (id) on delete cascade,
    constraint fk_article_tag_map_tag_id
        foreign key (tag_id) references blog_tags (id)
);

insert into article_category_map (article_id, category_id, sort_order)
select a.id, a.category_id, 0
from articles a
where a.category_id is not null;

insert into blog_tags (id, slug, name)
select 'legacy-blog-tag-' || row_number() over (order by slug), slug, name
from (
    select slug, min(name) as name
    from (
        select
            btrim(lower(regexp_replace(trim(tag), '[^a-zA-Z0-9]+', '-', 'g')), '-') as slug,
            trim(tag) as name
        from article_tags
        where tag is not null and btrim(tag) <> ''
    ) normalized_article_tags
    group by slug
) blog_tag_seed;

insert into article_tag_map (article_id, tag_id, sort_order)
select t.article_id, b.id, t.sort_order
from (
    select
        article_id,
        btrim(lower(regexp_replace(trim(tag), '[^a-zA-Z0-9]+', '-', 'g')), '-') as slug,
        min(sort_order) as sort_order
    from article_tags
    where tag is not null and btrim(tag) <> ''
    group by article_id, btrim(lower(regexp_replace(trim(tag), '[^a-zA-Z0-9]+', '-', 'g')), '-')
) t
join blog_tags b on b.slug = t.slug;

-- Product tags: replace flat assignment table with canonical tag entities + join table
alter table if exists product_tags rename to product_tag_assignments_legacy;

create table if not exists product_tags (
    id   varchar(64) primary key,
    slug varchar(160) not null unique,
    tag  varchar(255) not null
);

create table if not exists product_tag_map (
    product_id varchar(64) not null,
    tag_id     varchar(64) not null,
    primary key (product_id, tag_id),
    constraint fk_product_tag_map_product_id
        foreign key (product_id) references products (id) on delete cascade,
    constraint fk_product_tag_map_tag_id
        foreign key (tag_id) references product_tags (id)
);

insert into product_tags (id, slug, tag)
select 'legacy-product-tag-' || row_number() over (order by slug), slug, tag_name
from (
    select slug, min(tag_name) as tag_name
    from (
        select
            btrim(lower(regexp_replace(trim(tag), '[^a-zA-Z0-9]+', '-', 'g')), '-') as slug,
            trim(tag) as tag_name
        from product_tag_assignments_legacy
        where tag is not null and btrim(tag) <> ''
    ) normalized_product_tags
    group by slug
) product_tag_seed;

insert into product_tag_map (product_id, tag_id)
select t.product_id, p.id
from (
    select
        product_id,
        btrim(lower(regexp_replace(trim(tag), '[^a-zA-Z0-9]+', '-', 'g')), '-') as slug
    from product_tag_assignments_legacy
    where tag is not null and btrim(tag) <> ''
    group by product_id, btrim(lower(regexp_replace(trim(tag), '[^a-zA-Z0-9]+', '-', 'g')), '-')
) t
join product_tags p on p.slug = t.slug;

-- Attributes and values for pa_* taxonomies and normalized variation options
create table if not exists attributes (
    id                  varchar(64) primary key,
    code                varchar(160) not null unique,
    name                varchar(255) not null,
    kind                varchar(32) not null,
    is_variation        boolean not null,
    legacy_taxonomy_id  bigint unique
);

create table if not exists attribute_values (
    id               varchar(64) primary key,
    attribute_id     varchar(64) not null,
    slug             varchar(160) not null,
    label            varchar(255) not null,
    legacy_term_id   bigint unique,
    color_hex        varchar(64),
    swatch_image_id  varchar(64),
    sort_order       integer not null,
    constraint fk_attribute_values_attribute_id
        foreign key (attribute_id) references attributes (id) on delete cascade,
    constraint uq_attribute_values_attribute_slug
        unique (attribute_id, slug)
);

alter table product_variant_options
    add column if not exists attribute_id varchar(64);
alter table product_variant_options
    add column if not exists attribute_value_id varchar(64);
alter table product_variant_options
    add constraint fk_product_variant_options_attribute_id
    foreign key (attribute_id) references attributes (id);
alter table product_variant_options
    add constraint fk_product_variant_options_attribute_value_id
    foreign key (attribute_value_id) references attribute_values (id);

create index if not exists idx_attribute_values_attribute_id on attribute_values (attribute_id);

insert into attributes (id, code, name, kind, is_variation)
select 'legacy-attr-' || row_number() over (order by code), code, name, 'select', true
from (
    select code, min(name) as name
    from (
        select
            btrim(lower(regexp_replace(trim(option_name), '[^a-zA-Z0-9]+', '-', 'g')), '-') as code,
            trim(option_name) as name
        from product_variant_options
        where option_name is not null and btrim(option_name) <> ''
    ) normalized_option_attributes
    group by code
) attribute_seed;

insert into attribute_values (id, attribute_id, slug, label, sort_order)
select
    'legacy-attr-value-' || row_number() over (order by attribute_code, value_slug),
    a.id,
    value_slug,
    value_label,
    row_number() over (order by attribute_code, value_slug)
from (
    select
        btrim(lower(regexp_replace(trim(option_name), '[^a-zA-Z0-9]+', '-', 'g')), '-') as attribute_code,
        btrim(lower(regexp_replace(trim(option_value), '[^a-zA-Z0-9]+', '-', 'g')), '-') as value_slug,
        min(trim(option_value)) as value_label
    from product_variant_options
    where option_name is not null and btrim(option_name) <> ''
      and option_value is not null and btrim(option_value) <> ''
    group by
        btrim(lower(regexp_replace(trim(option_name), '[^a-zA-Z0-9]+', '-', 'g')), '-'),
        btrim(lower(regexp_replace(trim(option_value), '[^a-zA-Z0-9]+', '-', 'g')), '-')
) value_seed
join attributes a on a.code = value_seed.attribute_code;

update product_variant_options pvo
set attribute_id = (
        select a.id
        from attributes a
        where a.code = btrim(lower(regexp_replace(trim(pvo.option_name), '[^a-zA-Z0-9]+', '-', 'g')), '-')
    ),
    attribute_value_id = (
        select av.id
        from attributes a
        join attribute_values av on av.attribute_id = a.id
        where a.code = btrim(lower(regexp_replace(trim(pvo.option_name), '[^a-zA-Z0-9]+', '-', 'g')), '-')
          and av.slug = btrim(lower(regexp_replace(trim(pvo.option_value), '[^a-zA-Z0-9]+', '-', 'g')), '-')
    )
where pvo.option_name is not null and btrim(pvo.option_name) <> ''
  and pvo.option_value is not null and btrim(pvo.option_value) <> '';
