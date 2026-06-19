-- V231: Cấu hình tab trang chi tiết sản phẩm theo TỪNG sản phẩm (bigbike-web PDP).
-- Cho admin ẩn/hiện, đổi thứ tự, đổi tên nhãn các tab (Mô tả/Đánh giá/Thông số/Lắp đặt/FAQ) và
-- thêm tab tự do (nội dung dựng bằng khối, song ngữ). Lưu JSONB: mỗi tab gồm id/type/enabled/
-- sortOrder/label(+labelEn)/blocks(+blocksEn).
-- Migration dữ liệu: cột mới NULL cho mọi sản phẩm hiện có → web dùng CẤU HÌNH MẶC ĐỊNH (5 tab như cũ).
-- Không backfill; admin tự bật quản lý tab cho từng sản phẩm khi cần.

alter table products
    add column if not exists product_tabs jsonb;
