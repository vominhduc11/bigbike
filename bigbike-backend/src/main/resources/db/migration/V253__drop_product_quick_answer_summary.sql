-- V253: Gỡ hoàn toàn "Quick Answer" (trả lời nhanh) khỏi trang chi tiết sản phẩm.
-- Khối blockquote AIO đã bị bỏ khỏi web PDP + ô nhập admin + API. Xoá vĩnh viễn 2 cột
-- dữ liệu (vi canonical + _en) đã thêm ở V236. Không khôi phục được.

alter table products
    drop column if exists quick_answer_summary,
    drop column if exists quick_answer_summary_en;
