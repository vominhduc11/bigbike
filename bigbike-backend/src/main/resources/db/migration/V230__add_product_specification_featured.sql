-- V230: Thêm cờ "đưa lên ô nổi bật" cho từng dòng thông số kỹ thuật (bigbike-web PDP).
-- Admin tích tối đa 4 dòng để web hiển thị thành dải "thông số nổi bật" ngay dưới khối mua hàng.
-- Migration dữ liệu: mọi dòng hiện có nhận featured = false (mặc định) — chưa sản phẩm nào nổi bật
-- tới khi admin tự chọn.

alter table product_specifications
    add column if not exists featured boolean not null default false;
