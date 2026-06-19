-- V229: Thêm cột mô tả dạng khối tiếng Anh cho sản phẩm (bigbike-web PDP).
-- Trước đây mô tả tiếng Việt dùng trình dựng khối (description_blocks JSONB, V139) còn tiếng Anh
-- chỉ là HTML phẳng (description_en). Để hai ngôn ngữ trình bày đồng nhất theo bố cục khối trên web,
-- bổ sung description_blocks_en. Backend render khối EN -> description_en (HTML) lúc lưu (giống VI),
-- web đọc trực tiếp khối để dựng bố cục ảnh-chữ.
-- Migration dữ liệu: cột mới NULL cho mọi sản phẩm hiện có; không backfill (không thể chuyển HTML->khối
-- tự động). Sản phẩm legacy chỉ có HTML sẽ tự fallback hiển thị HTML như cũ.

alter table products
    add column if not exists description_blocks_en jsonb;
