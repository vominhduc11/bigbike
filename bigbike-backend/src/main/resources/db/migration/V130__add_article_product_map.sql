-- V130: Link articles to catalog products ("Sản phẩm sử dụng trong bài viết").
-- Many-to-many, ordered. Schema mirrors article_tag_map / article_category_map (V15).
-- The relation starts empty — no backfill. The legacy articles.product_image_url
-- column is unrelated (a single decorative thumbnail) and is left untouched.

create table if not exists article_product_map (
    article_id varchar(64) not null,
    product_id varchar(64) not null,
    sort_order integer not null,
    primary key (article_id, product_id),
    constraint fk_article_product_map_article_id
        foreign key (article_id) references articles (id) on delete cascade,
    constraint fk_article_product_map_product_id
        foreign key (product_id) references products (id)
);

-- PK (article_id, product_id) already covers article_id lookups;
-- index product_id for the reverse lookup and the FK delete check.
create index if not exists idx_article_product_map_article_id on article_product_map (article_id);
create index if not exists idx_article_product_map_product_id on article_product_map (product_id);
