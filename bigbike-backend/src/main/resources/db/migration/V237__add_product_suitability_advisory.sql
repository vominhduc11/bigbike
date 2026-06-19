-- V237: Thêm khối "Phù hợp với ai — Nếu… thì…" cho trang chi tiết sản phẩm (bigbike-web PDP).
-- Rich-HTML (sanitize khi render), 3-4 câu tư vấn dạng nếu/thì kèm liên kết nội bộ tới sản phẩm
-- thay thế. Song ngữ: cột vi (canonical) + cột _en (tùy chọn, lùi về vi khi rỗng). Detail-only.

alter table products
    add column if not exists suitability_advisory text,
    add column if not exists suitability_advisory_en text;
