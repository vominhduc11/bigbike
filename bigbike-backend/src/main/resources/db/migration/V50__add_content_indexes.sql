-- P0-002: Add missing indexes for content module queries
-- Safe to run multiple times (IF NOT EXISTS)

-- articles: slug lookup, publish_status filter, published_at sort, created_at sort, category FK
CREATE UNIQUE INDEX IF NOT EXISTS idx_articles_slug
    ON articles (slug);

CREATE INDEX IF NOT EXISTS idx_articles_publish_status
    ON articles (publish_status);

CREATE INDEX IF NOT EXISTS idx_articles_published_at
    ON articles (published_at DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_articles_created_at
    ON articles (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_articles_category_id
    ON articles (category_id);

-- pages: slug lookup, publish_status filter, published_at sort, created_at sort
CREATE UNIQUE INDEX IF NOT EXISTS idx_pages_slug
    ON pages (slug);

CREATE INDEX IF NOT EXISTS idx_pages_publish_status
    ON pages (publish_status);

CREATE INDEX IF NOT EXISTS idx_pages_published_at
    ON pages (published_at DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_pages_created_at
    ON pages (created_at DESC);

-- article_category_map: join from article side and category side
CREATE INDEX IF NOT EXISTS idx_article_category_map_article_id
    ON article_category_map (article_id);

CREATE INDEX IF NOT EXISTS idx_article_category_map_category_id
    ON article_category_map (category_id);

-- article_tag_map: join from article side and tag side
CREATE INDEX IF NOT EXISTS idx_article_tag_map_article_id
    ON article_tag_map (article_id);

CREATE INDEX IF NOT EXISTS idx_article_tag_map_tag_id
    ON article_tag_map (tag_id);

-- blog_tags: slug lookup
CREATE UNIQUE INDEX IF NOT EXISTS idx_blog_tags_slug
    ON blog_tags (slug);

-- content_categories: slug lookup
CREATE UNIQUE INDEX IF NOT EXISTS idx_content_categories_slug
    ON content_categories (slug);
