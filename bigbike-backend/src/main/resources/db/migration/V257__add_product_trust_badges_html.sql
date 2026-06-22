-- V257: Chế độ "Dán mã HTML" cho khối "Dải tin cậy" (trustBadges) trên tên sản phẩm ở PDP.
-- Theo đúng mô hình specifications_html (V255) / spec_stats_html (V256): web render HTML này
-- (sanitize khi render, cho phép CSS inline) — là NGUỒN render khi non-blank; rỗng/null → giữ
-- dải badge có cấu trúc (product_trust_badges) làm lưới an toàn legacy.
-- Song ngữ: cột vi (canonical) + cột _en (tùy chọn, lùi về vi khi rỗng). Detail-only.

alter table products
    add column if not exists trust_badges_html text,
    add column if not exists trust_badges_html_en text;
