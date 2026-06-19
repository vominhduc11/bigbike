-- V248: Gallery media hỗn hợp (ảnh + video) cho cả gallery sản phẩm lẫn gallery biến thể.
-- Mỗi dòng gallery giờ có loại (media_type): 'image' (mặc định, giữ nguyên hành vi cũ) hoặc 'video'.
-- Item video lưu video_url + video_provider ('youtube'|'upload'); các cột image_* dùng làm thumbnail/poster.
-- Nguồn video này TÁCH KHỎI product_videos (product_videos chỉ còn feed tab "Video" phía dưới PDP).

ALTER TABLE product_gallery_images
    ADD COLUMN media_type     VARCHAR(8) NOT NULL DEFAULT 'image',
    ADD COLUMN video_url      TEXT,
    ADD COLUMN video_provider VARCHAR(16);

ALTER TABLE product_variant_gallery_images
    ADD COLUMN media_type     VARCHAR(8) NOT NULL DEFAULT 'image',
    ADD COLUMN video_url      TEXT,
    ADD COLUMN video_provider VARCHAR(16);

-- Item video có thể không có thumbnail (dùng auto-thumb YouTube / first-frame) → image_url cho phép NULL.
ALTER TABLE product_gallery_images        ALTER COLUMN image_url DROP NOT NULL;
ALTER TABLE product_variant_gallery_images ALTER COLUMN image_url DROP NOT NULL;
