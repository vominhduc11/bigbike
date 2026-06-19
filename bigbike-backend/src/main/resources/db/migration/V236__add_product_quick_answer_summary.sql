-- V236: Thêm "Quick Answer" cho trang chi tiết sản phẩm (bigbike-web PDP).
-- Đoạn trả lời nhanh dạng AIO 40-60 từ, hiển thị blockquote TRƯỚC tiêu đề H2 đầu tiên,
-- để Google/AI trích dẫn. Field RIÊNG, khác "mô tả ngắn" (short_description, bullet cạnh nút mua).
-- Song ngữ: cột vi (canonical) + cột _en (tùy chọn, lùi về vi khi rỗng). Detail-only.

alter table products
    add column if not exists quick_answer_summary text,
    add column if not exists quick_answer_summary_en text;
