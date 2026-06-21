-- V255: Chế độ "Dán mã HTML" cho khối Thông số kỹ thuật trên PDP (bigbike-web).
-- Cho phép admin thay bảng thông số có cấu trúc (product_specifications) bằng một khối HTML
-- tự do — "HTML thắng": khi cột non-blank, web render HTML (sanitize khi render, cho phép
-- <table>) THAY cho bảng dòng tên/giá trị; rỗng/null → giữ bảng dòng như cũ.
-- Song ngữ: cột vi (canonical) + cột _en (tùy chọn, lùi về vi khi rỗng). Detail-only.

alter table products
    add column if not exists specifications_html text,
    add column if not exists specifications_html_en text;
