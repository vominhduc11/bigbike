-- V110: Drop product_category_map (multi-category support removed).
--
-- Context: products.category_id (FK NOT NULL) has always carried the canonical
-- "primary" category. product_category_map was a Hibernate-managed M:N side table
-- that no UI ever wrote into — the admin form has only ever exposed a single
-- category picker, and every PATCH silently reset the side table to
-- [primary_category]. Public catalog read path also collapsed to [primary] when
-- the side table was empty.
--
-- Business decision (2026-05-14): one product belongs to exactly one category.
-- Side table is dead weight; dropping it removes a class of silent-data-loss
-- bugs and simplifies the catalog write path.
--
-- Any rows in product_category_map that diverged from products.category_id are
-- abandoned. They were never queryable from the storefront in a way that the
-- primary category did not already cover.

DROP TABLE IF EXISTS product_category_map;
