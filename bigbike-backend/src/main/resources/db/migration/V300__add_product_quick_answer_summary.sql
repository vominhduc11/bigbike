-- V300: Tái tạo lại "Quick Answer" (trả lời nhanh) cho trang chi tiết sản phẩm (bigbike-web PDP).
-- Đoạn tóm tắt AIO 40-60 từ, hiển thị blockquote ngay sau Specs Dashboard, trước "Tính năng
-- chi tiết" (khối #3 mới), để Google/AI trích dẫn. Đã gỡ hoàn toàn ở V253 (2026-06-20), nay làm
-- lại theo yêu cầu chủ shop — tự ẩn khi rỗng, KHÔNG khôi phục cơ chế sectionVisibility (đã gỡ V245/V246).
-- Song ngữ: cột vi (canonical) + cột _en (tùy chọn, lùi về vi khi rỗng). Detail-only, max 600 ký tự.

alter table products
    add column if not exists quick_answer_summary text,
    add column if not exists quick_answer_summary_en text;
