-- promotion_content — long-form rich HTML rendered in the PDP "Khuyến mãi" tab.
-- Manual-fill, admin-editable. Mirrors the legacy WP product page where the
-- first product tab held promotional copy. Distinct from content_bottom
-- (SEO copy below the related-products grid) and description (the product
-- description tab).
alter table products
    add column promotion_content text;
