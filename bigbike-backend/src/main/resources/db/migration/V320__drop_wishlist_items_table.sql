-- Remove the wishlist feature entirely (owner decision 2026-07-06).
-- The customer "Sản phẩm yêu thích" (wishlist) + "So sánh sản phẩm" (compare) features
-- were dropped: wishlist had a backend API + this table but never shipped a web or mobile
-- UI, and compare never had any code at all. The Java controller/entity/repository and the
-- product-delete cleanup query were removed in the same change. No production data existed
-- (no UI ever wrote to wishlist_items), so this drop is data-safe.
DROP TABLE IF EXISTS wishlist_items;
