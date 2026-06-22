-- V256: Chế độ "Dán mã HTML" cho khối "Ô số liệu nổi bật" (specStats) dưới khu mua hàng trên PDP.
-- Theo đúng mô hình specifications_html (V255): web render HTML này (sanitize khi render, cho phép
-- <table>/grid + CSS inline) — là NGUỒN render khi non-blank; rỗng/null → giữ lưới ô số liệu có
-- cấu trúc (product_spec_stats) làm lưới an toàn legacy.
-- Song ngữ: cột vi (canonical) + cột _en (tùy chọn, lùi về vi khi rỗng). Detail-only.

alter table products
    add column if not exists spec_stats_html text,
    add column if not exists spec_stats_html_en text;
