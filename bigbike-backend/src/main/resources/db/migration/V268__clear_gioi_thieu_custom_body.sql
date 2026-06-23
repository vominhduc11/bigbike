-- V268: Trang Giới thiệu dùng bố cục dựng sẵn (lưới logo hãng + ô dịch vụ), không dùng body tùy biến.
-- Body của 'gioi-thieu' từng bị sửa tay (runtime) thành 7 thẻ <img> trỏ ảnh ngoài
-- https://bigbike.vn/wp-content/uploads/2020/07/agv.png (placeholder, hotlink host ngoài).
-- Đặt body rỗng để web render component AboutPageContent: logo hãng lấy từ MinIO, icon dịch vụ
-- lấy từ theme — đúng thiết kế gốc (page-about.php), không còn hotlink ảnh ngoài.
-- Cột body NOT NULL nên dùng '' thay vì NULL. Idempotent (WHERE body <> '').

update pages
set body = '', updated_at = now()
where slug = 'gioi-thieu' and body <> '';
