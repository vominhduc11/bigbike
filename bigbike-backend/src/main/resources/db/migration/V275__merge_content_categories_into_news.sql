-- V275 — Merge all blog content categories into a single "Tin tức" category.
--
-- Owner decision 2026-06-24: bỏ phân biệt nhóm bài viết (Reviews / Tin tức / các nhóm rác
-- WP-import). Toàn bộ bài viết về chung 1 nhóm "Tin tức" (slug tin-tuc). Khối "Góc trải nghiệm"
-- trang chủ không còn phụ thuộc nhóm Reviews (đã chuyển sang admin chọn tay ở V272 + fallback
-- bài mới nhất). Trang danh sách /tin-tuc tự rút bộ lọc còn 1 nhóm (sidebar lọc theo count > 0).

-- 0) Defensive: đảm bảo nhóm "Tin tức" tồn tại (đã có từ V93, đây là no-op trên DB thật).
INSERT INTO content_categories (id, slug, name)
SELECT 'wp-blog-cat-361', 'tin-tuc', 'Tin tức'
WHERE NOT EXISTS (SELECT 1 FROM content_categories WHERE slug = 'tin-tuc');

-- 1) Dồn primary category của mọi bài viết về nhóm "Tin tức".
UPDATE articles
SET category_id = (SELECT id FROM content_categories WHERE slug = 'tin-tuc' LIMIT 1);

-- 2) Dựng lại bảng many-to-many: mỗi bài chỉ map tới nhóm "Tin tức".
DELETE FROM article_category_map;
INSERT INTO article_category_map (article_id, category_id, sort_order)
SELECT a.id, c.id, 0
FROM articles a
CROSS JOIN (SELECT id FROM content_categories WHERE slug = 'tin-tuc' LIMIT 1) c;

-- 3) Xoá mọi nhóm còn lại (giờ đã không còn bài nào tham chiếu).
DELETE FROM content_categories WHERE slug <> 'tin-tuc';
