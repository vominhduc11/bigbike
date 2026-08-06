-- V371 — Cờ "cho Google hiển thị" cho đủ 4 loại thực thể, tách riêng theo ngôn ngữ.
--
-- Rule: BUSINESS_RULES.md `SEO_RULE_001` (cờ thủ công VI/EN) + `SEO_RULE_002` (ngưỡng đủ
-- nội dung tiếng Anh). Owner chốt 2026-08-06.
--
-- Lịch sử họ cột này:
--   V1   — `seo_no_index` nullable trên 5 bảng (products/categories/brands/articles/pages),
--          chưa bao giờ được đọc.
--   V152 — DROP toàn bộ vì không dùng đến.
--   V222 — khôi phục RIÊNG `articles.seo_no_index` (NOT NULL DEFAULT false) và dùng thật.
--   V371 — khôi phục đủ 4 loại và tách VI/EN. (`pages` không khôi phục: bảng đã bị xoá ở V271.)
--
-- KHÔNG backfill: ngưỡng "đủ nội dung EN" được tính động lúc đọc (SeoIndexPolicy), không lưu
-- thành cột. Nhờ vậy bản dịch mới tạo tự động ẩn cho tới khi có nội dung, và dịch xong là tự
-- hiện — không cần ai nhớ bấm nút, cũng không phải đoán giá trị cho 342 sản phẩm + 185 bài viết.
-- Hai cột dưới đây chỉ là lớp ghi đè thủ công.

ALTER TABLE products   ADD COLUMN seo_no_index    boolean NOT NULL DEFAULT false;
ALTER TABLE products   ADD COLUMN seo_no_index_en boolean NOT NULL DEFAULT false;

ALTER TABLE categories ADD COLUMN seo_no_index    boolean NOT NULL DEFAULT false;
ALTER TABLE categories ADD COLUMN seo_no_index_en boolean NOT NULL DEFAULT false;

ALTER TABLE brands     ADD COLUMN seo_no_index    boolean NOT NULL DEFAULT false;
ALTER TABLE brands     ADD COLUMN seo_no_index_en boolean NOT NULL DEFAULT false;

-- articles.seo_no_index đã tồn tại từ V222 — chỉ thêm cờ bản tiếng Anh.
ALTER TABLE articles   ADD COLUMN seo_no_index_en boolean NOT NULL DEFAULT false;
